from .mediterranean import PRESET as MEDITERRANEAN
from .europe import PRESET as EUROPE
from .western_europe import PRESET as WESTERN_EUROPE
from .eastern_europe import PRESET as EASTERN_EUROPE
from .middle_east import PRESET as MIDDLE_EAST
from .central_asia import PRESET as CENTRAL_ASIA
from .india import PRESET as INDIA
from .southeast_asia import PRESET as SOUTHEAST_ASIA

# Registry: id → preset dict
PRESETS = {
    p["id"]: p
    for p in [
        MEDITERRANEAN,
        EUROPE,
        WESTERN_EUROPE,
        EASTERN_EUROPE,
        MIDDLE_EAST,
        CENTRAL_ASIA,
        INDIA,
        SOUTHEAST_ASIA,
    ]
}


def list_presets() -> list:
    """Return a list of available presets for display in the UI."""
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "description": p["description"],
            "region_count": len(p["regions"]),
        }
        for p in PRESETS.values()
    ]
