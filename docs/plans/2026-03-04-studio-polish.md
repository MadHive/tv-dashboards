# Studio UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 Studio UX gaps: missing widget types in the properties type selector, aggregation/time-window shown for non-GCP sources, query editor unaware of computed source, display section not shown for line-chart/bar-chart, stacked-bar-chart missing from preview selector, table min-height CSS, misleading position hint text, and empty query dropdown feedback.

**Architecture:** All changes are in `public/studio.html`, `public/js/studio.js`, and `public/css/dashboard.css`. No server changes needed. No new tests (all UI-only). Each task is a small targeted edit followed by a visual verification and commit.

**Tech Stack:** Vanilla JS, existing Studio infrastructure.

---

### Task 1: Properties panel — add 4 new widget types + expand Display section

**Files:**
- Modify: `public/studio.html` (~lines 187-200)
- Modify: `public/js/studio.js` (~lines 471, 504)

**Context:** The `#prop-type` select in the widget properties panel is missing `line-chart`, `table`, `multi-metric-card`, and `stacked-bar-chart`. The `showDisplayTypes` arrays (used to show/hide the Unit/Min/Max section) also need `line-chart` and `bar-chart` so users can set units on chart widgets.

**Step 1: Add 4 types to `#prop-type` in `public/studio.html`**

Find the `#prop-type` select block (lines 187-200):
```html
                  <option value="security-scorecard">Security Scorecard</option>
                </select>
```

Add these 4 options before the closing `</select>`:
```html
                  <option value="line-chart">Line Chart</option>
                  <option value="table">Table</option>
                  <option value="multi-metric-card">Multi Metric</option>
                  <option value="stacked-bar-chart">Stacked Bar</option>
```

**Step 2: Expand `showDisplayTypes` in `public/js/studio.js` (2 occurrences)**

Find the first occurrence (~line 471):
```js
        const showDisplayTypes = ['gauge', 'gauge-row', 'progress-bar', 'big-number', 'stat-card'];
```
Replace with:
```js
        const showDisplayTypes = ['gauge', 'gauge-row', 'progress-bar', 'big-number', 'stat-card', 'line-chart', 'bar-chart'];
```

Find the second occurrence (~line 504):
```js
          const showDisplayTypes = ['gauge', 'gauge-row', 'progress-bar', 'big-number', 'stat-card'];
```
Replace with:
```js
          const showDisplayTypes = ['gauge', 'gauge-row', 'progress-bar', 'big-number', 'stat-card', 'line-chart', 'bar-chart'];
```

**Step 3: Restart and verify**
```bash
sudo systemctl restart tv-dashboards && sleep 2
curl -s http://tv:3000/admin | python3 -c "
import sys; h = sys.stdin.read()
for t in ['line-chart', 'table', 'multi-metric-card', 'stacked-bar-chart']:
    print(t, 'in prop-type:', 'prop-type' in h and t in h)
"
```

**Step 4: Commit**
```bash
git add public/studio.html public/js/studio.js
git commit -m "fix: add line-chart, table, multi-metric-card, stacked-bar-chart to widget type selector; show Display section for chart types"
```

---

### Task 2: Query editor — source-aware field visibility

**Files:**
- Modify: `public/studio.html` (~line 324 — add id to the qe-row div)
- Modify: `public/js/studio.js` (~line 1220 — `openQueryEditor()`)

**Context:** The query editor panel always shows Time Window and Aggregation fields even for BigQuery and Computed queries where they don't apply. The Metric/SQL label is also confusing for Computed queries (which have a function name, not a metric type or SQL).

**Step 1: Add `id="qe-gcp-row"` to the time-window/aggregation div in `public/studio.html`**

Find (around line 324):
```html
          <div class="qe-row">
            <label class="qe-label">Time Window
```

Replace with:
```html
          <div class="qe-row" id="qe-gcp-row">
            <label class="qe-label">Time Window
```

Also find the Metric/SQL label (around line 321):
```html
          <label class="qe-label">Metric / SQL
```
Add an id to the label so we can update its text:
```html
          <label class="qe-label" id="qe-metric-label">Metric / SQL
```

**Step 2: Update `openQueryEditor()` in `public/js/studio.js` to show/hide GCP fields**

Find `openQueryEditor(query, source)` (~line 1220). After the line:
```js
      document.getElementById('qe-source-badge').textContent = source;
```

Add the following source-aware field visibility logic:
```js
      // Show/hide GCP-only fields based on source
      const gcpRow     = document.getElementById('qe-gcp-row');
      const metricLabel = document.getElementById('qe-metric-label');
      const metricInput = document.getElementById('qe-metric');
      const isGcp      = source === 'gcp';
      const isComputed = source === 'computed';

      if (gcpRow) gcpRow.style.display = isGcp ? '' : 'none';

      if (metricLabel) {
        if (isComputed)      metricLabel.childNodes[0].textContent = 'Function ID';
        else if (!isGcp)     metricLabel.childNodes[0].textContent = 'SQL Query';
        else                 metricLabel.childNodes[0].textContent = 'Metric Type';
      }

      if (metricInput) {
        metricInput.readOnly  = isComputed; // computed functions can't be renamed inline
        metricInput.style.color = isComputed ? 'var(--t3)' : '';
      }
```

**Step 3: Restart and manual test**
```bash
sudo systemctl restart tv-dashboards && sleep 2
```

Open `/admin` → Queries tab → click a GCP query → Time Window and Aggregation show.
Click a BigQuery query → Time Window and Aggregation hidden, label says "SQL Query".
Click a Computed query → Time Window and Aggregation hidden, label says "Function ID", metric input is read-only.

**Step 4: Commit**
```bash
git add public/studio.html public/js/studio.js
git commit -m "fix: hide GCP-only fields in query editor for BigQuery/computed sources, rename metric label by source"
```

---

### Task 3: Low-priority polish — preview selector, table CSS, hint text, empty dropdown

**Files:**
- Modify: `public/studio.html` (2 changes)
- Modify: `public/css/dashboard.css` (1 change)
- Modify: `public/js/studio.js` (1 change)

**Step 1: Add `stacked-bar-chart` to `#qe-preview-type` in `public/studio.html`**

Find `#qe-preview-type` (around line 350). After the `multi-metric-card` option:
```html
                <option value="multi-metric-card">Multi Metric</option>
```
Add:
```html
                <option value="stacked-bar-chart">Stacked Bar</option>
```

**Step 2: Fix misleading position hint text in `public/studio.html`**

Find (around line 235):
```html
              <p class="props-hint">Drag widget to reposition · drag handles to resize · or type below</p>
```
Replace with:
```html
              <p class="props-hint">Drag to reposition · resize handles for col/row spans · or edit below</p>
```

**Step 3: Add table widget min-height to `public/css/dashboard.css`**

Find `.widget-content` (around line 255):
```css
.widget-content {
```
After its closing `}`, add:
```css

/* Table widgets need at least 2 rows of content to be usable */
.widget-table .widget-content {
  min-height: 140px;
}
```

**Step 4: Add empty-state feedback to `loadQueryOptions()` in `public/js/studio.js`**

Find `loadQueryOptions(source, selectedId)` (~line 617). Find the try block:
```js
        if (Array.isArray(queries)) {
          queries.forEach((q) => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.name;
            if (q.id === selectedId) opt.selected = true;
            sel.appendChild(opt);
          });
        }
```

Replace with:
```js
        if (Array.isArray(queries) && queries.length > 0) {
          queries.forEach((q) => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.name;
            if (q.id === selectedId) opt.selected = true;
            sel.appendChild(opt);
          });
        } else {
          const emptyOpt = document.createElement('option');
          emptyOpt.value = '';
          emptyOpt.disabled = true;
          emptyOpt.textContent = 'No saved queries for this source';
          sel.appendChild(emptyOpt);
        }
```

Also apply the same empty-state to `loadPaletteQueries()` (~line 1068). Find:
```js
        if (Array.isArray(queries)) {
          queries.forEach((q) => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.name;
            sel.appendChild(opt);
          });
        }
```

Replace with:
```js
        if (Array.isArray(queries) && queries.length > 0) {
          queries.forEach((q) => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.name;
            sel.appendChild(opt);
          });
        } else {
          const emptyOpt = document.createElement('option');
          emptyOpt.value = '';
          emptyOpt.disabled = true;
          emptyOpt.textContent = 'No saved queries for this source';
          sel.appendChild(emptyOpt);
        }
```

**Step 5: Restart and verify**
```bash
sudo systemctl restart tv-dashboards && sleep 2 && sudo systemctl is-active tv-dashboards
```

Manual checks:
- Query editor preview type dropdown shows "Stacked Bar" option
- Position section hint says "Drag to reposition · resize handles..."
- Add a table widget with rowSpan=1 → canvas shows at least 140px of height
- In widget properties, switch source to "vulntrack" or another source with no queries → dropdown shows "No saved queries for this source" (disabled)

**Step 6: Commit**
```bash
git add public/studio.html public/css/dashboard.css public/js/studio.js
git commit -m "fix: add stacked-bar-chart to preview selector, table min-height, fix hint text, empty query feedback"
```

---

### Task 4: Final check

**Step 1: Run full test suite**
```bash
git restore config/ && bun test 2>&1 | tail -5
```
Expected: existing tests pass, 0 regressions (these are UI-only changes with no server impact)

**Step 2: Verify all changes in served HTML**
```bash
curl -s http://tv:3000/admin | python3 -c "
import sys; h = sys.stdin.read()
checks = [
    ('stacked-bar-chart in prop-type', 'stacked-bar-chart'),
    ('qe-gcp-row id', 'qe-gcp-row'),
    ('qe-metric-label id', 'qe-metric-label'),
    ('stacked-bar-chart in qe-preview-type', 'stacked-bar-chart'),
    ('resize handles hint', 'resize handles'),
]
for label, token in checks:
    print(label + ':', token in h)
"
```
Expected: all True

**Step 3: Git log**
```bash
git log --oneline -5
```
Expected:
- `fix: add stacked-bar-chart to preview selector, table min-height, fix hint text, empty query feedback`
- `fix: hide GCP-only fields in query editor for BigQuery/computed sources...`
- `fix: add line-chart, table, multi-metric-card, stacked-bar-chart to widget type selector...`
