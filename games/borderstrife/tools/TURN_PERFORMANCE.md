# Long-campaign turn performance

Turn submission now returns valid moves with the saved state. Updated clients no
longer fetch valid moves after the animations; a fallback supports older APIs.
`Server-Timing` on successful turn responses separates lock wait, load,
resolution, save, and total server time. The browser retains its most recent
`borderstrife.turn` Performance measure, including animations and UI updates.
Server logs also record stage timings at INFO level without campaign contents.

Fast animations are the default: battles animate together, with at most one
ownership repaint for the battle group. Campaign & map → Turn animations offers
Fast, Cinematic (the previous sequence), and Instant. The choice persists locally;
reduced-motion preferences continue to suppress animations. Combat and orders
are unchanged.

## Persistence

`imperium_campaigns` stores a small current-state snapshot. The new
`imperium_campaign_turns` table stores one immutable entry per resolved turn.
Snapshot revision checks and journal inserts share a transaction. A failed insert
or stale submission rolls back the whole transaction. Deleting a campaign also
deletes its journal. Existing inline-history saves migrate atomically on their
next successful save, using a batch insert. No offline data migration is needed.
Full history remains available on campaign load and for post-game replay.
Forecasts, threats, valid moves, and turn resolution read only the current state
once the campaign uses the journal.

PostgreSQL operations share a bounded asyncpg pool (maximum five connections per
process) on a dedicated event-loop thread. Synchronous route workers submit
transactions to that loop. Connections return to the pool after successes and
errors; process exit closes the pool. SQLite remains the local default.

## Local validation

Measurements are local samples, not production latency guarantees:

- Eight-battle presentation: Cinematic 4,068 ms; Fast 333 ms; Instant <1 ms.
- Eight-battle terrain repaints: Cinematic 8; Fast 1; Instant 0.
- Synthetic 350-turn campaign: next turn 687 ms including Fast animations,
  no follow-up valid-moves request, all 351 journal entries retained.
- State payload: about 6.37 KB at 1, 300, and 1,000 history entries.
- SQLite state read + append + commit: median about 1.2 ms at all three sizes.

Python tests cover legacy migration, bounded snapshots, transaction rollback,
concurrent revision conflicts, batched PostgreSQL inserts, connection release,
and pool reuse. PostgreSQL adapter tests use mocks; production database latency
has not been measured here. Browser checks cover the long campaign, persisted
speed preference, and full post-game replay including legacy/incomplete history.

Run the Python suite:

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s games/borderstrife/tests -q
```

`check_long_campaign.cjs` accepts `IMPERIUM_TEST_URL` and
`IMPERIUM_TEST_GAME`. Supply a disposable local campaign with more than 300 turns;
it advances one actual turn. Synthetic history is suitable for performance
measurement but does not represent a balanced 350-turn playthrough.

## Loading and planning follow-up

The browser requests 20 recent reports at campaign load, without private replay
snapshots. It receives valid moves in that same response. “Load older turns”
requests another 50 reports using a turn cursor, so simultaneous new turns do not
shift older pages. The legacy full-history API remains available.

Snapshot-indexed completed campaigns serve replay positions in pages of 50 with
matching reports. Only requested pages are fetched, with pending requests shared
and stale navigation results ignored. Frames contain dynamic fields directly;
restoration copies region records without copying static geography. Older
journals retain exact reverse reconstruction before response pagination. Existing
active saves acquire a verified snapshot index on their next successful save;
new saves have it from creation. Replay reads never mutate the save.

Threat refreshes debounce by 150 ms, deduplicate identical pending plans, and
abort requests superseded by changed orders or a disabled overlay.

The nginx configuration enables gzip for JSON, JS, CSS and SVG and one-year
immutable caching only for explicitly versioned geography, thumbnails and terrain.
Unversioned assets retain normal revalidation. Docker was unavailable during local
validation; nginx runtime behavior and deployed headers still need verification.

A synthetic 1,000-turn campaign measured 9.7 KB / 1.9 ms for the initial response
and 150.6 KB / 17 ms for its first 50 replay positions, including JSON encoding.
Reports in this synthetic fixture have empty events, so real battle-heavy reports
will be larger. `check_lazy_loading.cjs` covers history pagination, replay page
boundaries, threat deduplication and cancellation. The Python suite now has 69 tests.

## Review fixes

Journal snapshots now use save schema 2. The updated reader accepts schema 1
(inline legacy histories and the earlier local journal prototype) and schema 2.
The previous deployed reader accepts only schema 1, so it rejects upgraded saves
rather than treating their empty inline history as a complete journal. Do not
roll back to an API build that lacks schema-2/journal support once campaigns have
been upgraded; a rollback build must retain the compatible persistence reader.

Completed legacy replays use a process-local LRU cache of serialized frame/report
pairs. Later pages decode only the requested positions. The cache is bounded to
four campaigns and 16 MiB of serialized data; oversized replays use the uncached
fallback. Cache keys include the campaign ID and current-state signature, and
reads still check that the campaign exists and is completed. No saved state is
modified. Cache eviction or a new server process can require reconstruction again.

Autoplay uses a generation token before and after asynchronous seeks. Pause and
exit invalidate pending playback and seek work, preventing an older loop from
scheduling another timer after a pause/resume sequence. Regression checks:
`check_replay_autoplay.cjs`, the replay and lazy-loading browser suites, and the
72-test Python suite.
