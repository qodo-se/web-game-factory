# Web Game Factory

> Home of BorderStrife — turn-based conquest across regional maps and historic battlefields.

## Getting Started

Run the local API with automatic reload, so preset changes apply to new games:

```bash
make dev-api
```

Serve the game in a second terminal:

```bash
python3 -m http.server 3000 --directory games/borderstrife/ui
```

Open `http://localhost:3000` and set the API address once in the browser console:

```js
localStorage.setItem('IMPERIUM_API_BASE', 'http://127.0.0.1:8080');
location.reload();
```

Campaigns now autosave to `.local/imperium.sqlite3` and survive server reloads.
Set `IMPERIUM_DB_PATH` to use a different local database file. The home page keeps
private resume IDs in this browser; clearing browser storage removes those links.
Completed turns are saved; unsubmitted orders are not.

For Cloud Run, configure `DATABASE_URL` with a PostgreSQL/Cloud SQL connection
string via Secret Manager. The API uses `asyncpg` and creates the
`imperium_campaigns` table on first access (the database role needs CREATE TABLE
permission). State and its turn journal are committed in one conditional update;
stale or duplicate turn submissions return HTTP 409. Cloud Run refuses to use
an ephemeral SQLite fallback. Local SQLite saves are not automatically migrated
to PostgreSQL.

See [gameplay rules and validation](games/borderstrife/GAMEPLAY.md) for the new
combat, supply, replay, and campaign features.

## Deployment

### Prerequisites

- GCP project with the following services enabled:
  - `run.googleapis.com`
  - `artifactregistry.googleapis.com`
  - `sqladmin.googleapis.com`
  - `secretmanager.googleapis.com`
- Artifact Registry Docker repo: `europe-west4-docker.pkg.dev/<PROJECT>/web-game-factory/`
- Workload Identity Federation pool + GitHub OIDC provider scoped to this repo

### Production campaign storage

The API uses the `imperium` database on `test-postgres-instance` in
`europe-west4`. The `imperium_app` PostgreSQL login owns only this database and
has no role-creation or database-creation privileges.

Cloud Run mounts the instance at `/cloudsql/<instance-connection-name>` using
its authenticated Cloud SQL connection. The database URL uses that Unix socket
with `sslmode=disable` for the local socket; the Cloud SQL proxy encrypts and
authenticates the remote connection. No authorized public client networks are
needed.

The runtime identity is `wgf-api-runtime@<PROJECT>.iam.gserviceaccount.com`.
It needs `roles/cloudsql.client` on the project and
`roles/secretmanager.secretAccessor` on the `wgf-api-database-url` secret only.
The deployer must be able to act as this runtime identity.

`api/Makefile` explicitly applies the runtime identity, Cloud SQL attachment,
and `DATABASE_URL` Secret Manager binding on every deployment. Secret version
`1` is pinned; when rotating credentials, override `DATABASE_URL_SECRET` with
the new version and redeploy. Never commit or print the database URL.

For another environment, provision its database, login, secret and IAM grants
first, then override `CLOUD_SQL_INSTANCE`, `DATABASE_URL_SECRET` and
`RUNTIME_SERVICE_ACCOUNT` when running `make deploy-api`.

The `/health` endpoint checks only that the API process is running. After a
deployment, verify creating a campaign, submitting a turn and reloading the
campaign through the website to exercise durable storage.

### GitHub Secrets (required)

| Secret | Description |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full WIF provider resource name |
| `GCP_SERVICE_ACCOUNT` | Service account email for deployments |

### Local Deploy

**Local prerequisites:** Docker, `gcloud` CLI, and an authenticated account with permissions to push to Artifact Registry and deploy Cloud Run services (`gcloud auth login`).

```bash
make deploy-website   # build, push, deploy website
make deploy-api       # build, push, deploy api
make deploy-all       # both
```

Override defaults as needed:

```bash
make deploy-api PROJECT=my-project REGION=us-central1
```

## BorderStrife branding and compatibility

The public game name is **BorderStrife**, served at `/borderstrife/`.
The website permanently redirects `/imperium` and `/imperium/...` to the new
location, preserving campaign query strings. Keep these redirects for old links.

The source directory and Python package are now `games/borderstrife` and
`games.borderstrife`. Build commands, Docker paths and deployment filters use the
new source name. The `/api/imperium` endpoints, database/table names, browser storage
keys, and `IMPERIUM_*` configuration variables deliberately retain their original
identifiers. They are compatibility identifiers, not display
branding. This keeps saved campaigns, pending orders, preferences, API clients,
and deployment secrets working without a migration. Both URLs use the same origin;
a future domain change would need a separate browser-storage migration plan.

Deployment remains the existing Deploy Website GitHub Actions workflow. Its path
filters still cover `games/borderstrife/ui/`; the Docker build copies those assets into
`/usr/share/nginx/html/borderstrife/`. The source-package rename requires both
website and API deployment.

The welcome page canonical and sharing URLs currently point to the Cloud Run
website hostname; update them when introducing a custom domain. The editable
sharing artwork is `games/borderstrife/ui/social-card.svg`, exported at 1200×630 to
`social-card.png`.

For a local nginx preview, run the rebrand integration check with Playwright:

```bash
BORDERSTRIFE_TEST_URL=http://127.0.0.1:3011 node games/borderstrife/tools/check_rebrand.cjs
```

The preview must serve the website nginx routes and proxy `/api/` to the local
API using the same local database. The check creates a disposable test campaign.
