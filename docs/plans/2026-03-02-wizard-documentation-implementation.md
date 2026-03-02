# Dashboard Wizard Documentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add comprehensive Dashboard Wizard user documentation to the main README.md

**Architecture:** Insert a new "Using the Dashboard Wizard" section after Quick Start and before the existing WYSIWYG Editor section. Add cross-reference link from Quick Start.

**Tech Stack:** Markdown documentation

---

## Task 1: Add Dashboard Wizard Section to README

**Files:**
- Modify: `README.md` (insert at line ~45, after Quick Start section)

**Step 1: Read current README structure**

```bash
head -80 README.md
```

Expected: See Quick Start section ending around line 74, followed by "Using the WYSIWYG Editor" section starting around line 76

**Step 2: Insert wizard documentation section**

Insert the following section after the Quick Start section (before "Using the WYSIWYG Editor"):

```markdown
## Using the Dashboard Wizard

The Dashboard Wizard provides a guided workflow for creating beautiful TV dashboards. It walks you through selecting data sources, choosing metrics, and customizing the visual presentation - perfect for first-time users or when you want a structured approach.

**Access:** Navigate to `/app/dashboard/wizard` or click "Dashboard Creation Wizard" from the home page.

### Step 1: Dashboard Purpose

Choose what you're monitoring to get relevant metric suggestions:

- **Infrastructure** - System health, performance, uptime (servers, databases, networks)
- **Application** - Deployments, errors, user activity (APIs, services, apps)
- **Business Metrics** - Tickets, sprints, team capacity (Jira, project management)
- **Mixed** - Combination of infrastructure, application, and business metrics

Your selection helps the wizard recommend appropriate metrics and layouts in later steps.

### Step 2: Select Data Sources

Choose which systems to pull data from:

- **GCP Monitoring** - Cloud infrastructure metrics (Cloud Run, Compute Engine, BigQuery, Pub/Sub)
- **DataDog** - AWS service monitoring (ready for configuration)
- **GitHub Actions** - CI/CD pipeline metrics (ready for configuration)
- **Jira** - Ticket management (ready for configuration)

The wizard tests each connection and shows available metric counts. You can select multiple sources.

### Step 3: Pick Your Metrics

Browse and select specific metrics organized by category:

- **Performance** - Latency, throughput, response times
- **Errors** - Error rates, failed requests, exceptions
- **Resources** - CPU, memory, disk, network usage
- **Deployments** - Build status, deployment frequency

For each metric, the wizard suggests the best visualization type (big number, gauge, trend chart, or status indicator). Drag to reorder metrics by priority.

### Step 4: Choose Visual Style

Customize how your dashboard looks:

**Layout Options:**
- **Grid** - Evenly distributed widgets
- **Hero + Grid** - Large hero metric with supporting widgets below
- **Sidebar + Main** - Key metrics in sidebar, main chart area

**Animation Intensity:**
- **Subtle** - Minimal motion, professional
- **Moderate** - Smooth transitions (recommended for TV)
- **Bold** - Eye-catching effects, glows, pulses

**Color Schemes:**
- **MadHive Brand** - Purple/pink gradients (default)
- **Dark Minimal** - High contrast, less color
- **Vibrant** - Full color spectrum

### Step 5: Preview & Refine

Review your dashboard before deployment. You can:
- See the full dashboard layout
- Verify all data sources are connected
- Make final adjustments to widget positions

### Step 6: Deploy to TV

Configure final settings:

- **Dashboard Name** - Used in the dashboard list and URL
- **Refresh Interval** - How often data updates (30s, 1m, 5m, or 15m)
- **Auto-start** - Full-screen mode on page load

Once deployed, you'll receive:
- **Display URL** - Open this on your office TV (e.g., `http://tv.madhive.dev/dashboard/infrastructure-health`)
- **Edit URL** - Return here to make changes

**Next Steps:**
1. Open the Display URL on your TV browser
2. Press F11 for full-screen mode
3. Dashboard auto-refreshes at your configured interval

For advanced customization after deployment, use the [WYSIWYG Editor](#using-the-wysiwyg-editor).
```

**Step 3: Add cross-reference link in Quick Start**

Find the Quick Start section and add this line after the "Server runs at" line (around line 65):

```markdown
**Create dashboards:** Use the [Dashboard Wizard](#using-the-dashboard-wizard) for guided dashboard creation.
```

**Step 4: Verify markdown formatting**

```bash
# Check that markdown headings are properly formatted
grep "^## " README.md | head -20

# Verify anchor links will work
grep "\[.*\](#.*)" README.md
```

Expected: All headings use ## for main sections, ### for subsections, anchor links use lowercase with hyphens

**Step 5: Preview the changes**

```bash
# Show the new section
sed -n '/^## Using the Dashboard Wizard/,/^## Using the WYSIWYG Editor/p' README.md
```

Expected: See the complete wizard section with all 6 steps, proper formatting, ending just before WYSIWYG Editor section

**Step 6: Commit the documentation**

```bash
git add README.md
git commit -m "docs: add Dashboard Wizard user guide to README

- Comprehensive 6-step wizard walkthrough
- Added after Quick Start section
- Cross-reference link from Quick Start
- Links to WYSIWYG Editor for advanced customization

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verification Checklist

After implementation, verify:

- [ ] New "Using the Dashboard Wizard" section appears after Quick Start
- [ ] Section appears before "Using the WYSIWYG Editor"
- [ ] All 6 steps are documented with clear descriptions
- [ ] Cross-reference link from Quick Start works
- [ ] Link to WYSIWYG Editor at end of wizard section works
- [ ] Markdown formatting is correct (headings, bold, lists)
- [ ] No broken links or references
- [ ] Word count is approximately 470 words for the wizard section

---

## Testing the Documentation

**Manual validation:**

1. Read through the Quick Start section - verify wizard link is present
2. Click the wizard link (in a markdown previewer) - should jump to wizard section
3. Read through all 6 wizard steps - verify they match the actual wizard implementation
4. Click the WYSIWYG Editor link at the end - should jump to that section
5. Verify all bullet points render correctly
6. Check that bold text renders correctly

**GitHub preview:**
1. Push branch to GitHub
2. View README.md in GitHub web interface
3. Verify all formatting renders correctly
4. Test all anchor links work

---

## Notes

**Design Reference:** See `docs/plans/2026-03-02-wizard-documentation-design.md` for the approved design.

**Wizard Implementation:** See PR #22 and `docs/plans/2026-02-27-dashboard-wizard-design.md` for technical details about the wizard features being documented.

**Tone:** User-focused, non-technical, step-by-step guidance for dashboard creators.

**No Testing Required:** This is documentation-only change. No code tests needed.

**Maintenance:** If wizard features change (new steps, different options), this documentation must be updated to match.
