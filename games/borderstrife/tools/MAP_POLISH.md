# Map refinement — atlas_v4

The catalog uses atlas_v4 presentation assets, with Northeast Asia, Viking World and Greece/Persia/Egypt using atlas_v6. Earlier regional geometry and thumbnails remain bundled for saved campaigns. Region names/counts, terrain rules, opening forces, capitals and route graphs are unchanged. The builder rejects changes to pairwise geographic adjacency.

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
| Northeast Asia | Expanded to 30 regions spanning Japan, Korea, Manchuria and the Russian Pacific frontier, with new coastlines, Amur river context and sea connections. |
| British & Irish Isles | Relief and vegetation treatment, clearer rivers and crossings. |
| Anatolia & the Caucasus | Continuous mountain hachures, strait connections and contextual neighboring land. |
| Nile Valley & the Horn | Stronger river contrast; cropped inland borders no longer sit against ocean. |

Landmarks, vegetation and regional relief remain illustrative. They are not surveyed historical reconstructions. Muted surrounding land is explicitly labeled as non-playable in map settings; it never enters hit-testing, supply or movement. Atmospheric waves exclude that land through a cached raster mask. Landmark drawing is cached with the terrain rather than repeated during pointer movement.

## Campaign pacing

Investigation reproduced idle interior troops in a stalled Japan & Korea campaign. The campaign AI previously skipped reinforcement through quiet friendly regions while ahead in total army strength. It now routes reserves along owned territory toward reachable hostile borders, including neutral frontiers. Friendly frontline consolidation gathers into the larger stack rather than exchanging stacks. Combat probabilities, recruitment and map route graphs are unchanged.

`pacing-comparison.json` records the same eight deterministic seeds on each of the two retained flagged maps. Unfinished campaigns at the 60-turn observation cutoff decreased from 16/16 to 10/16. Longer campaigns still occur; this is evidence of improved reinforcement behavior, not a guarantee of short games or human competitive balance. `opening-playtest-report.json` contains the retained regional runs.

## Reproduction and verification

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.build_polished_maps /path/to/provinces.zip
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.build_thumbnails
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s games/borderstrife/tests -q
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.check_reviewed_maps
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.check_compact_borders
```

An optional final map ID rebuilds one map. Sources are the bundled version-3 assets and the same Natural Earth archive used for previous maps; no network requests are needed. GIS and image dependencies are build-time only.

Validation includes scenario/route equality against version 3, geographic adjacency, every shared border, old saves/replays, all 12 regional theaters in the browser, mobile/dark rendering, display controls and cached-render performance. Campaign-AI regressions cover forwarding while ahead, friendly-cycle avoidance and blocked routes through enemy territory.

Published versioned atlas, geography and thumbnail files cannot be overwritten with different content. Increment the asset version in the builder when changing a map and retain older files for saves. Deploy the website assets before switching the API catalog to the new version.
