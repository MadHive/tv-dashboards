# Deployment Setup Guide

This guide covers configuring the tv-dashboards repository for automated CI/CD with Slack notifications.

## Overview

The repository is configured with GitHub Actions workflows for:
- **CI checks** on pull requests
- **Feature deployment** to dev environment
- **Release deployment** to dev with production promotion
- **Production deployment** via Slack approval
- **Rollback** via Slack button

## Required Secrets

Configure these in **Settings → Secrets and variables → Actions → Repository secrets**:

### 1. Slack Webhook
```
Name: SLACK_WEBHOOK_URL
Value: <webhook-url-from-slack>
```

**How to create:**
1. Go to https://api.slack.com/apps
2. Create new app or select existing
3. Add "Incoming Webhooks" feature
4. Create webhook for `#notify-builds` channel
5. Copy webhook URL

### 2. GCP Workload Identity Provider
```
Name: GCP_WORKLOAD_IDENTITY_PROVIDER
Value: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_NAME/providers/PROVIDER_NAME
```

**How to create:**
```bash
# Enable required APIs
gcloud services enable iamcredentials.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
gcloud services enable sts.googleapis.com

# Create workload identity pool
gcloud iam workload-identity-pools create "github-actions" \
  --project="mad-master" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="mad-master" \
  --location="global" \
  --workload-identity-pool="github-actions" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Get the provider resource name
gcloud iam workload-identity-pools providers describe "github-provider" \
  --project="mad-master" \
  --location="global" \
  --workload-identity-pool="github-actions" \
  --format="value(name)"
```

### 3. GCP Service Account
```
Name: GCP_SERVICE_ACCOUNT
Value: github-actions@mad-master.iam.gserviceaccount.com
```

**How to create:**
```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --project="mad-master" \
  --display-name="GitHub Actions" \
  --description="Service account for GitHub Actions deployments"

# Grant necessary roles
gcloud projects add-iam-policy-binding mad-master \
  --member="serviceAccount:github-actions@mad-master.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding mad-master \
  --member="serviceAccount:github-actions@mad-master.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding mad-master \
  --member="serviceAccount:github-actions@mad-master.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Allow GitHub to impersonate this service account
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@mad-master.iam.gserviceaccount.com \
  --project="mad-master" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/attribute.repository/MadHive/tv-dashboards"
```

### 4. Jira Integration (Optional)
```
Name: JIRA_DOMAIN
Value: madhive.atlassian.net

Name: JIRA_EMAIL
Value: your-bot@madhive.com

Name: JIRA_API_TOKEN
Value: <api-token>
```

**How to create:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create API token
3. Copy token value

## Environment Configuration

The workflows are configured with these values:

```yaml
GCP_PROJECT_ID: mad-master
GCP_REGION: us-east1
GCP_ARTIFACT_REGISTRY: us-east1-docker.pkg.dev/mad-master/images
CLOUD_RUN_SERVICE_DEV: tv-dashboards-dev
CLOUD_RUN_SERVICE_PROD: tv-dashboards
DEV_URL: https://tv-dashboards-dev.madhive.dev
PROD_URL: https://tv-dashboards.madhive.dev
APP_NAME: tv-dashboards
```

## Cloud Run Services Setup

### Create Dev Service
```bash
gcloud run deploy tv-dashboards-dev \
  --image=us-east1-docker.pkg.dev/mad-master/images/tv-dashboards:latest \
  --region=us-east1 \
  --project=mad-master \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="USE_REAL_DATA=true" \
  --set-env-vars="NODE_ENV=development"
```

### Create Prod Service
```bash
gcloud run deploy tv-dashboards \
  --image=us-east1-docker.pkg.dev/mad-master/images/tv-dashboards:latest \
  --region=us-east1 \
  --project=mad-master \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=20 \
  --set-env-vars="USE_REAL_DATA=true" \
  --set-env-vars="NODE_ENV=production"
```

### Configure Environment Variables

For services requiring GCP credentials:
```bash
# Create service account for runtime
gcloud iam service-accounts create tv-dashboards-runtime \
  --project="mad-master" \
  --display-name="TV Dashboards Runtime"

# Grant monitoring reader role
gcloud projects add-iam-policy-binding mad-master \
  --member="serviceAccount:tv-dashboards-runtime@mad-master.iam.gserviceaccount.com" \
  --role="roles/monitoring.viewer"

# Grant BigQuery reader role
gcloud projects add-iam-policy-binding mad-data \
  --member="serviceAccount:tv-dashboards-runtime@mad-master.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

# Update Cloud Run service to use this account
gcloud run services update tv-dashboards-dev \
  --service-account=tv-dashboards-runtime@mad-master.iam.gserviceaccount.com \
  --region=us-east1 \
  --project=mad-master

gcloud run services update tv-dashboards \
  --service-account=tv-dashboards-runtime@mad-master.iam.gserviceaccount.com \
  --region=us-east1 \
  --project=mad-master
```

For VulnTrack integration:
```bash
# Add VulnTrack secrets
gcloud run services update tv-dashboards-dev \
  --update-env-vars=VULNTRACK_API_URL=https://vulntrack.madhive.dev \
  --update-secrets=VULNTRACK_API_KEY=vulntrack-api-key:latest \
  --region=us-east1 \
  --project=mad-master

gcloud run services update tv-dashboards \
  --update-env-vars=VULNTRACK_API_URL=https://vulntrack.madhive.dev \
  --update-secrets=VULNTRACK_API_KEY=vulntrack-api-key:latest \
  --region=us-east1 \
  --project=mad-master
```

## Artifact Registry Setup

```bash
# Create repository if it doesn't exist
gcloud artifacts repositories create images \
  --repository-format=docker \
  --location=us-east1 \
  --project=mad-master \
  --description="Docker images for MadHive services"
```

## DNS Configuration

Configure Cloud Run domain mappings:

```bash
# Map dev domain
gcloud run domain-mappings create \
  --service=tv-dashboards-dev \
  --domain=tv-dashboards-dev.madhive.dev \
  --region=us-east1 \
  --project=mad-master

# Map prod domain
gcloud run domain-mappings create \
  --service=tv-dashboards \
  --domain=tv-dashboards.madhive.dev \
  --region=us-east1 \
  --project=mad-master
```

Then add DNS records:
```
tv-dashboards-dev.madhive.dev → CNAME → ghs.googlehosted.com
tv-dashboards.madhive.dev → CNAME → ghs.googlehosted.com
```

## Branch Protection Rules

Configure in **Settings → Branches → Branch protection rules**:

### For `main` branch:
- ✅ Require pull request before merging
  - ✅ Require approvals: 1
  - ✅ Dismiss stale reviews
- ✅ Require status checks before merging
  - ✅ Require branches to be up to date
  - Add required checks:
    - `Lint, Test & Build`
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings
- ✅ Allow force pushes: **OFF**
- ✅ Allow deletions: **OFF**

## Workflow Triggers

### CI Workflow (`ci.yml`)
- **Trigger:** Pull requests to `main`
- **Actions:** Lint, typecheck, test, build
- **Notifications:** Slack on failure

### Feature Deploy (`feature-deploy.yml`)
- **Trigger:** Push to any branch except `main` and `dependabot/**`
- **Actions:** Build Docker image, deploy to dev, update Jira
- **Notifications:** Slack on start, success, and failure

### Release (`release.yml`)
- **Trigger:** Push to `main`
- **Actions:** Bump version, deploy to dev, request prod approval
- **Notifications:** Slack with "Promote to Production" button (8hr expiry)

### Deploy Prod (`deploy-prod.yml`)
- **Trigger:** `repository_dispatch` event from Slack webhook
- **Actions:** Deploy to production
- **Notifications:** Slack with "Rollback" button

### Rollback (`rollback.yml`)
- **Trigger:** `repository_dispatch` event from Slack webhook
- **Actions:** Rollback to previous version
- **Notifications:** Slack confirmation

## Slack Webhook Service

The production promotion and rollback workflows require a centralized Slack webhook service (not included in this repo) that:

1. Receives Slack interactive button payloads
2. Validates expiry timestamps
3. Sends `repository_dispatch` events to GitHub
4. Handles callbacks for both approval and rollback

**Event types:**
- `tv-dashboards-deploy-production` - Deploy to prod
- `tv-dashboards-rollback` - Rollback prod

## Testing the Setup

### 1. Test CI
```bash
# Create feature branch
git checkout -b test/ci-check

# Make a change
echo "# Test" >> README.md

# Commit and push
git add README.md
git commit -m "Test CI workflow"
git push origin test/ci-check

# Create PR
gh pr create --title "Test CI" --body "Testing CI workflow"
```

Expected: CI workflow runs, Slack notified on failure (if any)

### 2. Test Feature Deploy
```bash
# Push to feature branch
git push origin test/ci-check
```

Expected:
- Build starts (Slack notification)
- Docker image built and pushed
- Deployed to dev
- Jira comment added (if ticket in branch name)
- Success notification in Slack

### 3. Test Release
```bash
# Merge PR to main
gh pr merge --squash
```

Expected:
- Version bumped
- Deployed to dev
- Slack notification with "Promote to Production" button

### 4. Test Production Deploy
Click "Promote to Production" button in Slack

Expected:
- Deploys to production
- Slack notification with "Rollback" button

### 5. Test Rollback
Click "Rollback" button in Slack

Expected:
- Previous version restored
- Slack confirmation

## Monitoring

### View Workflows
```bash
# List recent workflow runs
gh run list

# View specific run
gh run view <run-id>

# Watch live run
gh run watch
```

### View Logs
```bash
# Cloud Run logs (dev)
gcloud run services logs read tv-dashboards-dev \
  --region=us-east1 \
  --project=mad-master \
  --limit=50

# Cloud Run logs (prod)
gcloud run services logs read tv-dashboards \
  --region=us-east1 \
  --project=mad-master \
  --limit=50
```

### Health Checks
```bash
# Dev health check
curl https://tv-dashboards-dev.madhive.dev/health

# Prod health check
curl https://tv-dashboards.madhive.dev/health
```

## Troubleshooting

### Workflow fails with authentication error
- Check GCP_WORKLOAD_IDENTITY_PROVIDER secret
- Check GCP_SERVICE_ACCOUNT secret
- Verify service account has correct roles
- Verify workload identity binding

### Slack notifications not working
- Check SLACK_WEBHOOK_URL secret
- Verify webhook is active in Slack
- Check webhook URL format

### Deploy fails with permission error
- Check service account roles
- Verify Artifact Registry permissions
- Verify Cloud Run permissions

### Health check fails after deploy
- Check service is running: `gcloud run services describe tv-dashboards-dev`
- Check logs for errors
- Verify port 3000 is exposed
- Check environment variables

## Security Notes

- Never commit secrets to the repository
- Use GitHub Secrets for all sensitive data
- Use Workload Identity Federation (no service account keys)
- Rotate Slack webhooks and API tokens regularly
- Use least-privilege IAM roles
- Enable branch protection on `main`

## Next Steps

After completing this setup:

1. ✅ Configure all GitHub secrets
2. ✅ Set up GCP services and permissions
3. ✅ Enable branch protection
4. ✅ Test workflows end-to-end
5. ✅ Configure Slack webhook service
6. ✅ Set up DNS mappings
7. ✅ Configure monitoring and alerts
8. ✅ Document any custom environment variables

---

**Questions?** Contact the DevOps team or check #platform-engineering in Slack.
