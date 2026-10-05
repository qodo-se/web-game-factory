"""Portable JSON saves. Validate untrusted uploads before constructing an engine."""
import json
from functools import lru_cache
import math
from pathlib import Path
import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from games.borderstrife.api import store
from games.borderstrife.engine.models import GameState, CombatResult
from games.borderstrife.engine.replay import _restore
from games.borderstrife.engine.standing_orders import normalize

MAX_BYTES = 16 * 1024 * 1024
FORMAT = 'borderstrife-save'
UInt = Annotated[int, Field(ge=0, le=10**12)]
Side = Literal['player_1', 'player_2', 'rogue']
Route = Literal['road', 'river', 'pass', 'sea']


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class Movement(Model):
    from_: UInt = Field(alias='from')
    to: UInt
    army: UInt


class Source(Model):
    region_id: UInt
    army: UInt
    supplied: bool
    attack_multiplier: float
    crossing: Route
    crossing_multiplier: float


class Details(Model):
    effective_attack: float
    effective_defense: float
    win_probability: Annotated[float, Field(ge=0, le=1)]
    roll: Annotated[float, Field(ge=0, le=1)]
    terrain: Literal['city', 'plains', 'hills', 'desert', 'forest', 'coast'] | None = None
    terrain_multiplier: float | None = None
    defender_supplied: bool | None = None
    defense_multiplier: float | None = None
    sources: list[Source] = Field(default_factory=list)


class Event(Model):
    type: Literal['movement', 'battle', 'retreat', 'standing_order']
    from_: UInt | None = Field(default=None, alias='from')
    to: UInt | None = None
    army: UInt | None = None
    owner: Side | None = None
    route: Route | None = None
    previous_owner: Side | None = None
    won: bool | None = None
    attacker_losses: UInt | None = None
    defender_losses: UInt | None = None
    order_id: str | None = None
    region_id: UInt | None = None
    status: str | None = None
    message: str | None = None


class Position(Model):
    turn: Annotated[int, Field(ge=1)]
    game_over: bool
    winner: Literal['player_1', 'player_2'] | None
    regions: dict[int, tuple[Side, UInt]]


class Report(Model):
    turn: Annotated[int, Field(ge=1)]
    combat_results: list[CombatResult]
    events: list[Event] = Field(default_factory=list)
    movements: list[Movement | tuple[UInt, UInt, UInt]]
    game_over: bool
    winner: Literal['player_1', 'player_2'] | None
    replay_before: Position | None = None


def _check_tree(value, depth=0):
    if depth > 24:
        raise ValueError('Save nesting is too deep.')
    if isinstance(value, dict):
        for key, child in value.items():
            if len(key) > 120:
                raise ValueError('Invalid save field.')
            _check_tree(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            _check_tree(child, depth + 1)
    elif isinstance(value, str):
        if len(value) > 10000:
            raise ValueError('Save text is too long.')
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(value) or abs(value) > 10**12:
            raise ValueError('Invalid number in save.')


@lru_cache(maxsize=128)
def _map_regions(asset):
    path = Path(__file__).parents[1] / 'ui/maps' / f'{asset}.json'
    if not path.is_file():
        raise ValueError('The map used by this save is unavailable.')
    return {region['id']: region['name'] for region in json.loads(path.read_text())['regions']}


def _validate_state(state):
    ids = set(state.regions)
    if not 2 <= len(ids) <= 500 or state.turn < 1 or state.rules_version not in (1, 2):
        raise ValueError('Unsupported campaign state.')
    if {p.id for p in state.players} != {'player_1', 'player_2'} or len(state.players) != 2:
        raise ValueError('Invalid players.')
    if state.winner not in (None, 'player_1', 'player_2') or bool(state.winner) != state.game_over:
        raise ValueError('Invalid campaign result.')
    for player in state.players:
        if player.is_ai != (player.id == 'player_2'):
            raise ValueError('This save requires an unsupported player configuration.')
        if player.capital_region_id not in ids or len(player.name) > 200:
            raise ValueError('Invalid player capital or name.')
    for rid, region in state.regions.items():
        if rid != region.id or not 0 <= rid < 500 or region.army < 0 or len(region.name) > 200:
            raise ValueError('Invalid region.')
        if not set(region.neighbors) <= ids - {rid} or len(region.neighbors) != len(set(region.neighbors)):
            raise ValueError('Invalid region connections.')
        if any(rid not in state.regions[n].neighbors for n in region.neighbors):
            raise ValueError('Region connections must be symmetric.')
        if region.reinforcement_rate is not None and region.reinforcement_rate < 0:
            raise ValueError('Invalid recruitment rate.')
    if not set(state.ports) <= ids:
        raise ValueError('Invalid ports.')
    for key, route in state.routes.items():
        if not re.fullmatch(r'\d+:\d+', key) or route not in ('road', 'river', 'pass', 'sea'):
            raise ValueError('Invalid route.')
        a, b = map(int, key.split(':'))
        if a not in ids or b not in state.regions[a].neighbors:
            raise ValueError('Invalid route connection.')
    asset = state.map_asset_id or state.preset_id
    if asset is not None:
        if not re.fullmatch(r'[a-z0-9_]+', asset):
            raise ValueError('The map used by this save is unavailable.')
        if _map_regions(asset) != {rid: region.name for rid, region in state.regions.items()}:
            raise ValueError('The map regions do not match this save.')
    if state.battle is not None:
        battle = state.battle
        if type(battle.get('turn_limit')) is not int or battle['turn_limit'] < 1:
            raise ValueError('Invalid battle duration.')
        if not isinstance(battle.get('objectives'), list) or not set(battle['objectives']) <= ids:
            raise ValueError('Invalid battle objectives.')
        if battle.get('defender') not in ('player_1', 'player_2') or not isinstance(battle.get('name'), str):
            raise ValueError('Invalid battle metadata.')
        if not isinstance(battle.get('factions'), dict) or any(not isinstance(battle['factions'].get(p), str) for p in ('player_1', 'player_2')):
            raise ValueError('Invalid battle factions.')
    if len(state.standing_orders) > len(ids):
        raise ValueError('Too many standing orders.')
    from games.borderstrife.api.routes import StandingOrderIn
    sources = set()
    order_ids = set()
    for order in state.standing_orders:
        parsed = StandingOrderIn.model_validate(order, strict=True)
        a, b = parsed.path
        if a not in ids or b not in state.regions[a].neighbors or a in sources or parsed.id in order_ids:
            raise ValueError('Invalid standing order.')
        if 'reason' in order and not isinstance(order['reason'], str):
            raise ValueError('Invalid standing order reason.')
        sources.add(a)
        order_ids.add(parsed.id)
    state.standing_orders = normalize(state.standing_orders)


def encode(engine):
    data = {'format': FORMAT, 'version': 1, 'campaign': json.loads(store._encode(engine))}
    payload = json.dumps(data, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    if len(payload) > MAX_BYTES:
        raise ValueError('This campaign exceeds the 16 MB portable-save limit.')
    return payload


def decode(payload):
    if len(payload) > MAX_BYTES:
        raise ValueError('Save files must be 16 MB or smaller.')
    data = json.loads(payload)
    _check_tree(data)
    if not isinstance(data, dict) or data.get('format') != FORMAT or type(data.get('version')) is not int or data['version'] != 1:
        raise ValueError('Choose a BorderStrife save file (version 1).')
    raw = data['campaign']
    if raw.get('schema') != 1 or raw.get('journal') is not False:
        raise ValueError('This file does not contain a complete portable save.')
    state = TypeAdapter(GameState).validate_json(json.dumps(raw['state']), strict=True)
    _validate_state(state)
    if not isinstance(raw['name'], str) or not 1 <= len(raw['name']) <= 200:
        raise ValueError('Invalid campaign name.')
    if raw.get('seed') is not None and type(raw['seed']) is not int:
        raise ValueError('Invalid random seed.')
    reports = TypeAdapter(list[Report]).validate_json(json.dumps(raw['history']), strict=True)
    ids = set(state.regions)
    previous = 0
    for report, entry in zip(reports, raw['history']):
        if not previous < report.turn < state.turn:
            raise ValueError('Invalid turn sequence.')
        previous = report.turn
        refs = []
        for move in report.movements:
            refs.extend((move.from_, move.to) if isinstance(move, Movement) else move[:2])
        for event in report.events:
            if event.type == 'standing_order':
                if None in (event.region_id, event.status, event.message):
                    raise ValueError('Incomplete standing-order event.')
                refs.append(event.region_id)
            else:
                if None in (event.from_, event.to, event.army, event.owner):
                    raise ValueError('Incomplete movement or battle event.')
                refs.extend((event.from_, event.to))
        for combat in report.combat_results:
            refs.extend((combat.attacker_region_id, combat.defender_region_id))
            if combat.retreat_region_id is not None:
                refs.append(combat.retreat_region_id)
            if combat.attacker_owner not in ('', 'player_1', 'player_2', 'rogue') or combat.defender_owner not in ('', 'player_1', 'player_2', 'rogue'):
                raise ValueError('Invalid combat owner.')
            if combat.battle_details:
                details = Details.model_validate(combat.battle_details, strict=True)
                refs.extend(source.region_id for source in details.sources)
        if not set(refs) <= ids:
            raise ValueError('History refers to unknown regions.')
        if report.replay_before is not None:
            restored = _restore(state, entry['replay_before'])
            if restored.turn != report.turn:
                raise ValueError('Replay turn mismatch.')
    # Never trust uploaded persistence/index metadata. create() recomputes it.
    raw.update(journal=False, replay_start=None, replay_indexed=False)
    engine = store._decode(json.dumps(raw))
    engine.state = state
    return engine
