"""
Quick simulation to verify the Imperium game engine end-to-end.
Both players run as AI so we can watch a full game play out.

Usage:
    cd games/borderstrife
    pip install -r requirements.txt
    python demo.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

from games.borderstrife.engine.game_engine import GameEngine
from games.borderstrife.engine.models import MapSize


def print_bar(label: str) -> None:
    print(f"\n{'─' * 50}")
    print(f"  {label}")
    print(f"{'─' * 50}")


def main(seed: int = 42, map_size: MapSize = MapSize.SMALL, max_turns: int = 60):
    engine = GameEngine.new_game(
        map_size=map_size,
        player1_name="Rome",
        player2_name="Carthage",
        player1_is_ai=True,
        player2_is_ai=True,
        seed=seed,
    )

    print_bar(f"IMPERIUM  |  {map_size.value.upper()} map  |  seed={seed}")
    s = engine.summary()
    print(f"  Total regions : {len(engine.state.regions)}")
    print(f"  Rome capital  : region {s['player_1']['capital']}")
    print(f"  Carthage cap  : region {s['player_2']['capital']}")

    for turn in range(1, max_turns + 1):
        if engine.state.game_over:
            break

        summary = engine.resolve_turn(seed=seed + turn)

        battles = summary.combat_results
        won = sum(1 for b in battles if b.attacker_won)
        lost = len(battles) - won

        s = engine.summary()
        print(
            f"  Turn {summary.turn:>3}  |  "
            f"Rome {s['player_1']['regions']:>2}r {s['player_1']['total_army']:>5}a  |  "
            f"Carthage {s['player_2']['regions']:>2}r {s['player_2']['total_army']:>5}a  |  "
            f"Rogue {s['rogue_regions']:>2}  |  "
            f"Battles {len(battles)} (won {won} / lost {lost})"
        )

    print_bar("GAME OVER")
    s = engine.summary()
    if s["winner"]:
        winner_name = s["player_1"]["name"] if s["winner"] == "player_1" else s["player_2"]["name"]
        print(f"  Winner: {winner_name}  (turn {engine.state.turn - 1})")
    else:
        print(f"  No winner after {max_turns} turns.")


if __name__ == "__main__":
    main()
