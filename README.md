# Web Game Factory

> A factory for building web games.

## Getting Started

_Coming soon._

## Deployment

### Prerequisites

- GCP project with the following services enabled:
  - `run.googleapis.com`
  - `artifactregistry.googleapis.com`
  - `vpcaccess.googleapis.com`
  - `secretmanager.googleapis.com`
- Artifact Registry Docker repo: `europe-west4-docker.pkg.dev/<PROJECT>/web-game-factory/`
- Workload Identity Federation pool + GitHub OIDC provider scoped to this repo

### GitHub Secrets (required)

| Secret | Description |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full WIF provider resource name |
| `GCP_SERVICE_ACCOUNT` | Service account email for deployments |

### Local Deploy

```bash
make deploy-website   # build, push, deploy website
make deploy-api       # build, push, deploy api
make deploy-all       # both
```

Override defaults as needed:

```bash
make deploy-api PROJECT=my-project REGION=us-central1
```
