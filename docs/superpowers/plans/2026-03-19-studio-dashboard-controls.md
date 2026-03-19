# Studio Dashboard Controls Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six dashboard management features to the Studio: rotation toggle, custom colors, logo upload, icon picker, query browser, and map region/zoom — all within the existing three-panel studio shell.

**Architecture:** All six features extend the existing `modifiedConfig` / `markDirty()` / Save flow — no immediate API writes except the asset upload. The `excluded` field filters dashboards in both the TV runtime (`app.js`) and the studio sidebar. A new `showQueryPicker()` panel state replaces the `<select>` query dropdown. Logo upload POSTs to a new `/api/assets/upload` endpoint saving to `public/img/`. Map zoom is applied via `map.setZoom()` after the `load` event using `mglConfig.initialZoom`.

**Tech Stack:** Bun, Elysia.js, TypeBox, vanilla JS (no frameworks), YAML config, Mapbox GL JS

---

## File Map

| File | What changes |
|---|---|
| `server/models/dashboard.model.js` | Add `excluded: t.Optional(t.Boolean())` to DashboardShape |
| `server/index.js` | Add `POST /api/assets/upload` endpoint |
| `public/js/app.js` | Filter excluded dashboards; `_applyClientBranding` reads `logoImage` |
| `public/js/studio.js` | Sidebar toggle; icon picker; branding section; showQueryPicker(); map region/zoom; save logo propagation; remove loadQueryOptions |
| `public/studio.html` | Dashboard props: rotation toggle, icon picker, branding section; Widget props: text+browse queryId, region/zoom controls; query picker panel |
| `public/css/studio.css` | Toggle pill, color pickers, logo drop-zone, query picker list, region button group |
| `public/js/mapbox-map.js` | `initialZoom` default in buildMapConfig; apply after map load |

---

## Chunk 1: Backend — model + asset upload

### Task 1: Add `excluded` to dashboard TypeBox model

**Files:**
- Modify: `server/models/dashboard.model.js`

- [ ] **Step 1: Add `excluded` field to DashboardShape**

In `server/models/dashboard.model.js`, find `DashboardShape` and add `excluded` after `clientBranding`:

```js
const DashboardShape = t.Object({
  id: t.String(), name: t.String(),
  subtitle: t.Optional(t.String()), icon: t.Optional(t.String()),
  grid: GridSchema, widgets: t.Array(WidgetConfig),
  clientBranding: t.Optional(t.Any()),
  excluded:       t.Optional(t.Boolean()),
});
```

`dashboard.update` is already `t.Partial(DashboardShape)` so this automatically allows `excluded` in PUT bodies.

- [ ] **Step 2: Verify server starts**

```bash
bun --eval "import('./server/index.js').then(() => console.log('OK')).catch(e => console.error(e.message))" 2>&1 | tail -3
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add server/models/dashboard.model.js
git commit -m "feat: add excluded field to dashboard model"
```

---

### Task 2: Asset upload endpoint

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add upload endpoint after the dashboard routes**

Find the section after `.post('/api/dashboards', ...)` route and add:

```js
.post('/api/assets/upload', async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const ALLOWED = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];
    const MAX_BYTES = 2 * 1024 * 1024;

    if (!ALLOWED.includes(file.type)) {
      return new Response(JSON.stringify({ success: false, error: 'File type not allowed. Use SVG, PNG, JPG, or WebP.' }),
        { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return new Response(JSON.stringify({ success: false, error: 'File exceeds 2MB limit' }),
        { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const ext      = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    const base     = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const prefix   = Math.random().toString(36).slice(2, 8);
    const filename = `${prefix}-${base}${ext}`;

    await Bun.write(`./public/img/${filename}`, bytes);
    return { success: true, url: `/img/${filename}` };
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'content-type': 'application/json' } });
  }
}, {
  detail: { tags: ['assets'], summary: 'Upload a logo or image asset to public/img/' },
})
```

- [ ] **Step 2: Restart and test upload**

```bash
sudo systemctl restart tv-dashboards && sleep 2
echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>' > /tmp/dot.svg
curl -s -X POST http://tv:3000/api/assets/upload -F "file=@/tmp/dot.svg;type=image/svg+xml"
```

Expected: `{"success":true,"url":"/img/xxxxxx-dot.svg"}`

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: add POST /api/assets/upload endpoint for logo images"
```

---

## Chunk 2: TV runtime — filter excluded dashboards

### Task 3: Skip excluded dashboards in `public/js/app.js`

**Files:**
- Modify: `public/js/app.js`
- Modify: `public/index.html`

- [ ] **Step 1: Filter excluded in `renderPages()` (line ~83)**

Find `this.config.dashboards.forEach((dash) => {` inside `renderPages()` and replace with:
```js
this.config.dashboards.filter(d => !d.excluded).forEach((dash) => {
```

- [ ] **Step 2: Filter excluded in `renderNavDots()`**

Find `this.config.dashboards.forEach((dash, i) => {` inside `renderNavDots()` and replace with:
```js
this.config.dashboards.filter(d => !d.excluded).forEach((dash, i) => {
```

- [ ] **Step 3: Update `_applyClientBranding` to handle `logoImage`**

Find `_applyClientBranding(brand)`. In the `if (brand)` block, after the `logoSub` line, add:

```js
// Logo image in top-bar
const logoWrap = document.querySelector('.top-left');
if (logoWrap) {
  let logoImg = logoWrap.querySelector('.brand-logo-img');
  if (brand.logoImage) {
    if (!logoImg) {
      logoImg = document.createElement('img');
      logoImg.className = 'brand-logo-img';
      logoImg.alt = '';
      logoImg.style.cssText = 'height:28px;width:auto;opacity:0.9;margin-right:8px;';
      logoImg.onerror = () => logoImg.remove();
      logoWrap.prepend(logoImg);
    }
    logoImg.src = brand.logoImage;
  } else if (logoImg) {
    logoImg.remove();
  }
}
```

In the `else` (clear branding) block, add after the CSS var removals:
```js
const logoWrap = document.querySelector('.top-left');
if (logoWrap) logoWrap.querySelector('.brand-logo-img')?.remove();
```

- [ ] **Step 4: Increment app.js version in `public/index.html`**

Change `app.js?v=15` → `app.js?v=16`.

- [ ] **Step 5: Commit**

```bash
git add public/js/app.js public/index.html
git commit -m "feat: filter excluded dashboards from TV rotation; clientBranding logoImage support"
```

---

## Chunk 3: Studio sidebar — rotation toggle

### Task 4: Add toggle pill per dashboard in `renderSidebar()`

**Files:**
- Modify: `public/js/studio.js`
- Modify: `public/css/studio.css`

- [ ] **Step 1: Update `item.className` in `renderSidebar()` to add `excluded` class**

Find the line:
```js
item.className = 'dashboard-nav-item' + (i === this.activeDashIdx ? ' active' : '');
```
Replace with:
```js
item.className = 'dashboard-nav-item'
  + (i === this.activeDashIdx ? ' active' : '')
  + (dash.excluded ? ' excluded' : '');
```

- [ ] **Step 2: Add toggle button to each sidebar item**

In `renderSidebar()`, after building `delBtn` and before `item.appendChild(handle)`, add:

```js
const toggle = document.createElement('button');
toggle.className = 'rot-toggle' + (dash.excluded ? ' rot-off' : '');
toggle.title = dash.excluded ? 'Excluded from rotation' : 'In rotation';
toggle.addEventListener('click', (e) => {
  e.stopPropagation();
  dash.excluded = !dash.excluded;
  this.markDirty();
  this.renderSidebar();
});
```

Then in the `item.appendChild` sequence, add `item.appendChild(toggle)` after `item.appendChild(count)`.

- [ ] **Step 3: Add status counter below the list**

At the end of `renderSidebar()`, after the loop, add:

```js
let counter = document.getElementById('dash-rotation-count');
if (!counter) {
  counter = document.createElement('div');
  counter.id = 'dash-rotation-count';
  counter.className = 'dash-rotation-count';
  list.parentElement.appendChild(counter);
}
const total    = dashes.length;
const excluded = dashes.filter(d => d.excluded).length;
counter.textContent = excluded > 0
  ? `${total} dashboards \u00b7 ${excluded} excluded`
  : `${total} dashboards`;
```

- [ ] **Step 4: Add CSS**

Append to `public/css/studio.css`:

```css
/* Rotation toggle pill */
.rot-toggle {
  width: 28px; height: 16px; border-radius: 8px;
  background: #16a34a; border: none; cursor: pointer;
  position: relative; flex-shrink: 0; transition: background 0.2s;
  margin-left: auto;
}
.rot-toggle::after {
  content: ''; position: absolute;
  width: 10px; height: 10px; background: #fff; border-radius: 50%;
  top: 3px; right: 3px; transition: right 0.2s, left 0.2s;
}
.rot-toggle.rot-off { background: #3d1860; }
.rot-toggle.rot-off::after { right: auto; left: 3px; }
.dashboard-nav-item.excluded { opacity: 0.45; }
.dashboard-nav-item.excluded .nav-name { text-decoration: line-through; }
.dash-rotation-count { font-size: 10px; color: #4A2880; letter-spacing: 0.5px; padding: 6px 8px 2px; }
```

- [ ] **Step 5: Commit**

```bash
git add public/js/studio.js public/css/studio.css
git commit -m "feat: rotation toggle pill in studio sidebar"
```

---

## Chunk 4: Dashboard Properties — icon picker, rotation toggle, branding

### Task 5: Replace `#dashboard-props` HTML and bind new fields

**Files:**
- Modify: `public/studio.html`
- Modify: `public/js/studio.js`
- Modify: `public/css/studio.css`

- [ ] **Step 1: Replace `#dashboard-props` block in `public/studio.html`**

Find `<div id="dashboard-props" style="display:none">` and replace the entire block (up to `<!-- Widget props -->`):

```html
<!-- Dashboard props -->
<div id="dashboard-props" style="display:none">
  <h3 class="props-heading">Dashboard</h3>

  <details class="props-section" open>
    <summary>Basic</summary>
    <div class="props-body">
      <label>Name <input id="prop-dash-name" type="text"></label>
      <label>Subtitle <input id="prop-dash-subtitle" type="text"></label>
      <div class="props-grid-2">
        <label>Columns <input id="prop-dash-cols" type="number" min="1" max="12"></label>
        <label>Rows    <input id="prop-dash-rows" type="number" min="1" max="12"></label>
      </div>
      <label>Gap (px) <input id="prop-dash-gap" type="number" min="0" max="40"></label>
    </div>
  </details>

  <details class="props-section" open>
    <summary>Icon</summary>
    <div class="props-body">
      <div class="dash-icon-grid" id="dash-icon-grid">
        <button class="dash-icon-opt" data-icon="bolt"   title="Bolt">&#9889;</button>
        <button class="dash-icon-opt" data-icon="grid"   title="Grid">&#9783;</button>
        <button class="dash-icon-opt" data-icon="server" title="Server">&#8982;</button>
        <button class="dash-icon-opt" data-icon="flow"   title="Flow">&#8644;</button>
        <button class="dash-icon-opt" data-icon="data"   title="Data">&#9016;</button>
        <button class="dash-icon-opt" data-icon="shield" title="Shield">&#9768;</button>
        <button class="dash-icon-opt" data-icon="map"    title="Map">&#9675;</button>
      </div>
    </div>
  </details>

  <details class="props-section" open>
    <summary>Rotation</summary>
    <div class="props-body">
      <div class="rotation-toggle-row">
        <div>
          <div class="rotation-toggle-label">Include in slideshow</div>
          <div class="rotation-toggle-hint">When off, dashboard stays in the list but skips TV rotation</div>
        </div>
        <button id="prop-dash-rotation" class="rot-toggle" aria-label="Toggle rotation"></button>
      </div>
    </div>
  </details>

  <details class="props-section">
    <summary>Branding</summary>
    <div class="props-body">

      <div class="prop-label">Logo</div>
      <div class="logo-drop-zone" id="logo-drop-zone">
        <img id="logo-preview-img" class="logo-preview-img" style="display:none" src="" alt="Logo preview">
        <div id="logo-drop-placeholder">
          <div style="font-size:22px">&#128444;</div>
          <div class="logo-drop-hint-text">Drop image or <label class="logo-browse-link" for="logo-file-input">browse</label></div>
          <div class="logo-drop-hint">SVG, PNG, JPG, WebP &middot; max 2 MB</div>
        </div>
        <input type="file" id="logo-file-input" accept=".svg,.png,.jpg,.jpeg,.webp" style="display:none">
      </div>
      <label>Logo URL <input id="prop-logo-url" type="text" placeholder="/img/client-logo.svg"></label>

      <div class="props-grid-2">
        <label>Logo Text <input id="prop-logo-text" type="text" placeholder="MADHIVE"></label>
        <label>Logo Sub  <input id="prop-logo-sub"  type="text" placeholder="PLATFORM"></label>
      </div>

      <div class="prop-label" style="margin-top:6px">Brand Colors</div>
      <div class="color-picker-list">
        <div class="color-picker-row">
          <input type="color" id="prop-color-bg"     value="#0E0320">
          <label for="prop-color-bg">Background</label>
        </div>
        <div class="color-picker-row">
          <input type="color" id="prop-color-accent" value="#FDA4D4">
          <label for="prop-color-accent">Accent</label>
        </div>
        <div class="color-picker-row">
          <input type="color" id="prop-color-bgcard" value="#1A0B38">
          <label for="prop-color-bgcard">Card BG</label>
        </div>
        <div class="color-picker-row">
          <input type="color" id="prop-color-border" value="#2E1860">
          <label for="prop-color-border">Border</label>
        </div>
        <div class="color-picker-row">
          <input type="color" id="prop-color-dot"    value="#2E1860">
          <label for="prop-color-dot">Dot Grid</label>
        </div>
      </div>

    </div>
  </details>
</div>
```

- [ ] **Step 2: Add branding + icon CSS to `public/css/studio.css`**

```css
/* Dashboard icon picker */
.dash-icon-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; }
.dash-icon-opt {
  padding: 6px 4px; background: #1a0b38; border: 1px solid #2E1860;
  border-radius: 4px; font-size: 16px; cursor: pointer; color: #d0c4e4;
  transition: border-color 0.15s, background 0.15s;
}
.dash-icon-opt:hover    { border-color: #4A2880; background: #2a1060; }
.dash-icon-opt.selected { border-color: #FDA4D4; background: rgba(253,164,212,0.12); }

/* Rotation row in props */
.rotation-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rotation-toggle-label { font-size: 12px; color: #d0c4e4; }
.rotation-toggle-hint  { font-size: 10px; color: #6B55A0; margin-top: 2px; }

/* Logo drop zone */
.logo-drop-zone {
  border: 1px dashed #4A2880; border-radius: 6px; padding: 12px;
  text-align: center; background: rgba(124,58,237,0.04); cursor: pointer;
  margin-bottom: 6px; transition: border-color 0.2s;
  min-height: 60px; display: flex; align-items: center; justify-content: center;
}
.logo-drop-zone:hover, .logo-drop-zone.drag-over { border-color: #7c3aed; }
.logo-drop-hint-text { font-size: 11px; color: #8B75B0; }
.logo-drop-hint      { font-size: 10px; color: #4A2880; margin-top: 2px; }
.logo-browse-link    { color: #FDA4D4; cursor: pointer; text-decoration: underline; }
.logo-preview-img    { max-height: 40px; max-width: 100%; object-fit: contain; }

/* Color pickers */
.color-picker-list { display: flex; flex-direction: column; gap: 5px; }
.color-picker-row  { display: flex; align-items: center; gap: 8px; }
.color-picker-row input[type="color"] {
  width: 28px; height: 28px; border: 1px solid #2E1860; border-radius: 4px;
  background: none; cursor: pointer; padding: 1px; flex-shrink: 0;
}
.color-picker-row label { font-size: 11px; color: #c0b0d8; cursor: pointer; }

/* Props body + label */
.props-body { padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
.prop-label { font-size: 10px; color: #8B75B0; letter-spacing: 0.5px; text-transform: uppercase; }
```

- [ ] **Step 3: Update `showDashboardProps()` in `studio.js` to populate new fields**

In `showDashboardProps()`, after the existing bindings for `nameEl`, `subtitleEl`, `colsEl`, `rowsEl`, `gapEl`, add:

```js
// Icon picker
const iconGrid = document.getElementById('dash-icon-grid');
if (iconGrid) {
  iconGrid.querySelectorAll('.dash-icon-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.icon === (dash.icon || 'bolt'));
    btn.onclick = () => {
      iconGrid.querySelectorAll('.dash-icon-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      this.applyDashboardProps();
    };
  });
}

// Rotation toggle (props panel mirror)
const rotBtn = document.getElementById('prop-dash-rotation');
if (rotBtn) {
  rotBtn.className = 'rot-toggle' + (dash.excluded ? ' rot-off' : '');
  rotBtn.onclick = () => {
    dash.excluded = !dash.excluded;
    rotBtn.className = 'rot-toggle' + (dash.excluded ? ' rot-off' : '');
    this.markDirty();
    this.renderSidebar();
  };
}

// Branding
const brand  = dash.clientBranding || {};
const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
setVal('prop-logo-url',    brand.logoImage || '');
setVal('prop-logo-text',   brand.logoText  || '');
setVal('prop-logo-sub',    brand.logoSub   || '');
setVal('prop-color-bg',    brand.bg        || '#0E0320');
setVal('prop-color-accent',brand.accent    || '#FDA4D4');
setVal('prop-color-bgcard',brand.bgCard    || '#1A0B38');
setVal('prop-color-border',brand.border    || '#2E1860');
setVal('prop-color-dot',   brand.dotColor  || '#2E1860');

// Logo preview
const previewImg  = document.getElementById('logo-preview-img');
const logoPh      = document.getElementById('logo-drop-placeholder');
if (previewImg && logoPh) {
  if (brand.logoImage) {
    previewImg.src = brand.logoImage;
    previewImg.style.display = '';
    logoPh.style.display = 'none';
  } else {
    previewImg.style.display = 'none';
    logoPh.style.display = '';
  }
}

// Bind logo file upload (once)
const fileInput = document.getElementById('logo-file-input');
const dropZone  = document.getElementById('logo-drop-zone');
if (fileInput && !fileInput._bound) {
  fileInput._bound = true;
  fileInput.onchange = () => this._handleLogoUpload(fileInput.files[0]);
  if (dropZone) {
    dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) this._handleLogoUpload(f);
    });
  }
}

// Bind branding inputs
['prop-logo-url','prop-logo-text','prop-logo-sub',
 'prop-color-bg','prop-color-accent','prop-color-bgcard','prop-color-border','prop-color-dot'
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.oninput = () => this.applyDashboardProps();
});
```

- [ ] **Step 4: Update `applyDashboardProps()` to write icon + branding**

After the existing `dash.grid.gap` line, add:

```js
// Icon
const iconGrid = document.getElementById('dash-icon-grid');
const selIcon  = iconGrid && iconGrid.querySelector('.dash-icon-opt.selected');
if (selIcon) dash.icon = selIcon.dataset.icon;

// Branding
if (!dash.clientBranding) dash.clientBranding = {};
const gb = (id) => { const el = document.getElementById(id); return el ? el.value || undefined : undefined; };
dash.clientBranding.logoImage = gb('prop-logo-url');
dash.clientBranding.logoText  = gb('prop-logo-text');
dash.clientBranding.logoSub   = gb('prop-logo-sub');
dash.clientBranding.bg        = gb('prop-color-bg');
dash.clientBranding.accent    = gb('prop-color-accent');
dash.clientBranding.bgCard    = gb('prop-color-bgcard');
dash.clientBranding.border    = gb('prop-color-border');
dash.clientBranding.dotColor  = gb('prop-color-dot');
```

- [ ] **Step 5: Add `_handleLogoUpload()` method to StudioApp**

```js
async _handleLogoUpload(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res  = await fetch('/api/assets/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success && data.url) {
      const urlEl = document.getElementById('prop-logo-url');
      if (urlEl) { urlEl.value = data.url; urlEl.dispatchEvent(new Event('input')); }
      const previewImg = document.getElementById('logo-preview-img');
      const logoPh    = document.getElementById('logo-drop-placeholder');
      if (previewImg) { previewImg.src = data.url; previewImg.style.display = ''; }
      if (logoPh) logoPh.style.display = 'none';
    } else {
      alert('Upload failed: ' + (data.error || 'unknown error'));
    }
  } catch (err) {
    alert('Upload error: ' + err.message);
  }
}
```

- [ ] **Step 6: Add logo propagation to map widgets on save**

Find the save flow in `studio.js` (the function that calls `fetch('/api/dashboards/:id', { method: 'PUT', ... })`). Before the fetch, add:

```js
// Copy clientBranding.logoImage into each usa-map-gl widget's mglConfig.clientLogo
this.modifiedConfig.dashboards.forEach(dash => {
  const logoUrl = dash.clientBranding && dash.clientBranding.logoImage;
  if (!logoUrl) return;
  (dash.widgets || []).forEach(wc => {
    if (wc.type === 'usa-map-gl') {
      wc.mglConfig = Object.assign({}, wc.mglConfig || {}, { clientLogo: logoUrl });
    }
  });
});
```

- [ ] **Step 7: Commit**

```bash
git add public/studio.html public/js/studio.js public/css/studio.css
git commit -m "feat: icon picker, rotation toggle, branding section in dashboard props"
```

---

## Chunk 5: Query picker — replace select with text + browse panel

### Task 6: Replace `<select id="prop-query">` with text + browse

**Files:**
- Modify: `public/studio.html`
- Modify: `public/js/studio.js`
- Modify: `public/css/studio.css`

- [ ] **Step 1: Replace query controls in the Data `<details>` in `public/studio.html`**

Find the Data section and replace the `<select id="prop-query">` and `<button id="new-query-btn">`:

```html
<details class="props-section" open>
  <summary>Data</summary>
  <div>
    <div id="data-summary" class="data-summary">
      <span class="data-summary-source" id="data-summary-source"></span>
      <span class="data-summary-sep">&#8250;</span>
      <span class="data-summary-query" id="data-summary-query"></span>
    </div>
    <label>
      Source
      <select id="prop-source">
        <option value="gcp">GCP Cloud Monitoring</option>
        <option value="bigquery">BigQuery</option>
        <option value="computed">Computed</option>
        <option value="vulntrack">VulnTrack</option>
        <option value="mock">Mock</option>
      </select>
    </label>
    <button id="browse-metrics-btn" class="studio-btn secondary small" style="display:none">&#128270; Browse GCP Metrics</button>
    <label>
      Query ID
      <div class="query-id-row">
        <input id="prop-query" type="text" placeholder="query-id" class="query-id-input">
        <button type="button" id="browse-queries-btn" class="studio-btn secondary small">Browse</button>
      </div>
    </label>
    <div id="query-id-hint" class="query-id-hint" style="display:none"></div>
    <button id="new-query-btn" class="studio-btn secondary small">+ New Query</button>
  </div>
</details>
```

Add the query picker panel as a sibling of `#query-editor-panel` (outside `#properties-content`):

```html
<!-- Query picker panel -->
<div id="query-picker-panel" class="query-picker-panel" style="display:none">
  <div class="qp-header">
    <span class="qp-title">Browse Queries</span>
    <button id="qp-close" class="modal-close">&#215;</button>
  </div>
  <div class="qp-search-wrap">
    <input id="qp-search" type="text" class="qp-search" placeholder="Search by name or ID...">
  </div>
  <div id="qp-list" class="qp-list"></div>
</div>
```

- [ ] **Step 2: Remove `loadQueryOptions()` from `studio.js`**

Delete the entire `loadQueryOptions(source, selectedId)` method (~35 lines).

- [ ] **Step 3: Update all call sites that called `loadQueryOptions`**

In `showWidgetProps()`, replace `this.loadQueryOptions(wc.source || 'gcp', wc.queryId || '');` with:

```js
const queryEl = document.getElementById('prop-query');
if (queryEl) queryEl.value = wc.queryId || '';
this.updateDataSummary(wc.source || 'gcp', wc.queryId || '');
```

In the source `<select>` onchange handler, replace any `self.loadQueryOptions(...)` call with:
```js
self.updateDataSummary(wc.source, wc.queryId || '');
```

- [ ] **Step 4: Bind the query text input and browse button in `showWidgetProps()`**

Find where the old query select binding was and replace with:

```js
const queryEl   = document.getElementById('prop-query');
const browseBtn = document.getElementById('browse-queries-btn');

if (queryEl) {
  queryEl.oninput = () => {
    wc.queryId = queryEl.value.trim();
    this.updateDataSummary(wc.source || 'gcp', wc.queryId);
    this.markDirty();
  };
}

if (browseBtn) {
  browseBtn.onclick = () => this.showQueryPicker(wc);
}
```

- [ ] **Step 5: Add `showQueryPicker()` and `_closeQueryPicker()` to StudioApp**

```js
async showQueryPicker(wc) {
  const panel   = document.getElementById('query-picker-panel');
  const content = document.getElementById('properties-content');
  if (!panel || !content) return;

  content.style.display = 'none';
  panel.style.display   = 'flex';
  panel.style.flexDirection = 'column';

  const closeBtn = document.getElementById('qp-close');
  if (closeBtn) closeBtn.onclick = () => this._closeQueryPicker();

  let allQueries = [];
  try {
    const res     = await fetch('/api/queries/');
    const data    = await res.json();
    const grouped = data.queries || {};
    ['gcp', 'bigquery', 'computed', 'vulntrack'].forEach(src => {
      (grouped[src] || []).forEach(q => allQueries.push(Object.assign({}, q, { _source: src })));
    });
  } catch (_) { /* empty list is fine */ }

  const renderList = (filter) => {
    const list = document.getElementById('qp-list');
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);

    const lower   = (filter || '').toLowerCase();
    const matches = allQueries.filter(q =>
      !lower
      || q.id.toLowerCase().includes(lower)
      || (q.name || '').toLowerCase().includes(lower)
      || (q.description || '').toLowerCase().includes(lower)
    );

    const sources = {};
    matches.forEach(q => {
      if (!sources[q._source]) sources[q._source] = [];
      sources[q._source].push(q);
    });

    Object.keys(sources).forEach(src => {
      const hdr = document.createElement('div');
      hdr.className   = 'qp-group-header';
      hdr.textContent = src.toUpperCase();
      list.appendChild(hdr);

      sources[src].forEach(q => {
        const row = document.createElement('div');
        row.className = 'qp-row' + (q.id === wc.queryId ? ' qp-row-selected' : '');

        const idEl = document.createElement('div');
        idEl.className   = 'qp-row-id';
        idEl.textContent = q.id;

        const nameEl = document.createElement('div');
        nameEl.className   = 'qp-row-name';
        nameEl.textContent = q.name || '';

        row.appendChild(idEl);
        row.appendChild(nameEl);

        row.addEventListener('click', () => {
          wc.queryId = q.id;
          wc.source  = q._source;
          this.markDirty();
          this._closeQueryPicker();
          this.showWidgetProps(wc.id);
        });
        list.appendChild(row);
      });
    });

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className   = 'qp-empty';
      empty.textContent = 'No queries match';
      list.appendChild(empty);
    }
  };

  renderList('');

  const searchEl = document.getElementById('qp-search');
  if (searchEl) {
    searchEl.value   = '';
    searchEl.oninput = () => renderList(searchEl.value);
    setTimeout(() => searchEl.focus(), 50);
  }
}

_closeQueryPicker() {
  const panel   = document.getElementById('query-picker-panel');
  const content = document.getElementById('properties-content');
  if (panel)   panel.style.display   = 'none';
  if (content) content.style.display = 'flex';
}
```

- [ ] **Step 6: Add query picker CSS to `public/css/studio.css`**

```css
/* Query ID row */
.query-id-row { display: flex; gap: 4px; }
.query-id-input { flex: 1; font-family: var(--font-mono, monospace); font-size: 11px; }
.query-id-hint  { font-size: 10px; color: #4ADE80; }

/* Query picker panel */
.query-picker-panel {
  position: absolute; inset: 0; background: #110430;
  z-index: 10; display: none; flex-direction: column;
}
.qp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; border-bottom: 1px solid #1e0848; flex-shrink: 0;
}
.qp-title { font-size: 12px; font-weight: 600; letter-spacing: 1px; color: #FDA4D4; text-transform: uppercase; }
.qp-search-wrap { padding: 8px 14px; flex-shrink: 0; }
.qp-search {
  width: 100%; background: #1a0b38; border: 1px solid #2E1860;
  color: #d0c4e4; padding: 6px 10px; border-radius: 4px; font-size: 12px;
}
.qp-list { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
.qp-group-header { font-size: 9px; letter-spacing: 2px; color: #4A2880; text-transform: uppercase; padding: 8px 6px 3px; }
.qp-row {
  padding: 7px 8px; border-radius: 4px; cursor: pointer;
  border: 1px solid transparent; margin-bottom: 2px;
}
.qp-row:hover       { background: rgba(124,58,237,0.12); border-color: #2E1860; }
.qp-row-selected    { background: rgba(253,164,212,0.08); border-color: #4A2880; }
.qp-row-id   { font-family: monospace; font-size: 11px; color: #d0c4e4; }
.qp-row-name { font-size: 10px; color: #8B75B0; margin-top: 1px; }
.qp-empty    { font-size: 11px; color: #4A2880; text-align: center; padding: 20px; }
```

- [ ] **Step 7: Verify**

```bash
sudo systemctl restart tv-dashboards && sleep 2
# Open http://tv.madhive.local/admin
# Click a widget → Data section → Browse button
# Picker panel slides in, search filters work, clicking assigns queryId
```

- [ ] **Step 8: Commit**

```bash
git add public/studio.html public/js/studio.js public/css/studio.css
git commit -m "feat: query picker panel replaces select dropdown in widget properties"
```

---

## Chunk 6: Map region, zoom, and Mapbox initialZoom

### Task 7: Region picker + zoom slider in Map GL Config

**Files:**
- Modify: `public/studio.html`
- Modify: `public/js/studio.js`
- Modify: `public/js/mapbox-map.js`
- Modify: `public/css/studio.css`
- Modify: `public/index.html` (version bump)

- [ ] **Step 1: Add region + zoom to `#mgl-config-section` in `public/studio.html`**

Find `<details class="props-section" id="mgl-config-section">`. Inside its `<div>`, after the `Zip Visualization` label block, add:

```html
<label>Region
  <div class="region-btn-group" id="prop-region-group">
    <button type="button" class="region-btn" data-region="">All US</button>
    <button type="button" class="region-btn" data-region="northeast">NE</button>
    <button type="button" class="region-btn" data-region="southeast">SE</button>
    <button type="button" class="region-btn" data-region="northwest">NW</button>
    <button type="button" class="region-btn" data-region="southwest">SW</button>
  </div>
</label>
<label>Initial Zoom
  <div class="zoom-slider-row">
    <input type="range" id="prop-mgl-zoom" min="2" max="10" step="0.5" value="4">
    <span id="prop-mgl-zoom-val">4</span>
  </div>
</label>
```

- [ ] **Step 2: Populate and bind region + zoom in `showWidgetProps()` in `studio.js`**

In the block where mglConfig values are read (find `set('prop-mgl-scheme', ...)`), add after existing `set()` calls:

```js
// Region
const regionGroup = document.getElementById('prop-region-group');
if (regionGroup) {
  const currentRegion = (wc.mapConfig && wc.mapConfig.region) || '';
  regionGroup.querySelectorAll('.region-btn').forEach(btn =>
    btn.classList.toggle('selected', btn.dataset.region === currentRegion));
}
// Zoom
const zoomSlider = document.getElementById('prop-mgl-zoom');
const zoomVal    = document.getElementById('prop-mgl-zoom-val');
if (zoomSlider) {
  const z = (wc.mglConfig && wc.mglConfig.initialZoom) || 4;
  zoomSlider.value = z;
  if (zoomVal) zoomVal.textContent = z;
}
```

In the bindings block (find `bind('prop-mgl-scheme', ...)`), add:

```js
// Region buttons
const regionGroup = document.getElementById('prop-region-group');
if (regionGroup) {
  regionGroup.querySelectorAll('.region-btn').forEach(btn => {
    btn.onclick = () => {
      regionGroup.querySelectorAll('.region-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (!wc.mapConfig) wc.mapConfig = {};
      const r = btn.dataset.region;
      wc.mapConfig.region = r || undefined;
      self.markDirty();
    };
  });
}

// Zoom slider
const zoomSlider = document.getElementById('prop-mgl-zoom');
const zoomVal    = document.getElementById('prop-mgl-zoom-val');
if (zoomSlider) {
  zoomSlider.oninput = () => {
    if (zoomVal) zoomVal.textContent = zoomSlider.value;
    wc.mglConfig = Object.assign({}, wc.mglConfig || {}, { initialZoom: parseFloat(zoomSlider.value) });
    self.markDirty();
  };
}
```

- [ ] **Step 3: Add `initialZoom: null` to `buildMapConfig()` in `mapbox-map.js`**

Find `buildMapConfig`:

```js
function buildMapConfig(userConfig) {
  return {
    particleCount:   100,
    particleSpeed:   1.0,
    colorScheme:     'brand',
    showLeaderboard: true,
    mapStyle:        'mapbox',
    zoomViz:         'dots',
    clientLogo:      null,
    initialZoom:     null,
    ...(userConfig || {}),
  };
}
```

- [ ] **Step 4: Apply `initialZoom` in `_initMap()` in `mapbox-map.js`**

In the `map.on('load', async () => { ... })` callback, after `if (this._data) this._applyData(this._data);`, add:

```js
if (this._cfg.initialZoom) {
  this._map.setZoom(this._cfg.initialZoom);
}
```

- [ ] **Step 5: Add region + zoom CSS**

```css
/* Region button group */
.region-btn-group { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }
.region-btn {
  padding: 4px 8px; background: #1a0b38; border: 1px solid #2E1860;
  border-radius: 4px; font-size: 11px; color: #a090c0; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.region-btn:hover    { border-color: #4A2880; background: #2a1060; }
.region-btn.selected { border-color: #7c3aed; background: rgba(124,58,237,0.18); color: #d4b8ff; }

/* Zoom slider */
.zoom-slider-row { display: flex; align-items: center; gap: 8px; margin-top: 3px; }
.zoom-slider-row input[type="range"] { flex: 1; accent-color: #7c3aed; }
.zoom-slider-row span { font-size: 12px; color: #d0c4e4; width: 20px; text-align: right; }
```

- [ ] **Step 6: Bump versions in `public/studio.html` and `public/index.html`**

- `studio.html`: `studio.css?v=11` → `v=12`, `mapbox-map.js?v=18` → `v=19`
- `index.html`:  `mapbox-map.js?v=18` → `v=19`

- [ ] **Step 7: Restart and verify**

```bash
sudo systemctl restart tv-dashboards && sleep 2
# Open http://tv.madhive.local/admin
# Click a usa-map-gl widget → Map GL Config → region buttons + zoom slider visible
# Click "NE" → markDirty fires (Save button enables)
# Save → check dashboards.yaml widget has mapConfig.region: northeast
```

- [ ] **Step 8: Commit**

```bash
git add public/studio.html public/js/studio.js public/js/mapbox-map.js public/css/studio.css public/index.html
git commit -m "feat: map region picker and initial zoom slider in studio widget properties"
```

---

## Chunk 7: Ship

### Task 8: PR, merge, restart

- [ ] **Step 1: Create PR**

```bash
git checkout -b feat/studio-dashboard-controls
git push -u origin feat/studio-dashboard-controls
gh pr create \
  --title "feat: studio dashboard controls (rotation, branding, query picker, map zoom)" \
  --body "Six new Studio features — all follow existing modifiedConfig/markDirty/Save flow:

- **Rotation toggle**: sidebar pill + props panel toggle to include/exclude from TV slideshow
- **Icon picker**: 7-icon grid in dashboard props (same icons as ICONS constant in app.js)
- **Branding**: 5 color pickers + logo upload/URL + logoText/logoSub; logo propagated to usa-map-gl widgets on save
- **Query picker**: replaces query select with text input + searchable Browse panel grouped by source
- **Map region**: button group (All US / NE / SE / NW / SW) sets mapConfig.region for server-side filtering
- **Map zoom**: initial zoom slider (2–10) sets mglConfig.initialZoom; applied via map.setZoom() after load

Also: filter excluded dashboards in TV runtime renderPages/renderNavDots; clientBranding.logoImage shown in top-bar via brand-logo-img element." \
  --base main
```

- [ ] **Step 2: Merge**

```bash
gh pr merge --squash --delete-branch
git checkout main && git reset --hard origin/main
```

- [ ] **Step 3: Restart + refresh kiosk**

```bash
sudo systemctl restart tv-dashboards lightdm
sleep 5
DISPLAY=:0 xdotool key ctrl+shift+r
echo "Done"
```
