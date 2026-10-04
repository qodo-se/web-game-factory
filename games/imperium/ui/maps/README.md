# Preset atlas data

These files are bundled with the static site: gameplay does not need a map API,
external tiles, a CDN, or GIS libraries.

Source: Natural Earth **1:10m Admin 1 – States, provinces**, version 5.1.1,
public domain: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/

Download: https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_1_states_provinces.zip

The atlas uses a local equirectangular projection corrected at each theater's
middle latitude. The renderer preserves its proportions as the viewport changes.
Coastlines and province boundaries come from the source dataset; inland waters
are retained where present in that dataset. Boundary simplification preserves
shared edges. This is a generalized game atlas, not a survey map.

Historical territory names are **not** claims to exact historical boundaries.
The presets have no common historical date. Modern province polygons are grouped
by proximity to manually placed geographic anchors. When multiple anchors share
a province, that province is divided between them. The result approximates each
playable territory, while preserving real geographic outlines. Some peripheral
land and islands belong to the nearest playable territory. Land adjacency now follows shared territory borders. Explicit sea lanes and
short connections between isolated components keep islands playable. The
strategy-map builder classifies river crossings, mountain passes, and sea
landings; starting ownership stays as defined by each preset.

To regenerate, install `shapely==2.1.2` and `pyshp==3.1.6` in a development
virtual environment, download the archive above, then run from the repo root:

```sh
python games/imperium/tools/build_maps.py /path/to/ne_10m_admin_1_states_provinces.zip
```

`tools/anchors.json` contains approximate longitude/latitude anchors in the same
order as each preset's region list. The generated data also includes names to
detect stale assets if the engine's region order changes.

Browser regression check (development dependency: Playwright with Chromium):

```sh
# Terminal 1, repository root:
python3 -m http.server 8765
# Terminal 2, with playwright available to Node:
node games/imperium/tools/check_atlas.cjs
```

This uses local API fixtures to verify all eight atlases at three viewport sizes,
marker selection, empty water, move planning/cancellation, replacement of state
on a new turn, and the procedural renderer fallback. It does not test the backend
turn resolver. Override `IMPERIUM_TEST_URL` to test a different static server.

## Kashyap Meer (India, region 36)

Kashyap Meer uses a fixed reconstruction of the traditional pre-1947 princely
state of Jammu and Kashmir, with its counter anchored near Srinagar. It combines
Jammu and Kashmir, Ladakh, Azad Kashmir, Gilgit-Baltistan (called Northern Areas
in the dataset), Siachen, Aksai Chin, and Shaksgam. Internal present-day lines are
dissolved. The source is generalized and the historical outline is approximate.

Reference: the traditional-boundary outline in the CIA map preserved by the
[US National Archives](https://catalog.archives.gov/id/266783031), also available
[on Wikimedia Commons](https://commons.wikimedia.org/wiki/File:The_Disputed_Area_of_Kashmir_-_DPLA_-_de6615f5f1a948b94cf6c28bb01bcf7c.jpg).

The fixed geometry is in `tools/boundaries/kashyap_meer.geojson`. It is carved
out of the existing geographic assignments before shared-edge simplification;
it does not participate in proximity assignment or absorb neighboring provinces.
Its engine ID is appended so earlier IDs and starting capitals remain stable.
It starts as neutral hills with routes to Taxila and Punjab. Start a new India
campaign to use the 37-region map; older 36-region campaigns cannot use it.

To rebuild the source outline, also download Natural Earth's public-domain
[1:10m disputed areas archive](https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_disputed_areas.zip), then run:

```sh
python games/imperium/tools/build_kashyap_meer.py provinces.zip disputed_areas.zip
python games/imperium/tools/build_maps.py provinces.zip india
```

The boundary builder records the exact source feature IDs in the GeoJSON.

## Map navigation

Preset and random maps support cursor-centered wheel/trackpad pinch zoom (1–5×),
left-button or middle-button drag to pan, horizontal scrolling, Shift+scroll to
pan, and fixed +/−/Reset view controls. Focus the map to use +/−, arrow keys, and
0/Home to reset. Camera position survives turns and adjusts on viewport resize.
Dragging suppresses territory clicks. Atlas geometry is repainted at higher
resolution after zoom gestures settle.

To exercise creation, zoom/pan, move planning, turn submission, resizing, and
random maps against the running local API and UI:

```sh
node games/imperium/tools/check_map_camera.cjs
```

Defaults are UI `http://localhost:3000` and API `http://127.0.0.1:8080`;
override `IMPERIUM_TEST_URL` and `IMPERIUM_TEST_API` if necessary. Pinch coverage
simulates the browser's Ctrl+wheel events, rather than physical touchpad hardware.


## Rivers and geographic gameplay routes

After regenerating atlas geometry, run:

```sh
python games/imperium/tools/build_strategy_maps.py /path/to/ne_10m_rivers_lake_centerlines.zip
```

Source: [Natural Earth rivers and lake centerlines, 1:10m](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/),
version 5.0.0, public domain. The builder includes major river segments up to
scale rank 5, writes river drawing data to the atlas files, and writes adjacency,
crossing types, and ports to `engine/presets/geography/`. Both outputs must be
shipped together. Land edges follow shared boundaries; islands use authored or
short connecting sea routes. A route is classified from the line between region
anchors, so these are generalized gameplay routes, not surveyed historic roads.
Kashyap Meer retains its explicit Taxila/Punjab connections.

Hill marks are symbolic terrain shading, not elevation measurements. River
geometry is sourced; sea-label positions are manually placed.
