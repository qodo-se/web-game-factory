# BorderStrife: campaign upgrade

Whole-army orders, the existing AI strategy, and elimination victory remain.
New campaigns use geographically derived adjacency; existing saved campaigns
retain the graph stored with them.

## Combat

- Each side's effective strength is squared when calculating victory odds.
  A 3:1 effective advantage gives 90% victory odds, not 75%.
- Terrain defense, supply status, and route penalties feed the same calculation
  in resolution, AI attack scoring, and the hover forecast.
- Select an army and hover a reachable region to see combined planned attack
  strength, conditional loss ranges, and possible retreat survivors. Forecasts
  include recruits but assume the defender stays and receives no reinforcements;
  the enemy submits simultaneous orders.
- Victorious attackers lose 25–55% multiplied by battle difficulty. Defeated
  armies retain 35–60% before retreat, rounded down.
- After every battle resolves, defeated survivors retreat to an eligible friendly
  origin or adjacent region. If no friendly destination remains, they are lost.
  Retreats never reinforce an already resolved battle.

## Geography and supply

- Land neighbors come from shared atlas territory boundaries. Sea lanes link
  islands and establish ports at their endpoints. The complete graph remains
  connected for every preset.
- River crossings confer 20% extra defensive advantage, mountain passes 15%,
  and sea landings 25%. These are applied to each attacking contribution, so
  attacks converging from different approaches retain their own crossing cost.
- Owned cities and the player's original capital are supply sources. Supply
  flows through connected friendly regions and friendly sea-lane endpoints.
- Isolated player regions recruit at half rate (rounded down, minimum one),
  attack at 75% strength, and defend at 85% of their terrain-adjusted strength.
- Neutral militia keeps its local recruitment and terrain defense.
- Supply is assessed at the start of resolution. The UI shows the resulting
  network for planning the next turn. Orange dashed counters mark your isolated
  regions; the optional supply overlay shows friendly connections.
- Random maps use their generated adjacency with terrain-based pass routes.
  Preset rivers and sea routes are not fabricated on procedural maps.

## Presentation

The atlas displays sourced major rivers, symbolic hill shading, cities, ports,
sea labels, and stronger ownership outlines. Counters keep their screen size
when zooming. Turn replay shows movement, each battle/capture, and retreats.
Skip jumps to the committed result; reduced-motion preference bypasses replay.
A hidden browser tab also bypasses animation. Sound is optional and defaults off.

## Campaigns

Campaign names appear in the menu and sidebar. Initial state and each completed
turn are stored on the server, with a conquest journal. A local resume library
stores the private game IDs; it is scoped to the API URL. There is no public
campaign directory or user-account system. Keep the browser's local storage to
retain resume links. Unsubmitted orders are not saved.

SQLite is the local default; set `IMPERIUM_DB_PATH` to choose the file. Configure
`DATABASE_URL` for PostgreSQL/Cloud SQL in production. The role must be able to
create `imperium_campaigns` on first use. Cloud Run requires PostgreSQL, because
its local filesystem does not provide durable campaign storage. Local SQLite
campaigns are not migrated automatically when changing backends.

Saves use an explicit JSON schema, not Python pickle. Each turn request supplies
its expected turn number. Conditional database writes permit exactly one
commit for that turn, including across processes. If a response is lost after
commit, the browser reloads the saved state before enabling more orders. A save
failure cannot mutate the previously committed game.

The saved conquest timeline is restored when reopening a campaign. Completed
campaigns can be reopened and reviewed.

## Validation

From the repository root, with API dependencies installed:

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s games/borderstrife/tests -v
```

Browser checks require Playwright/Chromium and the local API/UI running:

```sh
node games/borderstrife/tools/check_campaign_upgrade.cjs
node games/borderstrife/tools/check_map_camera.cjs
```

The API/UI defaults are `http://127.0.0.1:8080` and `http://localhost:3000`;
override `IMPERIUM_TEST_API` / `IMPERIUM_TEST_URL` when needed. The campaign
check covers forecast, supply overlay, skip, reduced motion, sound preference,
resume, stale-turn rejection, and a deliberately lost response after commit.
The fixture atlas check remains available at `tools/check_atlas.cjs`.

## Starting kingdoms

Preset maps offer the authored recommended start or any region as your capital,
including Kashyap Meer. Custom starts expand to three connected regions, favoring
productive neighbors; the rival starts at a distant seat with its own connected
territories. Geography and terrain remain unchanged. The preview lists your exact
territories, army, recruitment and rival seat. Difficulty compares starting army
strength only; it does not predict campaign outcomes. Existing saves keep their starts.

## Border threats and atmosphere

Show border threats to mark friendly regions adjacent to enemy kingdoms. Red means
at least 65% potential loss risk, amber at least 35%, and pale rings indicate lower
risk. Hover a region for its estimate and remaining defenders. The calculation
includes growth, supply, terrain, crossings, departures and friendly reinforcements.
It assumes all adjacent enemies attack the inspected region together; those attacks
cannot all occur simultaneously across every threatened region. Neutrals do not
initiate attacks. Threat information is optional and does not interrupt play;
Next Turn submits your orders immediately without a confirmation dialog.

Map atmosphere adds restrained ocean drift; river highlights are static to avoid
continuous geographic repainting. It can
be disabled, respects reduced motion and pauses in hidden tabs. Region panels show
terrain illustrations; city walls and capital crowns distinguish settlement roles.

## Browser rendering

Terrain is cached until ownership, terrain, dimensions or rendering resolution
changes. Selection and planned moves use a separate SVG layer. Marker layout and
hit geometry are reused across turns; new state snapshots receive the cached
counter positions. Procedural maps also reuse terrain between interactions.
The atlas bitmap is capped at approximately four million pixels; labels, arrows
and selection outlines remain vectors. Ocean decoration uses sparse water-only
paths rather than animated geographic masks. River highlights remain static.
Pointer hover work runs at most once per animation frame. Forecast requests wait
120 ms for the pointer to settle and obsolete requests are cancelled. Resizing
settles for 120 ms before rebuilding geographic geometry.

`tools/check_render_performance.cjs` checks cache reuse and invalidation and reports
30-frame selection benchmarks on India, Europe and a large procedural map. Local
headless Chromium at 1500×1000 with device scale 2 measured roughly 16 ms/frame
for India after the changes, versus 46 ms/frame before; idle main-thread task time
fell from about 107 ms to 3 ms over two seconds. These are local measurements,
not guarantees for every browser or device.

## Order history, strategic views and reports

Unsubmitted orders support Undo, Redo and Clear orders. Ctrl/Cmd+Z undoes;
Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes. Clearing a plan is undoable; making a new
edit discards the redo branch. History is limited to 100 edits and resets when a
turn resolves or the page reloads. Editing is disabled during resolution and
after the campaign ends. Undo never rolls back a resolved battle.

Map view switches between ownership, current army strength, and effective
recruitment. Strategic colors scale from light (low) to dark (high), with a legend
showing the current map maximum. Recruitment includes supply penalties and neutral
militia rates. Recruitment mode shows +recruits on counters; the region inspector
still lists both armies and growth. Counter rims retain ownership colors.
These modes use cached geometry without repainting terrain.

New battles record effective strengths, terrain and supply modifiers, each source's
crossing penalty, victory probability, and the actual random roll. Expand Why this
result? in the battle report to inspect them. Old saved reports remain readable
and explicitly indicate when no breakdown was recorded. Losses include defeated
survivors who could not retreat. Report outcome colors reflect the player's side.

The latest turn recap lists the player's net regions gained/lost and casualties.
Capturing then losing the same region in one turn does not inflate the net totals.
Region links in the recap and battle reports center and zoom the map. Reports and
recaps remain available after loading the saved campaign.

## Sidebar layout

The compact Region summary stays visible above the collapsible sections. It shows
name, owner, terrain, troops, recruitment, defense and supply without artwork or
a long stat table. Forecast odds remain visible, with extra details expandable.
Opening a collapsible section closes the previous one;
its body fills the height left by the other section headings and scrolls independently.
Click the open heading again to collapse everything. The selected section is
remembered for the browser tab, including across reloads. Hovering the map updates content without switching the selected section.
After a turn finishes, Turn report opens automatically and scrolls to the recap.
This also applies when a completed turn is recovered after a lost response.
Headings support Enter/Space to toggle and arrow keys/Home/End to move focus.

Turn report combines the turn recap and detailed battle explanations in one
collapsible pane, with gains, losses and casualties above the battle details.

## Post-game campaign replay

After victory or defeat, choose Replay campaign on the result screen or under
Campaign & map. Previous/next buttons and a turn slider show the starting position
and each completed turn, including ownership, armies, supply, recruitment, player
totals and that turn's report. Play advances once per second; Pause or slider input
stops playback. Playback also pauses when the browser tab is hidden. Positions
change instantly, including with reduced motion enabled. Zoom, pan, inspection and
strategic map modes remain available. Exit replay restores the final campaign.

Replay is read-only: orders and turn submission remain disabled, and inspecting
history never updates the saved campaign or its resume entry. The live threat
forecast is disabled during replay so it cannot show estimates from the final save
on an earlier position. New turns atomically persist compact pre-turn ownership and
army snapshots alongside their journal. Static map data is shared by replay frames.
Older version-2 movement/battle/retreat journals can be reversed to recover exact
positions. If a journal is incomplete, replay exposes only its contiguous recoverable
suffix and labels the missing earlier history. No positions are guessed.

## Historical Battles

World Campaigns retain the conquest and recruitment rules above. Historical
Battles offer Waterloo, Sekigahara, Hastings and Hattin, with either historical
side playable. They start with fixed forces and no recruitment, including in
isolated sectors. Three gold diamonds mark objectives. After turn 20, control
of more objectives wins; ties use remaining army strength, then the defender
named in the battle status tooltip. Eliminating the opposing force or taking
all its territory wins early. Headquarters remain supply sources, not instant
victory targets. Standard simultaneous movement, terrain, supply and retreat
rules apply.

These are topographic reconstructions using measured modern elevation,
interpreted historical landscape detail and terrain-aware gameplay sectors. See [battlefield sources and assumptions](tools/BATTLES.md).


### Compact maps
New regional campaigns contain 24–30 regions. Historical battles retain their
16–22 sectors. All regions sharing a land border are connected; select an army to see its
available destinations. Point-only contacts do not count as shared borders.
Sea crossings connect separate land masses without redundant routes.
Older campaigns retain the original geography and connections.
