import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from games.imperium.api import store
from games.imperium.api.routes import TurnRequest, submit_turn
from games.imperium.engine.game_engine import GameEngine
from games.imperium.engine.models import GameState, MapSize, Move, Owner, Player, Region, TerrainType, TurnActions
from games.imperium.engine.standing_orders import prepare, finish, normalize
from games.imperium.engine.turn_resolver import resolve_turn, ValidationError


def position():
    regions = {i: Region(i, f'Region {i}', TerrainType.PLAINS,
                        Owner.PLAYER_1 if i < 4 else Owner.PLAYER_2,
                        20, [j for j in (i-1, i+1) if 0 <= j <= 5], i in (0,5)) for i in range(6)}
    return GameState(regions, [Player('player_1','You',False,0), Player('player_2','Rival',False,5)], 1, MapSize.SMALL)


def plan(path, kind='reinforce', **kwargs):
    return dict(id='route', path=path, kind=kind, paused=False, **kwargs)


def turn(state, moves=None, plans=None, enemy=None):
    orders, effective, running, events = prepare(state, moves or [], plans)
    result = resolve_turn(state, TurnActions('player_1',effective), TurnActions('player_2',enemy or []),seed=2)
    finish(state,orders,running,result,events)
    return result


class StandingOrderTests(unittest.TestCase):
    def test_repeat_stays_at_source_and_never_attacks(self):
        state=position()
        turn(state,plans=[plan([0,1])])
        result=turn(state)
        self.assertEqual(state.standing_orders[0]['path'],[0,1])
        self.assertIn((0,1,4),result.movements)
        state.regions[1].owner=Owner.PLAYER_2
        result=turn(state)
        self.assertFalse(result.movements)
        self.assertTrue(state.standing_orders[0]['paused'])

    def test_manual_override_pause_resume_and_cancel(self):
        state=position()
        result=turn(state,moves=[Move(1,0)],plans=[plan([1,2])])
        self.assertTrue(state.standing_orders[0]['paused'])
        self.assertIn('priority',result.events[-1]['message'])
        order=state.standing_orders[0];order['paused']=False
        turn(state)
        self.assertFalse(state.standing_orders[0]['paused'])
        turn(state,plans=[])
        self.assertEqual(state.standing_orders,[])

    def test_removed_orders_in_existing_save_are_ignored(self):
        state=position();state.standing_orders=[plan([0,1,2],kind='march')]
        result=turn(state)
        self.assertFalse(result.movements)
        self.assertEqual(state.standing_orders,[])
        with self.assertRaises(ValueError):
            TurnRequest(moves=[],standing_orders=[plan([0,1],kind='march')])

    def test_invalid_routes_rejected(self):
        for orders in ([plan([0,2])],[plan([0,1,2])],[plan([0,0])],[plan([0,99])],
                       [plan([0,1]),plan([1,2])]):
            with self.assertRaises(ValidationError):prepare(position(),[],orders)

    def test_lost_source_pauses_but_empty_army_waits(self):
        state=position();state.regions[0].owner=Owner.PLAYER_2
        turn(state,plans=[plan([0,1])]);self.assertTrue(state.standing_orders[0]['paused'])
        state=position();state.regions[0].army=0;state.regions[0].reinforcement_rate=0
        turn(state,plans=[plan([0,1])]);self.assertFalse(state.standing_orders[0]['paused'])

    def test_empty_source_forwards_later_arrivals_without_manual_resume(self):
        state=position()
        for region in state.regions.values():region.reinforcement_rate=0
        state.regions[1].army=0
        turn(state,moves=[Move(0,1)],plans=[plan([1,2])])
        self.assertEqual(state.regions[1].army,20)
        self.assertFalse(state.standing_orders[0]['paused'])
        result=turn(state)
        self.assertIn((1,2,20),result.movements)
        self.assertFalse(state.standing_orders[0]['paused'])

    def test_empty_recruiting_source_can_override_repeat(self):
        state=position();state.regions[1].army=0
        self.assertIn(1,GameEngine(state).get_valid_moves('player_1'))
        result=turn(state,moves=[Move(1,0)],plans=[plan([1,2])])
        self.assertIn((1,0,4),result.movements)
        self.assertTrue(state.standing_orders[0]['paused'])
        state.regions[1].army=0;state.regions[1].reinforcement_rate=0
        self.assertNotIn(1,GameEngine(state).get_valid_moves('player_1'))

    def test_old_duplicate_sources_are_compacted_and_new_duplicates_rejected(self):
        old=plan([1,0]);old['paused']=True
        current=plan([1,2]);current['id']='current'
        stale=plan([1,0]);stale.update(id='stale',paused=True)
        self.assertEqual(normalize([old,current,stale]),[current])
        state=position();state.standing_orders=[old,current,stale]
        turn(state)
        self.assertEqual(len(state.standing_orders),1)
        self.assertEqual(state.standing_orders[0]['id'],'current')
        with self.assertRaises(ValidationError):prepare(state,[],[old,current])

    def test_save_reload_and_duplicate_turn(self):
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ,{'IMPERIUM_DB_PATH':str(Path(temp)/'test.db'),'DATABASE_URL':''}):
            state=position();state.players[1].is_ai=True
            gid=store.create(GameEngine(state))
            request=TurnRequest(moves=[],expected_turn=1,standing_orders=[plan([0,1])])
            submit_turn(gid,request)
            self.assertEqual(store.get(gid).state.standing_orders[0]['path'],[0,1])
            with self.assertRaises(HTTPException) as error:submit_turn(gid,request)
            self.assertEqual(error.exception.status_code,409)
            result=submit_turn(gid,TurnRequest(moves=[],expected_turn=2))
            self.assertEqual(result['state']['standing_orders'][0]['path'],[0,1])


if __name__=='__main__':unittest.main()
