from .mediterranean import PRESET as MEDITERRANEAN
from .europe import PRESET as EUROPE
from .central_asia import PRESET as CENTRAL_ASIA
from .india import PRESET as INDIA
from .southeast_asia_oceania import PRESET as SOUTHEAST_ASIA
from .americas import PRESET as AMERICAS
from .africa_middle_east import PRESET as AFRICA_MIDDLE_EAST

from .balochistan_borderlands_expanded import PRESET as BALOCHISTAN_BORDERLANDS

from .battles import PRESETS as BATTLES

# Registry: id → preset dict
SOURCE_PRESETS = {
    p["id"]: p
    for p in [
        MEDITERRANEAN,
        EUROPE,
        AMERICAS,
        AFRICA_MIDDLE_EAST,
        CENTRAL_ASIA,
        BALOCHISTAN_BORDERLANDS,
        INDIA,
        SOUTHEAST_ASIA,
        *BATTLES,
    ]
}


# Compact presets use separate immutable assets; original definitions remain
# available to build tools and compatibility checks for existing saves.
import json
from pathlib import Path
_compact = Path(__file__).with_name('compact.json')
PRESETS = json.loads(_compact.read_text()) if _compact.exists() else SOURCE_PRESETS


def list_presets() -> list:
    """Return a list of available presets for display in the UI."""
    return [
        {
            "id": p["id"],
            "map_asset_id": p.get("map_asset_id", p["id"]),
            "name": p["name"],
            "description": p["description"],
            "category": p.get("category", "world"),
            "battle": {key: p["battle"][key] for key in ("date", "sides", "commanders", "context", "sources")} if "battle" in p else None,
            "region_count": len(p["regions"]),
        }
        for p in PRESETS.values()
    ]
