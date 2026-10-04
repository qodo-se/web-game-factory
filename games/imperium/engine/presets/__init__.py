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
PRESETS = {
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


def list_presets() -> list:
    """Return a list of available presets for display in the UI."""
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "description": p["description"],
            "category": p.get("category", "world"),
            "battle": {key: p["battle"][key] for key in ("date", "sides", "commanders", "context", "sources")} if "battle" in p else None,
            "region_count": len(p["regions"]),
        }
        for p in PRESETS.values()
    ]
