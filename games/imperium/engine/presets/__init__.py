from .mediterranean import PRESET as MEDITERRANEAN
from .europe import PRESET as EUROPE
from .central_asia import PRESET as CENTRAL_ASIA
from .india import PRESET as INDIA
from .southeast_asia_oceania import PRESET as SOUTHEAST_ASIA
from .americas import PRESET as AMERICAS
from .africa_middle_east import PRESET as AFRICA_MIDDLE_EAST

# Registry: id → preset dict
PRESETS = {
    p["id"]: p
    for p in [
        MEDITERRANEAN,
        EUROPE,
        AMERICAS,
        AFRICA_MIDDLE_EAST,
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
