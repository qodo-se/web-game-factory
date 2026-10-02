# Agents

## GCP Stack

### Web
- **Cloud Run** — containerized web app hosting, scales to zero

### Database
- **Cloud SQL** — PostgreSQL 18 (`europe-west4-c`)

### Infrastructure
- **Artifact Registry** — Docker image storage
- **VPC Serverless Access** — private Cloud Run → Cloud SQL connectivity
- **Secret Manager** — credentials & env vars

### CI/CD
- **GitHub Actions** — build Docker image, push to Artifact Registry, deploy to Cloud Run
