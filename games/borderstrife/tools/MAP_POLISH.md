# Map refinement — atlas_v4

All 35 maps use new presentation assets. The previous `atlas_v3` geometry, terrain and thumbnails remain bundled for saved campaigns. Region names/counts, terrain rules, opening forces, capitals and route graphs are unchanged. The builder rejects any change to pairwise geographic adjacency. Slight battlefield boundary warps and smoothed exposed shoreline corners are cartographic changes only.

## Changes by map

| Map | Applied improvements |
|---|---|
| Mediterranean | Surrounding land separates theater cutoffs from coasts; clearer sea lanes, relief and rivers. |
| Europe | Coherent mountain hachures, lighter vegetation, contextual land and clearer crossings. |
| The Americas | More legible sea lanes and island connections; coherent mountain chains and terrain patches. |
| Africa & Middle East | Context beyond the theater, stronger river contrast and less repetitive mountain marks. |
| Central Asia | Continuous relief spines replace repeated triangle fills; clearer rivers and contextual land. |
| Afghanistan, Balochistan & Indus | Hindu Kush relief and Indus contrast; excluded territory appears only as non-playable context. |
| Indian Subcontinent | Mountain spines, vegetation and river contrast; label placement and protected geographic coverage retained. |
| Southeast Asia & Oceania | Curved, stronger sea lanes, context islands and mountain spines. |
| Japan & Korea | Clearer sea lanes, rivers and mountain ranges. |
| British & Irish Isles | Relief and vegetation treatment, clearer rivers and crossings. |
| Anatolia & the Caucasus | Continuous mountain hachures, strait connections and contextual neighboring land. |
| Nile Valley & the Horn | Stronger river contrast; cropped inland borders no longer sit against ocean. |
| Andes & Pacific Coast | Alternating label callouts use the available horizontal space without stretching geography; adjacent land provides context. |
| Caribbean & Central America | Clearer curved sea lanes and their endpoints; surrounding islands and mainland context. |
| Waterloo | Distinct farm clusters, stronger ridge rendering, contrast and counter separation. |
| Sekigahara | Valley relief and approach lines; counter spacing retains geographic anchor leaders. |
| Hastings | Ridge visibility, camp artwork, context and terrain contrast. |
| Hattin | Springs and Horns artwork, clearer approaches and contrast. |
| Gettysburg | Larger recognizable farms/ridge, counter separation and existing portrait framing. |
| First Panipat | Gently warped sectors, prominent wagon frontage and camp/flag groups. |
| Austerlitz | Stronger ridge/bridge rendering, contrast and counter separation. |
| Antietam | Bridges stay on geographic anchors; counters move independently, with leader lines. |
| Cannae | Gently warped sectors and clearer battle fronts, camps and river contrast. |
| Naseby | Gently warped sectors, strong hedge/ridge treatment and camp groups. |
| Crusader States | Real surrounding land, stronghold artwork and clearer mountain/river context. |
| Civil War: Eastern Theater | Appalachian relief, rivers and settlement groups; neighboring land is not painted as sea. |
| Rome vs Carthage | Clearer Mediterranean lanes, mountain spines and surrounding geographic context. |
| Sengoku Japan | Mountain spines, river contrast and consistent marker/label spacing. |
| Constantinople | Urban blocks clipped to districts, prominent walls/gates and landmark palace artwork. |
| Chittorgarh | Fort footprints, stronger perimeter/gates and separation of counters from landmark anchors. |
| Malta | Bastioned fort symbols, harbors/ships, improved shoreline compositing and counter separation. |
| Kurukshetra | Gently warped sectors, distinct camps, standards and chariot-ground symbols. |
| Troy & the Troad | Smoothed shoreline corners, terrain alpha at the coast, citadel/gates and ship groups; the void-free DEM remains unchanged. |
| Lanka | Canopy clusters and central relief, palace and fortified landing-camp artwork. |
| Emberfall | Regenerated illustrated terrain with individual relief peaks, clustered canopies, a finer river, volcanic landmark and distinct settlements. |

Landmarks, vegetation and regional relief remain illustrative. They are not surveyed historical reconstructions. Muted surrounding land is explicitly labeled as non-playable in map settings; it never enters hit-testing, supply or movement. Atmospheric waves exclude that land through a cached raster mask. Landmark drawing is cached with the terrain rather than repeated during pointer movement.

## Campaign pacing

Investigation reproduced idle interior troops in a stalled Japan & Korea campaign. The campaign AI previously skipped reinforcement through quiet friendly regions while ahead in total army strength. It now routes reserves along owned territory toward reachable hostile borders, including neutral frontiers. Friendly frontline consolidation gathers into the larger stack rather than exchanging stacks. Historical-battle AI, combat probabilities, recruitment and all map route graphs are unchanged.

`pacing-comparison.json` records the same eight deterministic seeds on each of the five flagged maps. Unfinished campaigns at the 60-turn observation cutoff decreased from 40/40 to 25/40. Longer campaigns still occur; this is evidence of improved reinforcement behavior, not a guarantee of short games or human competitive balance. `opening-playtest-report.json` contains all 280 current runs.

## Reproduction and verification

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.build_polished_maps /path/to/provinces.zip
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.build_thumbnails
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s games/borderstrife/tests -q
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.check_reviewed_maps
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.check_compact_borders
```

An optional final map ID rebuilds one map. Sources are the bundled version-3 assets and the same Natural Earth archive used for previous maps; no network requests are needed. GIS and image dependencies are build-time only.

Validation includes scenario/route equality against version 3, geographic adjacency, every shared border, old saves/replays, all 35 maps in the browser, mobile/dark rendering, display controls and cached-render performance. Campaign-AI regressions cover forwarding while ahead, friendly-cycle avoidance and blocked routes through enemy territory.
