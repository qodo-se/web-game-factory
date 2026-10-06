# Campaign retention and portable saves

Campaigns expire **7 days after creation or restore**, whether ongoing or completed. Playing, downloading, and viewing a replay do not extend that deadline. `expires_at` is returned with the state and displayed in the campaign panel and browser resume list. Existing database rows receive a seven-day grace period when the schema migration first runs; their old `updated_at` is not used to delete them immediately.

Players can download a `.borderstrife.json` save from the campaign panel or Resume game. Restore is available on the Resume game tab. The file contains the committed state, campaign/player names, rules, map asset reference, standing orders, and full stored turn journal, including replay positions and movement reports. Unsubmitted browser plans are not included. Files have no expiry. Restoration creates a new private game ID and a fresh seven-day server window. Completed campaigns open directly in replay; active campaigns resume normally. Original saves are never overwritten.

Version 1 files are plain JSON with `format: "borderstrife-save"`, `version: 1`, and `campaign`. Both downloads and uploads have a 16 MiB limit, enforced again while streaming uploads even without Content-Length. Nginx permits the same request size. Unsupported versions, unavailable map assets, invalid state/history/region references, unsafe asset paths, and malformed files are rejected before inserting any data. Keep archived versioned regional map assets in the repository: saves reference those assets rather than embedding the entire map artwork. The retired non-regional collections have been removed; those saves now report an unavailable map and cannot be restored. Older campaigns retain whatever replay history they already had; export cannot reconstruct history that was never recorded.

## Expiry and cleanup

All game reads exclude expired rows; turn commits also check the expiry boundary so an in-flight turn cannot revive an expired game. Expiry is enforced even when the cleanup scheduler is delayed. Full-history reads recheck expiry after loading the journal, avoiding truncated downloads if cleanup occurs between reads.

The API deployment workflow also deploys the `wgf-campaign-cleanup` Cloud Run Job using the same image, runtime service account, SQL attachment and database secret. The job runs `python -m games.borderstrife.api.cleanup`; it deletes expired campaigns in batches of 100 and lets the foreign key cascade delete their turn rows. The job refuses a missing production database configuration.

`.github/workflows/cleanup-campaigns.yml` requests execution hourly at minute 23, using the existing GitHub → GCP identity. This works even when the API service scales to zero. GitHub schedules are best effort and can be delayed or dropped; physical deletion occurs on a successful cleanup run after expiry. Monitor this workflow separately from deployments. See [GitHub schedule semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [Cloud Run job deployment flags](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/deploy).

The deployment identity needs permission to deploy and execute Cloud Run Jobs and use the runtime service account. Deploying the job does **not** execute it immediately. After deployment, verify the job and scheduled workflow succeed before considering production cleanup operational. No public cleanup HTTP endpoint is exposed. Deletion concerns the live database; provider-managed database backups follow their own retention policy.

Local cleanup uses the same SQLite location as the API, or `IMPERIUM_DB_PATH`:

```sh
.venv/bin/python -m games.borderstrife.api.cleanup
```

## Validation

```sh
.venv/bin/pip install -r games/borderstrife/tests/requirements.txt
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s games/borderstrife/tests -q
node games/borderstrife/tools/check_campaign_backups.cjs
node games/borderstrife/tools/check_compact_setup.cjs
```

Browser checks need Playwright and a local server at port 3000 (or `IMPERIUM_TEST_URL`). They create local test campaigns. Backend tests use isolated temporary SQLite databases, including a legacy schema migration, expiry boundaries, cascade cleanup, malformed uploads, ongoing/completed round trips, all current maps and a 350-turn campaign. Existing PostgreSQL adapter tests exercise transaction/CAS behavior with mocks; a deployed cleanup job still needs an operational smoke check.
