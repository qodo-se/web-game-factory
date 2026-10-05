import concurrent.futures
import json
import os
from pathlib import Path
import random
import subprocess
import tempfile
import unittest
from unittest.mock import patch, AsyncMock, MagicMock

from games.borderstrife.api import store
from games.borderstrife.api.routes import submit_turn, TurnRequest, MoveIn
from games.borderstrife.engine.combat import resolve_combat
from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import Region, Owner, TerrainType, GameState, MapSize, Player, TurnActions, Move
from games.borderstrife.engine.presets import PRESETS
from games.borderstrife.engine.strategy import supplied_regions, growth, forecast, win_probability
from games.borderstrife.engine.turn_resolver import resolve_turn


def scenario():
    regions={
        0:Region(0,'Home',TerrainType.CITY,Owner.PLAYER_1,100,[1,2],True),
        1:Region(1,'Outpost',TerrainType.PLAINS,Owner.PLAYER_1,20,[0,2]),
        2:Region(2,'Enemy',TerrainType.HILLS,Owner.PLAYER_2,100,[0,1,3],True),
        3:Region(3,'Reserve',TerrainType.PLAINS,Owner.PLAYER_2,20,[2]),
    }
    return GameState(regions,[Player('player_1','You',False,0),Player('player_2','AI',False,2)],1,MapSize.SMALL)


class StrategyTests(unittest.TestCase):
    def test_supply_can_be_cut_and_restored(self):
        state=scenario()
        state.regions[0].neighbors=[1]
        state.regions[1].neighbors=[0,2]
        state.regions[3].owner=Owner.PLAYER_1
        self.assertNotIn(3,supplied_regions(state))
        self.assertEqual(growth(state.regions[3],supplied_regions(state)),2)
        state.regions[2].owner=Owner.PLAYER_1
        self.assertIn(3,supplied_regions(state))
        self.assertEqual(growth(state.regions[3],supplied_regions(state)),4)
        state.regions[2].owner=Owner.PLAYER_2
        self.assertNotIn(3,supplied_regions(state))

    def test_stronger_armies_are_reliably_favored(self):
        self.assertEqual(win_probability(300,100),.9)
        state=scenario();rng=random.Random(10)
        results=[resolve_combat(state.regions[0],state.regions[2],300,rng,defense_multiplier=1) for _ in range(5000)]
        self.assertTrue(.88<sum(r.attacker_won for r in results)/len(results)<.92)
        self.assertTrue(all(0<=r.attacker_survivors<=300 and 0<=r.defender_survivors<=100 for r in results))

    def test_forecast_combines_orders_and_crossings(self):
        state=scenario();state.routes={'0:2':'river','1:2':'pass'}
        result=forecast(state,[Move(0,2),Move(1,2)])[0]
        self.assertEqual(result['army'],136)  # 100+12 plus 20+4
        self.assertAlmostEqual(result['effective_attack'],round(112/1.2+24/1.15,1))
        self.assertEqual(result['crossings'],['pass','river'])
        self.assertEqual(result['effective_defense'],178.5)
        self.assertAlmostEqual(result['win_probability'],win_probability(112/1.2+24/1.15,178.5),places=3)

    def test_defeated_attackers_retreat_after_battles(self):
        state=scenario();state.regions[0].army=10;state.regions[2].army=1000
        summary=resolve_turn(state,TurnActions('player_1',[Move(0,2)]),TurnActions('player_2',[]),seed=2)
        battle=summary.combat_results[0]
        self.assertFalse(battle.attacker_won)
        self.assertEqual(battle.retreat_region_id,0)
        self.assertEqual(state.regions[0].army,battle.retreated)
        self.assertEqual(summary.events[-1]['type'],'retreat')

    def test_no_retreat_into_captured_origins(self):
        state=scenario();state.regions[0].army=1;state.regions[1].army=1
        state.regions[2].army=10000;state.regions[3].army=10000
        state.regions[3].neighbors=[2,0,1];state.regions[0].neighbors.append(3);state.regions[1].neighbors.append(3)
        summary=resolve_turn(state,TurnActions('player_1',[Move(0,2)]),TurnActions('player_2',[Move(2,0),Move(3,1)]),seed=0)
        for result in summary.combat_results:
            if result.retreated:
                loser=result.defender_owner if result.attacker_won else result.attacker_owner
                self.assertEqual(state.regions[result.retreat_region_id].owner.value,loser)
        self.assertTrue(all(r.army>=0 for r in state.regions.values()))

    def test_army_accounting_in_simultaneous_battles(self):
        for seed in range(40):
            state=scenario();before=sum(r.army for r in state.regions.values())
            summary=resolve_turn(state,TurnActions('player_1',[Move(0,2),Move(1,2)]),TurnActions('player_2',[Move(3,0)]),seed=seed)
            losses=sum(c.attacker_army-c.attacker_survivors+c.defender_army-c.defender_survivors for c in summary.combat_results)
            self.assertEqual(sum(r.army for r in state.regions.values()),before+sum(summary.population_generated.values())-losses)

    def test_all_presets_have_connected_symmetric_geographic_routes(self):
        for key in PRESETS:
            state=GameEngine.from_preset(key).state
            seen={0};queue=[0]
            for r in state.regions.values():
                for neighbor in r.neighbors:
                    self.assertIn(r.id,state.regions[neighbor].neighbors)
                    self.assertIn(f'{min(r.id,neighbor)}:{max(r.id,neighbor)}',state.routes)
            while queue:
                for neighbor in state.regions[queue.pop()].neighbors:
                    if neighbor not in seen:seen.add(neighbor);queue.append(neighbor)
            self.assertEqual(len(seen),len(state.regions),key)
            for key,kind in state.routes.items():
                if kind=='sea':
                    self.assertTrue(set(map(int,key.split(':')))<=set(state.ports))


class PersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.env=patch.dict(os.environ,{'IMPERIUM_DB_PATH':str(Path(self.temp.name)/'campaigns.db'),'DATABASE_URL':''})
        self.env.start()
    def tearDown(self):
        self.env.stop();self.temp.cleanup()

    def test_saved_turn_and_timeline_survive_new_process(self):
        engine=GameEngine.from_preset('india');engine.campaign_name='Northern frontier'
        gid=store.create(engine)
        result=submit_turn(gid,TurnRequest(moves=[],expected_turn=1))
        loaded=store.get(gid)
        self.assertEqual(loaded.state.turn,2)
        self.assertEqual(loaded.history[0]['events'],result['events'])
        script=f"from games.borderstrife.api import store; e=store.get({gid!r}); print(e.state.turn, e.campaign_name, len(e.history))"
        output=subprocess.check_output([os.sys.executable,'-c',script],text=True,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})
        self.assertIn('2 Northern frontier 1',output)

    def test_stale_turn_cannot_commit_twice(self):
        gid=store.create(GameEngine.from_preset('india'))
        a=store.get(gid);b=store.get(gid)
        a.state.turn=2;b.state.turn=2
        store.save(gid,a,1)
        with self.assertRaises(store.ConflictError):store.save(gid,b,1)
        self.assertEqual(store.get(gid).state.turn,2)

    def test_concurrent_commit_has_one_winner(self):
        gid=store.create(GameEngine.from_preset('india'))
        candidates=[store.get(gid) for _ in range(2)]
        for e in candidates:e.state.turn=2
        def commit(e):
            try:store.save(gid,e,1);return True
            except store.ConflictError:return False
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            self.assertEqual(sum(pool.map(commit,candidates)),1)

    def test_failed_validation_does_not_mutate_save(self):
        gid=store.create(GameEngine.from_preset('india'))
        before=store._encode(store.get(gid))
        with self.assertRaises(Exception):submit_turn(gid,TurnRequest(moves=[MoveIn(from_region_id=999,to_region_id=0)],expected_turn=1))
        self.assertEqual(before,store._encode(store.get(gid)))

    def test_cloud_run_does_not_silently_use_ephemeral_storage(self):
        with patch.dict(os.environ,{'K_SERVICE':'test'}):
            with self.assertRaisesRegex(RuntimeError,'DATABASE_URL'):store.get('missing')


class PostgresAdapterTests(unittest.TestCase):
    def test_parameterized_update_and_connection_cleanup(self):
        connection=MagicMock()
        connection.execute=AsyncMock(return_value='UPDATE 1')
        connection.close=AsyncMock()
        url='postgresql://test.invalid/campaigns'
        with patch.dict(os.environ,{'DATABASE_URL':url}), patch.object(store,'_postgres_ready',{url}), patch('asyncpg.connect',new=AsyncMock(return_value=connection)):
            self.assertEqual(store._execute('UPDATE imperium_campaigns SET revision = ? WHERE id = ? AND revision = ?', (2,'id',1)),1)
        connection.execute.assert_awaited_once_with('UPDATE imperium_campaigns SET revision = $1 WHERE id = $2 AND revision = $3',2,'id',1)
        connection.close.assert_awaited_once()

    def test_connection_is_closed_on_database_error(self):
        connection=MagicMock()
        connection.fetch=AsyncMock(side_effect=RuntimeError('database unavailable'))
        connection.close=AsyncMock()
        url='postgresql://test.invalid/campaigns'
        with patch.dict(os.environ,{'DATABASE_URL':url}), patch.object(store,'_postgres_ready',{url}), patch('asyncpg.connect',new=AsyncMock(return_value=connection)):
            with self.assertRaisesRegex(RuntimeError,'database unavailable'):
                store._execute('SELECT payload FROM imperium_campaigns WHERE id = ?',('id',),fetch=True)
        connection.close.assert_awaited_once()


if __name__=='__main__':unittest.main()
