# Agents

## Structure

- `website/` — main marketing/landing site
- `api/` — backend API
- `games/` — one subfolder per game

## Tech Stack

### Website
- Static HTML/CSS/JS
- Served via **nginx** (Docker)

### API
- **Python** + **FastAPI**
- **asyncpg** for PostgreSQL
- **uvicorn** as ASGI server

### Database
- **PostgreSQL 18** via Cloud SQL (`europe-west4-c`)

## GCP Stack

### Web
- **Cloud Run** — containerized hosting for `website/` and `api/`, scales to zero

### Infrastructure
- **Artifact Registry** — Docker image storage
- **VPC Serverless Access** — private Cloud Run → Cloud SQL connectivity
- **Secret Manager** — credentials & env vars

### CI/CD
- **GitHub Actions** — build Docker image, push to Artifact Registry, deploy to Cloud Run
