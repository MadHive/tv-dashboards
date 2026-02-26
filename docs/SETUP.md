# Setup Guide

Complete setup instructions for configuring a repository created from this template.

## 1. Replace Placeholders

Search and replace all placeholder values across the repository. The following files contain placeholders:

- `.github/workflows/ci.yml`
- `.github/workflows/feature-deploy.yml`
- `.github/workflows/release.yml`
- `.github/workflows/deploy-prod.yml`
- `.github/workflows/rollback.yml`
- `.github/CODEOWNERS`
- `package.json`
- `Dockerfile` (if customizing)

| Placeholder | Description | Example |
|---|---|---|
| `APP_NAME` | Application name | `my-service` |
| `GCP_PROJECT_ID` | GCP project ID | `mad-devops` |
| `GCP_REGION` | Cloud Run region | `us-east1` |
| `GCP_ARTIFACT_REGISTRY` | Docker registry path | `us-east1-docker.pkg.dev/mad-devops/images` |
| `CLOUD_RUN_SERVICE_DEV` | Dev Cloud Run service name | `my-service-dev` |
| `CLOUD_RUN_SERVICE_PROD` | Prod Cloud Run service name | `my-service` |
| `DEV_URL` | Dev environment URL | `https://my-service-dev.madhive.dev` |
| `PROD_URL` | Prod environment URL | `https://my-service.madhive.dev` |
| `DISPATCH_EVENT_DEPLOY` | Repository dispatch event type for deploys | `my-service-deploy-production` |
| `DISPATCH_EVENT_ROLLBACK` | Repository dispatch event type for rollback | `my-service-rollback` |

## 2. Configure GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

### Slack

| Secret | Description |
|---|---|
| `SLACK_WEBHOOK_URL` | Incoming webhook URL for the `#notify-builds` channel |

### GCP Authentication

| Secret | Description |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider resource name (e.g., `projects/123456/locations/global/workloadIdentityPools/github/providers/github`) |
| `GCP_SERVICE_ACCOUNT` | GCP service account email (e.g., `github-actions@mad-devops.iam.gserviceaccount.com`) |

### Jira Integration

| Secret | Description |
|---|---|
| `JIRA_DOMAIN` | Your Jira domain (e.g., `madhive.atlassian.net`) |
| `JIRA_EMAIL` | Email of the Jira API user |
| `JIRA_API_TOKEN` | Jira API token (generate at https://id.atlassian.com/manage-profile/security/api-tokens) |

## 3. Branch Protection Rules

Go to **Settings → Branches → Add branch protection rule** for `main`:

### Required Settings

- **Branch name pattern**: `main`
- **Require a pull request before merging**: ✅
  - Required number of approvals: `1` (or more)
  - Dismiss stale pull request approvals when new commits are pushed: ✅
- **Require status checks to pass before merging**: ✅
  - Required status checks:
    - `Lint, Test & Build` (from `ci.yml`)
    - `Dependency Review` (from `dependency-review.yml`)
- **Require branches to be up to date before merging**: ✅
- **Do not allow bypassing the above settings**: ✅ (recommended)

### Optional Settings

- **Require signed commits**: Recommended
- **Require linear history**: Recommended (enforces squash or rebase merging)
- **Restrict who can push to matching branches**: Add teams/users as needed

## 4. GCP Project Setup

### Artifact Registry

Create a Docker repository in Artifact Registry:

```bash
gcloud artifacts repositories create images \
  --repository-format=docker \
  --location=GCP_REGION \
  --project=GCP_PROJECT_ID \
  --description="Docker images"
```

### Cloud Run Services

Create the dev and prod Cloud Run services:

```bash
# Dev service
gcloud run deploy CLOUD_RUN_SERVICE_DEV \
  --image=gcr.io/cloudrun/placeholder \
  --region=GCP_REGION \
  --project=GCP_PROJECT_ID \
  --platform=managed \
  --allow-unauthenticated

# Prod service
gcloud run deploy CLOUD_RUN_SERVICE_PROD \
  --image=gcr.io/cloudrun/placeholder \
  --region=GCP_REGION \
  --project=GCP_PROJECT_ID \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=1 \
  --session-affinity
```

### Workload Identity Federation

Set up keyless authentication from GitHub Actions to GCP:

```bash
# Create a Workload Identity Pool
gcloud iam workload-identity-pools create github \
  --project=GCP_PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions"

# Create a provider
gcloud iam workload-identity-pools providers create-oidc github \
  --project=GCP_PROJECT_ID \
  --location=global \
  --workload-identity-pool=github \
  --display-name="GitHub" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Create a service account
gcloud iam service-accounts create github-actions \
  --project=GCP_PROJECT_ID \
  --display-name="GitHub Actions"

# Grant required roles
gcloud projects add-iam-policy-binding GCP_PROJECT_ID \
  --member="serviceAccount:github-actions@GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding GCP_PROJECT_ID \
  --member="serviceAccount:github-actions@GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding GCP_PROJECT_ID \
  --member="serviceAccount:github-actions@GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Allow GitHub Actions to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@GCP_PROJECT_ID.iam.gserviceaccount.com \
  --project=GCP_PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/ORG_NAME/REPO_NAME"
```

Replace `PROJECT_NUMBER`, `ORG_NAME`, and `REPO_NAME` with your values. Get your project number with:

```bash
gcloud projects describe GCP_PROJECT_ID --format="value(projectNumber)"
```

## 5. Slack Webhook Configuration

### Incoming Webhook (Notifications)

1. Go to your Slack workspace's app management
2. Create or use an existing Slack App
3. Enable **Incoming Webhooks**
4. Add a webhook for the `#notify-builds` channel
5. Copy the webhook URL and add it as the `SLACK_WEBHOOK_URL` secret

### Shared Webhook Service (Interactive Buttons)

The "Promote to Production" and "Rollback" buttons require the centralized Slack webhook service (`madhive/security` pattern). This service:

1. Receives Slack interactive payloads
2. Validates the action (`approve_deployment` or `rollback_deployment`)
3. Decodes the base64 payload from the button value
4. Checks expiry timestamps
5. Sends a `repository_dispatch` event to the target repository

The dispatch event types must match the `DISPATCH_EVENT_DEPLOY` and `DISPATCH_EVENT_ROLLBACK` placeholders configured in the workflows.

The `repository_dispatch` payload should include:
- `image_tag`: The Docker image tag to deploy
- `approved_by`: The Slack user who clicked the button
- `sha`: The git commit SHA

## 6. Jira API Token

1. Log in to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Give it a descriptive name (e.g., "GitHub Actions - APP_NAME")
4. Copy the token and add it as the `JIRA_API_TOKEN` secret
5. Add the associated email as `JIRA_EMAIL`
6. Add your Jira domain (e.g., `madhive.atlassian.net`) as `JIRA_DOMAIN`

## 7. CODEOWNERS

Update `.github/CODEOWNERS` with your team's GitHub handles:

```
* @madhive/your-team
.github/ @madhive/platform-team
Dockerfile @madhive/platform-team
```

## 8. Verification Checklist

After completing setup, verify:

- [ ] All placeholder values have been replaced
- [ ] All GitHub secrets are configured
- [ ] Branch protection is enabled on `main`
- [ ] Push a feature branch and confirm the feature-deploy workflow runs
- [ ] Open a PR to `main` and confirm CI + dependency review workflows run
- [ ] Merge a PR and confirm the release workflow creates a version tag
- [ ] Verify Slack notifications appear in `#notify-builds`
- [ ] Test the "Promote to Production" button flow
- [ ] Test the "Rollback" button flow
