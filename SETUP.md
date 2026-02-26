# TV Dashboards - Setup Guide

Simple setup guide for Slack notifications and Jira integration.

## GitHub Secrets Configuration

Go to: **https://github.com/MadHive/tv-dashboards/settings/secrets/actions**

Add these repository secrets:

### 1. Slack Webhook (Required)
```
Name: SLACK_WEBHOOK_URL
Value: <your-slack-webhook-url>
```
*Note: Get webhook URL from Slack App settings in #notify-builds channel*

### 2. Jira Domain (Required for Jira integration)
```
Name: JIRA_DOMAIN
Value: madhive.atlassian.net
```

### 3. Jira Email (Required for Jira integration)
```
Name: JIRA_EMAIL
Value: <your-jira-email>
```
*Note: Use your Jira account email address*

### 4. Jira API Token (Required for Jira integration)
```
Name: JIRA_API_TOKEN
Value: <your-jira-api-token>
```
*Note: Generate token at: https://id.atlassian.com/manage-profile/security/api-tokens*

## Workflows

### CI Workflow (`ci.yml`)
**Trigger:** Pull requests to `main`

**Actions:**
- Install dependencies
- Run lint
- Run typecheck
- Run tests
- Build

**Notifications:**
- ✅ Success → Slack notification in #notify-builds
- ❌ Failure → Slack notification in #notify-builds

### PR Merged Workflow (`pr-merged.yml`)
**Trigger:** PR merged to `main`

**Actions:**
- Extract Jira ticket from branch name or PR title
- Post comment to Jira ticket (if found)
- Send Slack notification

**Jira Ticket Detection:**
- Looks for pattern: `[A-Z]+-[0-9]+` (e.g., `PLAT-123`, `ENG-456`)
- Checks branch name first, then PR title
- Example branch: `feature/PLAT-123-add-widget`
- Example title: `[PLAT-123] Add new widget type`

### Dependency Review (`dependency-review.yml`)
**Trigger:** Pull requests to `main`

**Actions:**
- Scans dependencies for security vulnerabilities
- Fails if high/critical vulnerabilities found

## Testing the Setup

### Test CI Workflow
```bash
# Create a test branch
git checkout -b test/ci-workflow

# Make a change
echo "# Test" >> README.md
git add README.md
git commit -m "Test CI workflow"
git push origin test/ci-workflow

# Create PR
gh pr create --title "Test CI" --body "Testing CI notifications"
```

Expected:
- CI runs (lint, test, build)
- Slack notification on completion (success or failure)

### Test PR Merge with Jira
```bash
# Create branch with Jira ticket
git checkout -b feature/PLAT-123-test-jira

# Make change and push
echo "# Test Jira" >> README.md
git add README.md
git commit -m "[PLAT-123] Test Jira integration"
git push origin feature/PLAT-123-test-jira

# Create and merge PR
gh pr create --title "[PLAT-123] Test Jira integration" --body "Testing Jira comment"
gh pr merge --squash
```

Expected:
- PR merged to main
- Comment added to PLAT-123 in Jira
- Slack notification of merge

## Running Locally

### Prerequisites
- Bun runtime installed
- GCP credentials (for live data)

### Start Server
```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

Server runs at: **http://tv.madhive.local** (port 80)

### Environment Variables
```bash
# Use live GCP data (optional)
export USE_REAL_DATA=true

# VulnTrack integration (optional)
export VULNTRACK_API_URL=https://vulntrack.madhive.dev
export VULNTRACK_API_KEY=your-api-key
```

### Run Tests
```bash
# Run all test suites
bun run test

# Or run individually
bun run test-phase3.js  # Configuration persistence
bun run test-phase4.js  # Data source plugins
bun run test-phase5.js  # Widget palette & templates
```

## Slack Notifications

All notifications go to **#notify-builds** channel.

**Notification Types:**
- ✅ **CI Passed** - PR passed all checks
- ❌ **CI Failed** - PR failed checks (with link to failed run)
- 🎉 **PR Merged** - PR successfully merged to main

## Jira Integration

**How it works:**
1. Create branch with Jira ticket in name (e.g., `feature/PLAT-123-description`)
2. Or include ticket in PR title (e.g., `[PLAT-123] Description`)
3. When PR is merged, comment is automatically added to the ticket

**Comment includes:**
- PR URL
- PR title
- PR author

## Troubleshooting

### Slack notifications not working
- Verify `SLACK_WEBHOOK_URL` secret is set correctly
- Test webhook: `curl -X POST -H 'Content-Type: application/json' -d '{"text":"Test"}' <webhook-url>`

### Jira comments not appearing
- Verify all 3 Jira secrets are set (DOMAIN, EMAIL, API_TOKEN)
- Check branch/PR title contains valid Jira ticket (e.g., `PLAT-123`)
- Verify ticket exists and is accessible
- Check GitHub Actions logs for errors

### CI failing
- Check GitHub Actions tab for specific error
- Common issues:
  - Missing dependencies: `bun install`
  - Test failures: `bun run test`
  - Lint errors: `bun run lint`

## Security Notes

- Never commit secrets to the repository
- Use GitHub Secrets for all sensitive data
- Rotate Jira API tokens regularly
- Slack webhook URL should be kept private

## Next Steps

1. ✅ Configure GitHub secrets (above)
2. ✅ Test workflows with a PR
3. ✅ Verify Slack notifications
4. ✅ Verify Jira integration
5. ✅ Review notification preferences
6. ✅ Set up monitoring as needed

---

**Questions?** Contact #platform-engineering in Slack
