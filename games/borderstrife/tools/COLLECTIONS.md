# BorderStrife map expansion

35 active maps in five categories. Every newly added map has 24 regions; India
and Central Asia now have 30. Existing battlefields retain their original sizes.
All saved games keep their own map asset IDs, terrain, rules and route graphs.

| Collection | Added maps | Rules |
|---|---|---|
| Regional Maps | Japan & Korea; British & Irish Isles; Anatolia & the Caucasus; Nile Valley & the Horn; Andes & Pacific Coast; Caribbean & Central America | Standard recruitment and conquest |
| Historical Battles | First Panipat (1526); Austerlitz (1805); Antietam (1862); Cannae (216 BCE); Naseby (1645) | Existing fixed forces, two selectable sides, three objectives and 20-turn limit |
| Historical Campaigns | The Crusader States (1187); Civil War: Eastern Theater (1863); Rome vs Carthage (218 BCE); Sengoku Japan (1560) | Period-inspired geographic theaters, standard conquest; no new diplomacy or historical faction system |
| Cities & Sieges | Constantinople; Chittorgarh; Malta | Standard conquest on close-up terrain; no breach or bombardment mechanics |
| Epics | Kurukshetra; Troy & the Troad; Lanka: The Epic Campaign; Emberfall: Kingdoms of Ash | Standard conquest; no supernatural mechanics |

## Authorship and interpretation

`collection_sources.py` defines the 22 new settings, geographic frames, names,
terrain types, approximate anchors, historical references and battle parameters.
Regional maps retain Natural Earth 1:10m coastlines and most geographic region
boundaries. Disconnected fragments are reassigned through actual land borders;
only problem areas are repartitioned to enlarge micro-enclaves or simplify hubs.
Sea lanes connect separate landmasses. Every genuine shared border permits travel.
The approved Kashyap Meer outline and borderlands territorial coverage are retained.
Internal sectors remain gameplay interpretations, not exact period political borders.

The ten local maps (five battles, three city settings, Kurukshetra and Troy) use
Mapzen Terrain Tiles. The clipped elevation arrays and source manifests are pinned
under `battle_sources/`. Modern terrain is not a reconstruction of all ancient
river courses, shorelines or earthworks. Woods, fields, forts and roads are original
interpretive cartography. Local coast masks use valid DEM sea-level samples, with an independent coastline
mask wherever elevations are missing. Troy uses an alternate pinned Mapzen/Skadi
HGT source with no missing samples in its frame, avoiding the defective tile strip.

Kurukshetra and Troy locate imaginary literary sectors around the associated
real-world landscapes. Lanka uses Sri Lanka's coast with invented epic place
assignments. These do not claim archaeological verification. Emberfall is original
fictional geography and artwork inspired by the broad high-fantasy genre, with
mountain halls, ancient woods, river kingdoms and a volcanic realm; it copies no
Tolkien map, place names or characters. Its illustrated relief has no metric scale
or claimed real elevation. Per-map notes and sources are visible before starting.

The five new historical battles use explicitly authored fronts and relative force
weights in `map_details.py`, checked for connected deployments and playtested.
Strengths and sectors are game abstractions, not regimental surveys.
Recommended campaign starts use recognizable opposing locations. Players can
choose any region under the existing kingdom-start system.

## Rebuild

With the existing map-build dependencies installed:

```sh
# Explicit network step; normal builds use only pinned data.
.venv/bin/python -m games.borderstrife.tools.build_collections --fetch-terrain
.venv/bin/python -m games.borderstrife.tools.build_collections /path/to/provinces.zip /path/to/rivers.zip
.venv/bin/python -m games.borderstrife.tools.fetch_troy_terrain  # explicit network step, once
.venv/bin/python -m games.borderstrife.tools.build_reviewed_maps /path/to/provinces.zip
.venv/bin/python -m games.borderstrife.tools.build_polished_maps /path/to/provinces.zip
.venv/bin/python -m games.borderstrife.tools.build_thumbnails
```

An optional final map ID rebuilds one map. `compact.json` and `expansion.json`
retain the pre-review definitions. The active registry overlays `reviewed.json`,
whose geometry, routes, terrain and thumbnails use `<id>_atlas_v3`. The final
`polished.json` overlay selects `<id>_atlas_v4`; see [the map refinement record](MAP_POLISH.md). Older assets
remain available to saved games. `source_region_ids` retain name/group provenance
for original maps; they do not assert that revised boundaries equal those groups.
Terrain images and annotations are bundled. Increasing a released map's region count or
changing its IDs requires a new asset version and preservation of its old files.
The runtime imports no GIS dependencies and makes no external map requests.

## Validation

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s games/borderstrife/tests -q
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.check_compact_borders
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.check_reviewed_maps
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m games.borderstrife.tools.check_map_openings
IMPERIUM_TEST_URL=http://127.0.0.1:3013 node games/borderstrife/tools/check_reviewed_maps.cjs
IMPERIUM_TEST_URL=http://127.0.0.1:3013 node games/borderstrife/tools/check_expanded_collection.cjs
```

Browser checks create local test campaigns for every new map, verify category
switching, mobile layout, assets, turn submission, reloads and fantasy map notes.
Backend checks cover all start choices, connected deployments, saves/replays,
rule separation and completed battles from both sides. Old compact India/Central
Asia fixtures exercise compatibility with the former 26/24-region versions.

`opening-playtest-report.json` records eight deterministic AI runs per map,
with a 60-turn observation window for campaigns and the existing 20-turn cap for
battles. Unfinished runs and one-sided outcomes are reported, not discarded.
This smoke test is not a human win-rate guarantee. `reviewed-map-report.json`
records graph sizes and maximum degree.
