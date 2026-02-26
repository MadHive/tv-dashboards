# GitHub Build Template

A standardized CI/CD template repository for MadHive services. Provides a ready-to-go build/deploy pipeline with Slack notifications, branch protection, dependency scanning, and a Slack-driven promotion process (dev → prod) targeting GCP Cloud Run with a Bun/TypeScript stack.

## Promotion Flow

```
Feature branch push → Build → Deploy to dev → Slack notify
                                    ↓
PR merged to main → Test → Version bump → Build → Deploy to dev
                                    ↓
                    Slack: "Promote to Production" button (8hr expiry)
                                    ↓
              Shared webhook → repository_dispatch → Deploy to prod
                                    ↓
                    Slack: "Deployed!" with Rollback button
                                    ↓
              Shared webhook → repository_dispatch → Rollback
```

## Quick Start

1. Click **Use this template** to create a new repository
2. Replace all placeholder values (see [Customization Points](#customization-points))
3. Configure required secrets (see [Required Secrets](#required-secrets))
4. Set up branch protection rules (see [docs/SETUP.md](docs/SETUP.md))
5. Push a feature branch to verify the pipeline

## Customization Points

Search and replace these placeholders throughout the repository:

| Placeholder | Description | Example |
|---|---|---|
| `APP_NAME` | Application name | `my-service` |
| `GCP_PROJECT_ID` | GCP project | `mad-devops` |
| `GCP_REGION` | Cloud Run region | `us-east1` |
| `GCP_ARTIFACT_REGISTRY` | Docker registry path | `us-east1-docker.pkg.dev/mad-devops/images` |
| `CLOUD_RUN_SERVICE_DEV` | Dev service name | `my-service-dev` |
| `CLOUD_RUN_SERVICE_PROD` | Prod service name | `my-service` |
| `DEV_URL` | Dev environment URL | `https://my-service-dev.madhive.dev` |
| `PROD_URL` | Prod environment URL | `https://my-service.madhive.dev` |
| `DISPATCH_EVENT_DEPLOY` | Repository dispatch event name | `my-service-deploy-production` |
| `DISPATCH_EVENT_ROLLBACK` | Rollback dispatch event name | `my-service-rollback` |

## Required Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `SLACK_WEBHOOK_URL` | Post to `#notify-builds` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | GCP auth via OIDC |
| `GCP_SERVICE_ACCOUNT` | GCP service account |
| `JIRA_DOMAIN` | Jira instance URL |
| `JIRA_EMAIL` | Jira API user email |
| `JIRA_API_TOKEN` | Jira API token |

## Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PRs to `main` | Lint, test, build checks |
| `dependency-review.yml` | PRs to `main` | Dependency vulnerability scanning |
| `feature-deploy.yml` | Push to feature branches | Deploy to dev environment |
| `release.yml` | Push to `main` | Version bump, deploy to dev, request prod approval |
| `deploy-prod.yml` | `repository_dispatch` | Deploy to production (Slack-triggered) |
| `rollback.yml` | `repository_dispatch` | Rollback production (Slack-triggered) |

## Shared Slack Webhook Service

This template relies on a centralized Slack webhook service (not bundled per repo) that handles interactive button payloads from Slack. The webhook service:

- Receives Slack interaction payloads (`approve_deployment`, `rollback_deployment` action IDs)
- Detects the target service/repository from the payload
- Sends a `repository_dispatch` event to the appropriate repository
- Validates expiry timestamps on approval payloads

See [docs/SETUP.md](docs/SETUP.md) for full setup instructions.
