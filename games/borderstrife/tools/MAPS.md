# Current catalog

The 11 regional and five historical theaters are selectable; see [COLLECTIONS.md](COLLECTIONS.md). The original source geometry and build notes below describe earlier regional versions retained for save compatibility. Current playable maps contain 24–30 regions.

# Campaign geography

Start with the [map overview and interaction guide](../ui/maps/README.md).
This document covers the active collection and asset generation.

Historical Battles are documented separately in [BATTLES.md](BATTLES.md), including sources, approximations, rules and asset generation.

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
python games/borderstrife/tools/build_maps.py /path/to/provinces.zip americas
python games/borderstrife/tools/build_strategy_maps.py /path/to/rivers.zip americas
python -m games.borderstrife.tools.build_thumbnails
```

Use `africa_middle_east` or `southeast_asia_oceania` for the other expanded maps.
Build tools require Shapely 2.1+ and pyshp, in addition to the engine dependencies.
Geometry, routes, and thumbnails are bundled; the browser needs no GIS library
or third-party map service. Thumbnail images are lightweight SVGs generated
from the actual territory polygons.

## Afghanistan, Balochistan & Indus

`balochistan_borderlands_expanded` has 69 territories: 29 across all of Afghanistan,
31 in Pakistani Balochistan, Sindh, Punjab and the Pakistan–Afghanistan border belt, and nine
in Iran's Sistan and Baluchestan province. The Iranian sectors are Zabol,
Zahedan, Khash, Saravan, Iranshahr, Bampur, Sarbaz, Nikshahr and Chabahar.
Sistan is included as the adjoining Afghanistan–Iran border area, not described
as uniformly Baloch. Regional context: [Encyclopaedia Iranica's geography of
Balochistan](https://www.iranicaonline.org/articles/baluchistan-index/baluchistan-i/).

The preset's `source_provinces` pins the Natural Earth admin-1 IDs included in
the theater. Gilgit–Baltistan, Kashmir and
other Iranian provinces are excluded from land geometry rather than merely
having their labels removed. Source FATA boundaries are used as geographic
pieces, not presented as current administrative units. Country assignment is
preserved during sector generation. Outer coastlines and province boundaries
come from Natural Earth; internal sectors are gameplay divisions rather than
surveyed districts or ethnic boundaries. Normal world campaign rules apply.
Recommended starts are Quetta and Zahedan; players can choose other regions.

Rebuild with `balochistan_borderlands_expanded` as the final argument to `build_maps.py`
and `build_strategy_maps.py`, then regenerate thumbnails. The earlier
`pakistan_afghanistan` and `balochistan_borderlands` presets, atlases and routes are retained for existing local
campaigns but are no longer offered in the new-game catalog.

Sindh adds Karachi, Hyderabad, Thatta, Sukkur and Thar. Pakistani Punjab adds
Lahore, Multan, Bahawalpur, Faisalabad, Sargodha, Rawalpindi and Dera Ghazi Khan.
The frame includes the southern Sindh coast, Punjab’s eastern boundary and
all of Afghanistan, including the northern provinces and the Wakhan corridor.


## Compact campaign collection

New regional campaigns use 24–30 merged regions. Historical battle deployments
stay at 16–22 sectors. All shared land borders allow movement, without an artificial neighbor cap.
Point-only contacts do not count as borders. Essential original crossings join
separate land masses; redundant sea links are removed. Each map and both
historical deployments remain connected.

`build_compact_maps.py` merges neighboring land polygons without changing the
coastline or geographic coverage. Kashyap Meer remains an unmerged territory.
Dwarka, Ahom, Balochistan, Lanka and recommended capitals retain their names.
Borderland regions never merge across their source country assignments.

Rebuild from the pinned original bundled assets:

```sh
.venv/bin/python -m games.borderstrife.tools.build_compact_maps
.venv/bin/python -m games.borderstrife.tools.build_thumbnails
```

The generated `engine/presets/compact.json` supplies the active catalog;
`compact-map-report.json` records every grouping and before/after route count.
Shapely is a build dependency only. No runtime GIS work is added.

Public preset IDs stay unchanged. New saves record `map_asset_id`, referring to
separate `_compact` geography and thumbnails. Saves without this field load the
original atlas, keeping their region IDs, routes, orders and replays intact.
Do not delete original assets or overwrite released geometry with incompatible
boundaries; a future incompatible revision needs its own asset ID.
