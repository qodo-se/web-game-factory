"""Campaign reserves must reach the frontier without friendly swap cycles."""
import unittest
from unittest.mock import patch
from games.borderstrife.engine.ai import decide_actions
from games.borderstrife.engine.models import GameState,Region,Owner,TerrainType,MapSize,Player
from games.borderstrife.engine.turn_resolver import validate_actions


def line():
    regions={i:Region(i,str(i),TerrainType.PLAINS,Owner.PLAYER_1 if i<3 else Owner.PLAYER_2,
                     [500,10,10,30][i],neighbors=[n for n in [i-1,i+1] if 0<=n<4]) for i in range(4)}
    return GameState(regions,[Player('player_1','A',False,0),Player('player_2','B',True,3)],1,MapSize.SMALL)


class ReserveTests(unittest.TestCase):
    @patch('games.borderstrife.engine.ai.IMPERFECTION_RATE',0)
    def test_aggressive_army_forwards_interior_reserves(self):
        state=line()
        actions=decide_actions(state,'player_1',seed=1)
        self.assertIn((0,1),[(m.from_region_id,m.to_region_id) for m in actions.moves])
        validate_actions(state,actions)

    @patch('games.borderstrife.engine.ai.IMPERFECTION_RATE',0)
    def test_no_friendly_cycles_or_moves_away_from_frontier(self):
        for army in [50,500,5000]:
            state=line();state.regions[3].army=army
            actions=decide_actions(state,'player_1',seed=1)
            moves={m.from_region_id:m.to_region_id for m in actions.moves}
            for start in moves:
                seen=set();current=start
                while current in moves:
                    self.assertNotIn(current,seen)
                    seen.add(current);current=moves[current]
            self.assertNotIn((1,0),moves.items())

    @patch('games.borderstrife.engine.ai.IMPERFECTION_RATE',0)
    def test_no_reinforcement_through_enemy_region(self):
        state=line();state.regions[1].owner=Owner.PLAYER_2;state.regions[1].army=100000
        actions=decide_actions(state,'player_1',seed=1)
        self.assertFalse(any(m.from_region_id==0 for m in actions.moves))
        validate_actions(state,actions)

    @patch('games.borderstrife.engine.ai.IMPERFECTION_RATE',0)
    def test_equal_frontline_stacks_do_not_exchange_places(self):
        state=line()
        for i in [0,1]:
            state.regions[i].army=100
            state.regions[i].neighbors.append(3)
            state.regions[3].neighbors.append(i)
        state.regions[3].army=100000
        actions=decide_actions(state,'player_1',seed=1)
        moves={(m.from_region_id,m.to_region_id) for m in actions.moves}
        self.assertIn((1,0),moves)
        self.assertNotIn((0,1),moves)
        validate_actions(state,actions)
