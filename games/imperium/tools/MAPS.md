# Campaign geography

The active map collection is defined in `engine/presets/__init__.py`. Older
presets and their atlas JSON remain bundled so existing saved campaigns can
still render. They are not offered for new campaigns. Random generation also
remains available to internal engine callers and old saves, but the public
creation API accepts only preset campaigns.

The Americas, Africa & Middle East, and Southeast Asia & Oceania use Natural
Earth 1:10m admin-1 geometry (5.1.1, public domain). Territories combine nearby
administrative provinces around the anchors in `anchors.json`; they are gameplay
regions, not a claim to exact historic political boundaries. `COUNTRIES` in
`build_maps.py` limits these theaters to the intended land areas. Rivers use
Natural Earth 1:10m rivers and lake centerlines (5.0.0).

Regenerate a map from the same locally downloaded shapefile archives:

```sh
python games/imperium/tools/build_maps.py /path/to/provinces.zip americas
python games/imperium/tools/build_strategy_maps.py /path/to/rivers.zip americas
python -m games.imperium.tools.build_thumbnails
```

Use `africa_middle_east` or `southeast_asia_oceania` for the other expanded maps.
Build tools require Shapely 2.1+ and pyshp, in addition to the engine dependencies.
Geometry, routes, and thumbnails are bundled; the browser needs no GIS library
or third-party map service. Thumbnail images are lightweight SVGs generated
from the actual territory polygons.
