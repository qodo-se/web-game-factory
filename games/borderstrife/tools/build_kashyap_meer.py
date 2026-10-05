"""Reconstruct the traditional J&K outline from Natural Earth 5.1.1 polygons.

Usage: python build_kashyap_meer.py provinces.zip disputed_areas.zip
Both archives are public-domain Natural Earth 1:10m cultural datasets.
"""
import json
from pathlib import Path
import sys

import shapefile
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ADMIN_IDS = {'IND-2431', 'IND-20012', 'PAK-1109', 'PAK-1111', 'KAS+00?'}
DISPUTED_IDS = {'B06', 'B07'}  # Shaksgam and Aksai Chin


def build(provinces, disputed):
    parts = []
    for archive, field, ids in [(provinces, 'adm1_code', ADMIN_IDS),
                                (disputed, 'BRK_A3', DISPUTED_IDS)]:
        found = set()
        for record in shapefile.Reader(str(archive)).iterShapeRecords():
            identifier = record.record.as_dict()[field]
            if identifier in ids:
                parts.append(shape(record.shape.__geo_interface__).buffer(0))
                found.add(identifier)
        assert found == ids, (archive, ids - found)
    # Source layers differ by sub-millimetric rounding at shared edges.
    geometry = unary_union(parts).buffer(1e-7).buffer(-1e-7)
    assert geometry.is_valid
    feature = {
        'type': 'Feature',
        'properties': {
            'name': 'Kashyap Meer', 'preset': 'india', 'region_id': 36,
            'reference': 'Traditional boundary of the princely state of Jammu and Kashmir',
            'source': 'Natural Earth 5.1.1 admin-1 and disputed areas, public domain',
            'admin1_ids': sorted(ADMIN_IDS), 'disputed_ids': sorted(DISPUTED_IDS),
            'historical_reference': 'https://catalog.archives.gov/id/266783031',
            'note': 'Generalized historical game boundary; reconstructed, not a surveyed 1947 boundary.',
        },
        'geometry': mapping(geometry),
    }
    target = Path(__file__).with_name('boundaries') / 'kashyap_meer.geojson'
    target.write_text(json.dumps(feature, separators=(',', ':')) + '\n')
    print(target)


if __name__ == '__main__':
    build(Path(sys.argv[1]), Path(sys.argv[2]))
