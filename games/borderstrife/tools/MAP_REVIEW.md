# Map review — 5 October 2026

Scope: all 35 selectable maps on `feat/expanded-map-collections`. The category label has been changed to **Epics** in the selector, cards and documentation. The internal `legends` identifier is retained for compatibility. The findings below preserve the original review. They have now been addressed in the `atlas_v3` revision; see the implementation record at the end of this document.

## Method and limitations

- Opened a fresh local game for every map at 1440 × 1000 and inspected all 35 rendered maps. Screenshots were captured under `/tmp/review-<preset-id>.png` during the review.
- Inspected source definitions, generated polygons, route types, default opening armies, region sizes and adjacency degrees. All 35 region graphs are connected.
- Re-ran the shared-border regression: all **1,655** displayed land borders permit movement both ways.
- Verified the Epics selector in the browser, JavaScript syntax, and `git diff --check`.
- This is a cartographic, presentation and scenario-configuration review. It is not a complete historical authentication, accessibility audit or win-rate balance study. Unequal starting armies are a reason to evaluate or explain an opening, not proof that a scenario is unwinnable.
- Priority: **High** = materially misleading geography/connections or broken terrain; **Medium** = important readability, scenario authenticity or default-start concern; **Polish** = presentation improvement without a confirmed functional defect.

## Important shared findings

1. **High — shared-border validation is necessary but insufficient.** Regions can contain detached pieces. Two region polygons then touch somewhere even when their labeled/main territories are separated by sea or other regions. Confirmed route examples: England–Paris is `river`; Pandya–Lanka is `road`; Leeward Islands–Windward Islands is `road`; Baetica–Mauretania is `pass`; India also has Madra–Lauhitya. Inspect the contributing polygon pieces and anchors, correct assignments, and then rebuild adjacency. Do not simply delete genuine shared-border routes: neighboring displayed regions must remain connected.
2. **High — missing DEM data is treated as sea.** In `battle_terrain.py`, coastal maps use `(source <= .5) | ~isfinite(source)` as water, including the -32768 no-data value. Troy visibly contains a perfectly straight, full-width blue band. Its source raster has entire rows of missing data. Repair/refetch void tiles and use an independent coastline mask; missing samples are not evidence of ocean. Recheck Malta and Constantinople after the shared fix.
3. **Medium — new historical deployments are algorithmic rather than independently sourced.** `build_collections.py` grows two connected territories from headquarters and assigns 80/50/40 forces by capital/terrain. This ensures connectivity, but does not establish historical deployments. Panipat, Austerlitz, Antietam, Cannae and Naseby need authored opening layouts checked against references. Preserve existing combat rules.
4. **Medium — decorative land cover and roads look more precise than their evidence.** New local woods are seeded shapes around forest anchors; settlement paths form a nearest-connection network. Disclosures are present, but signature walls, bridges, ridges and field boundaries need authored reference-based art rather than generic paths or boxes.
5. **Medium — defaults vary greatly in strength.** Examples from the default preset configuration: Crusader States 128 vs 288 troops; Andes 168 vs 80; British & Irish Isles 168 vs 96; Lanka 96 vs 168; Constantinople 288 vs 160. Evaluate terrain growth, expansion access and repeated play before calling them balanced; select more suitable default territories or clearly describe intentional asymmetry.
6. **Medium — several maps defeat the simpler-connections goal.** Shenandoah Valley has 11 neighbors, Shewa 9, and multiple maps have 8-neighbor hubs. Redesign region boundaries where needed while retaining the 24–30 region limit and every genuine neighbor connection.
7. **Polish — missing geographic context.** All 21 non-fantasy expansion maps have an empty water-label layer. Regional relief is largely categorical terrain tint/hatching, not the measured relief used for local battles. Add restrained named waters and recognizable mountain spines; keep the distinction between measured and illustrative terrain explicit.

## Regional maps (14)

| Map | Priority | Important improvement or fix |
|---|---|---|
| Mediterranean | High | Audit land-typed links across separated main territories: Hispalis–Mauretania/Numidia and Liguria–Corsica & Sardinia. Correct detached province assignments and classify genuine crossings as sea. Improve the tiny Crete/coastal click targets without adding regions. |
| Europe | High | England–Paris is a river route; Pomerania–Sweden and Rome–Sicily are roads; Spain–Sicily links also appear. Rebuild assignments and explicit crossings so the graph reflects the visible seas. |
| The Americas | Medium | Inspect detached Pacific Northwest pieces: connections extend to Alaska and the Prairies despite separated anchor components. Improve Caribbean click targets and assess the default 136-vs-208 opening. |
| Africa & Middle East | High | Somalia–Gulf Coast and Najd–Khorasan are road links between separated anchor components. Correct land/sea connectivity around the gulfs. Bring out Nile and mountain relief against the broad desert regions. |
| Central Asia | Medium | Eastern Steppe has eight neighbors; simplify its boundary arrangement. Separate the dense Samarkand–Tashkent–Khwarazm labels and strengthen the visual mountain/steppe distinction. Keep all 30 regions. |
| Afghanistan, Balochistan & Indus | Medium | Ghor has eight neighbors; inspect its long/shared boundaries for a simpler central layout. Make the Hindu Kush and Indus corridor easier to read while retaining the approved territorial coverage. |
| Indian Subcontinent | High | Investigate the unexpected Madra–Lauhitya route and detached Madra pieces. Pandya–Lanka is currently a road; make island travel geographically explicit. Separate Magadha/Pataliputra labels and retain the approved names and 30-region count. |
| Southeast Asia & Oceania | High | Malacca–Jambi is a road and Luzon–Sabah a pass despite separated main islands. Correct assignments/crossing types; improve tiny island hit areas and route visibility around Indonesia. |
| Japan & Korea | Medium | No river or water-label features are included. Add rivers at appropriate scale, mountain relief and clearly named sea crossings. Make the Kyushu–Korea connection easy to discover without opening a move. |
| British & Irish Isles | High | Wessex/Devon–South Wales links use detached components and are typed as road/pass; review Bristol Channel crossings and province assignments. Add rivers, and assess the 168-vs-96 default opening. |
| Anatolia & the Caucasus | Medium | Inspect Thrace–Bosphorus geometry: separated anchor components connect as a road. Make the strait crossing explicit and add Black Sea/Caspian labels plus stronger mountain relief. |
| Nile Valley & the Horn | Medium | Harar is a tiny administrative enclave; the largest region is approximately 420 times its area. Merge/split assignments within the existing count for useful click targets, reduce Shewa's nine-neighbor hub, and inspect the detached Harar–Somali Plateau link. |
| Andes & Pacific Coast | Medium | The very tall map compresses northern labels and leaves little usable width. Improve initial framing/label behavior, inspect the Cajamarca–Huanuco component link, and assess the 168-vs-80 default start. |
| Caribbean & Central America | High | Leeward–Windward Islands is currently a road because detached pieces create a shared border. Correct island assignments and make the crossing a sea route. Enlarge small-island hit targets and label the surrounding waters. |

## Historical Battles (10)

| Map | Priority | Important improvement or fix |
|---|---|---|
| Waterloo | Medium | Woods still read as large angular blocks and settlements as small repeated symbols. Refine woodland edges and distinguish Hougoumont/La Haye Sainte visually from ordinary sectors; improve ownership-boundary contrast over relief. |
| Sekigahara | Medium | Counters cluster tightly around Mount Sasao and the central valley while broad forest areas dominate the frame. Improve label spacing, visible approaches and sector-boundary contrast; Mount Sasao's eight-neighbor hub needs inspection. |
| Hastings | Polish | The tall frame wastes horizontal space. Improve initial framing and make the ridge and objective markers more legible against the similarly colored relief; soften the angular woodland edge. |
| Hattin | Medium | Emphasize the Horns, springs and routes to the lake through terrain art and annotations. The 305-vs-500 opening needs an explicit asymmetric-scenario explanation and playtesting, not an automatic force equalization. |
| Gettysburg | Medium | Crowded Cemetery Hill/headquarters labels and small sectors sit inside a narrow frame. Improve labels and initial zoom, emphasize the ridge line and make the smallest objective areas selectable without precision clicking. |
| First Panipat | Medium | The map reads as an almost uniform 4-by-6 grid; wagon lines and earthworks are mostly names/symbols. Draw those defining features and author the deployment using references instead of the generic graph partition. |
| Austerlitz | Medium | The Goldbach is an authored schematic polyline; validate it against village anchors and make Pratzen Heights a coherent visual feature. Replace generic starting territory growth with an authored deployment. |
| Antietam | High | The creek is a schematic zigzag whose crossing labels are not tied to its geometry. Align Burnside Bridge and the other crossings with a sourced creek course before rebuilding river-route classifications. Author the deployment. |
| Cannae | Medium | A nearly regular grid, generic equal forces and an angular river make the setting feel interchangeable. Give the interpreted Aufidus course and battle frontage an authored layout, explicitly retaining uncertainty around ancient geography. |
| Naseby | Medium | The nearly regular grid and generic forest patches obscure the distinguishing battlefield features. Author the ridge/hedge/approach layout and deployment using the registered battlefield documentation. |

## Historical Campaigns (4)

| Map | Priority | Important improvement or fix |
|---|---|---|
| Crusader States | High | Beirut is roughly 1/1,762 the area of Aleppo and is difficult to select; current boundaries visibly inherit modern administrative geometry. Rework region coverage within 24 regions and assess the default Jerusalem 128 vs Damascus 288 troops. |
| Civil War: Eastern Theater | High | Shenandoah Valley has 11 neighbors; Washington is roughly 1/508 the area of Southside. Rework the boundaries and tiny targets, and review road-typed links across separated Chesapeake-side components. |
| Rome vs Carthage | High | Baetica/Carthago Nova connect to Mauretania as passes and Carthago Nova–Numidia as a road. Correct the detached North African/Iberian assignments and provide deliberate sea connections. Assess the 160-vs-224 opening. |
| Sengoku Japan | High | Mikawa connects to Omi, Yamashiro and Kii through detached components. Correct province assignment before presenting these as historical regions; then improve the dense central-Japan labels and add river/mountain context. |

## Cities & Sieges (3)

| Map | Priority | Important improvement or fix |
|---|---|---|
| Constantinople | Medium | The defining city walls are absent as a continuous recognizable feature; ordinary paths/boxes dominate. Draw walls and gates, name the waterways and inspect coastline masking after the Troy fix. Evaluate the 288-vs-160 default opening. |
| Chittorgarh | Medium | The plateau has relief, but the fort perimeter, gates and approach route are not visually coherent. Draw an authored fort outline and gate path, improve central label spacing and inspect the eight-neighbor Padan Pol approach. |
| Malta | Medium | Birgu/Senglea/Cospicua/St Elmo are tightly clustered, and Mdina's sector is tiny. Improve zoom-aware labels/hit targets, draw fort footprints and name harbors; recheck the shared no-data coastline logic. |

## Epics (4)

| Map | Priority | Important improvement or fix |
|---|---|---|
| Kurukshetra | Medium | The uniform grid and four generic woodland patches do not convey a distinctive epic setting. Create authored camp banners, chariot grounds and readable battle lines, with literary interpretation clearly identified. |
| Troy & the Troad | High | Repair the missing-elevation stripe rendered as a full-width sea band. Rebuild shoreline, sectors and routes from repaired data and an independent land mask before polishing the citadel, ship camps and interpreted river. |
| Lanka: The Epic Campaign | Medium | Modern administrative shapes dominate the literary setting; rivers are absent despite river-themed names. Author a coherent central highland/forest/river landscape, review detached southern assignments, and assess the 96-vs-168 opening. |
| Emberfall: Kingdoms of Ash | Polish | The outline is visibly angular and the central mountains look like a blurred band. Refine coastlines and draw a coherent mountain chain, passes, forest edges and volcanic silhouette while retaining original names/geography. |

## Reference checks and next implementation order

The National Park Service identifies Burnside Bridge as crossing Antietam Creek, providing a concrete anchor for the river alignment repair: [NPS: Burnside Bridge](https://www.nps.gov/places/antietam-battlefield-burnside-bridge.htm). Historic England provides a registered battlefield account and historical-map discussion suitable for the Naseby rebuild: [Naseby entry](https://historicengland.org.uk/listing/the-list/list-entry/1000023), [battlefield report](https://historicengland.org.uk/content/docs/listing/battlefields/naseby/). UNESCO supplies Troy's archaeological setting and supporting map documents; these anchor the real location, not the literary deployment: [Troy](https://whc.unesco.org/en/list/849/), [documents](https://whc.unesco.org/en/list/849/documents/).

Recommended order: (1) Troy's raster defect and shared coastline handling; (2) detached-region assignments and crossing types across all maps; (3) tiny sectors, crowded labels and high-degree hubs; (4) authored historical deployments and defining landmarks; (5) epic artwork and regional relief. Re-version changed published geometry/rules together so existing saves and replays remain coherent. Validate both shared borders and geographic crossing plausibility; passing the current border check alone is not enough.

## Implementation record — atlas_v3

All 35 maps now use versioned reviewed assets. Original assets remain available to saved campaigns and replays. Approved region names, the Kashyap Meer outline, the borderlands coverage/exclusions, and existing region counts are retained. Combat and movement algorithms are unchanged.

- **Every map:** repaired detached territory assignments, rebuilt geographic routes, limited adjacency to at most seven neighbors, and retained travel across every genuine shared border. Whole unanchored islands are assigned together so artificial divisions cannot create false mainland connections. Local boundary repairs preserve the surrounding geographic outlines.
- **Regional maps:** corrected island and strait crossings, enlarged problematic sectors, added named waters and appropriate rivers/mountain context, and revised default opening territories. Central Asia and India retain 30 regions. The regional relief remains illustrative rather than a claim of measured battlefield elevation.
- **Historical battles:** softened woodland edges, strengthened sector boundaries and added distinctive ridges, springs, farms, bridges, hedges and wagon lines. Panipat, Austerlitz, Antietam, Cannae and Naseby now have explicit authored deployments and forces. Antietam's creek passes its named crossing anchors. Hattin's intentional asymmetry is explained in the scenario notes.
- **Campaigns:** repaired Beirut and Washington's tiny sectors, reduced Shenandoah's adjacency, corrected Rome/Carthage and Sengoku detached components, and added geographic context. Crusader States now opens with matched troop totals and connected starting territories on each side.
- **Sieges:** added Constantinople's walls, Chittorgarh's perimeter/gates/approach, and Malta's forts and named harbors. Chittorgarh's starting territories and central connections were revised; coastline handling was checked across all coastal local maps.
- **Epics:** added Kurukshetra's camps/fronts and literary landscape; replaced Troy's void-filled elevation source with a pinned, void-free Skadi extract and rebuilt its terrain, coastline and routes; added Lanka's rivers/highlands and fortified landing camp; refined Emberfall's coastline, continuous biomes, mountain chain and volcanic landmark. Literary and reconstructed features remain explicitly identified as interpretations.
- **Readability:** improved label placement and leader lines, enlarged selection targets, made sea routes clearer, added Fit regions, and improved initial framing for tall maps. Mobile layouts reserve toolbar space and omit leaders for hidden labels. Terrain annotations are cached with the map background.

### Verification

- 54 Python tests passed.
- Geographic regression passed for all 35 maps and 1,667 routes, including primary-component adjacency, connected deployments, the unanchored-island regression, Troy's replacement elevation and Antietam's crossings.
- Browser checks passed for all 35 maps: rendering, marker selection, fit/reset, turn submission and reload. Dark/mobile views, historical scenarios, display controls, fullscreen fallback, and older saves/replays also passed.
- Eight deterministic AI runs per map (280 total) are recorded in `opening-playtest-report.json`. All historical battles completed within their turn limit. Campaign observation stops at 60 turns, and unfinished games remain explicitly reported. These are smoke tests and opening comparisons, not proof of competitive balance. The revised Crusader States and Chittorgarh defaults each produced four wins per side in this small sample; Lanka produced two versus six.

Reproduction commands and source limitations are documented in `COLLECTIONS.md`; generated topology counts are in `reviewed-map-report.json`.
