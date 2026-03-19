window.StudioCanvas = (function () {
  'use strict';

  let app = null;

  var _ghost = null;
  var _overlay = null;
  var _dragWc = null;

  function _showOverlay(page, dash, wc) {
    _hideOverlay(page);
    _dragWc = wc;

    var overlay = document.createElement('div');
    overlay.className = 'studio-grid-overlay';
    overlay.id = 'studio-drag-overlay';
    overlay.style.gridTemplateColumns = 'repeat(' + dash.grid.columns + ', 1fr)';
    overlay.style.gridTemplateRows    = 'repeat(' + dash.grid.rows    + ', 1fr)';

    for (var r = 1; r <= dash.grid.rows; r++) {
      for (var c = 1; c <= dash.grid.columns; c++) {
        var cell = document.createElement('div');
        cell.className   = 'studio-grid-cell';
        cell.dataset.col = c;
        cell.dataset.row = r;
        overlay.appendChild(cell);
      }
    }
    page.appendChild(overlay);
    _overlay = overlay;

    // Ghost sits in the grid at the widget's current position
    var ghost = document.createElement('div');
    ghost.className = 'studio-drag-ghost';
    ghost.style.gridColumn = wc.position.col + ' / span ' + (wc.position.colSpan || 1);
    ghost.style.gridRow    = wc.position.row + ' / span ' + (wc.position.rowSpan || 1);
    page.insertBefore(ghost, page.firstChild);
    _ghost = ghost;
  }

  function _hideOverlay(page) {
    if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
    if (_ghost  && _ghost.parentNode)   _ghost.parentNode.removeChild(_ghost);
    _overlay = null;
    _ghost   = null;
    _dragWc  = null;
  }

  function _highlightCells(col, row, colSpan, rowSpan, blocked) {
    if (!_overlay) return;
    _overlay.querySelectorAll('.studio-grid-cell').forEach(function (cell) {
      var c     = parseInt(cell.dataset.col);
      var r     = parseInt(cell.dataset.row);
      var inCol = c >= col && c < col + colSpan;
      var inRow = r >= row && r < row + rowSpan;
      cell.classList.toggle('drag-target', inCol && inRow && !blocked);
      cell.classList.toggle('drag-blocked', inCol && inRow &&  blocked);
    });
    if (_ghost) _ghost.classList.toggle('blocked', blocked);
  }

  function render(studioApp) {
    app = studioApp;
    const canvas = document.getElementById('studio-canvas');
    const dash = app.modifiedConfig.dashboards[app.activeDashIdx];

    // Clear canvas
    canvas.textContent = '';

    if (!dash) {
      const placeholder = document.createElement('div');
      placeholder.className = 'canvas-placeholder';
      placeholder.textContent = 'Select a dashboard to edit';
      canvas.appendChild(placeholder);
      return;
    }

    // Widget instance registry for this render — keyed by widget id
    var widgetInstances = {};

    // Create dashboard page div
    // 'active' class is required — dashboard.css hides .dashboard-page until active
    const page = document.createElement('div');
    page.className = 'dashboard-page active';
    page.style.gridTemplateColumns = 'repeat(' + dash.grid.columns + ', 1fr)';
    page.style.gridTemplateRows = 'repeat(' + dash.grid.rows + ', 1fr)';
    page.style.gap = (dash.grid.gap || 12) + 'px';
    page.style.height = '100%';
    page.style.padding = '12px';
    page.style.display = 'grid';

    // Render each widget
    dash.widgets.forEach(function (wc) {
      const card = document.createElement('div');
      card.className = 'widget widget-' + wc.type;
      card.dataset.widgetId = wc.id;
      card.style.gridColumn = wc.position.col + ' / span ' + (wc.position.colSpan || 1);
      card.style.gridRow = wc.position.row + ' / span ' + (wc.position.rowSpan || 1);
      card.style.cursor = 'pointer';
      card.style.position = 'relative';
      card.style.outline = '2px solid ' + (wc.id === app.selectedWidgetId ? '#FDA4D4' : 'transparent');
      card.style.borderRadius = '4px';
      card.style.transition = 'outline 0.1s';
      card.style.overflow = 'hidden';

      addResizeHandles(card, wc, dash);

      // Title
      const title = document.createElement('div');
      title.className = 'widget-title';
      title.textContent = wc.title;
      card.appendChild(title);

      // Content (widget renders into this)
      const content = document.createElement('div');
      content.className = 'widget-content';
      card.appendChild(content);

      // Render widget using widgets.js — store instance for later data update
      var widgetInstance = null;
      if (window.Widgets && window.Widgets.create) {
        try {
          widgetInstance = window.Widgets.create(wc.type, content, wc);
          // For GL map widgets: persist overlay positions to mglConfig when user drags
          if (wc.type === 'usa-map-gl') {
            // Allow resize handles to extend outside the clipped canvas
            canvas.classList.add('has-map-widget');
            content.addEventListener('mgl-overlay-moved', function (e) {
              if (!wc.mglConfig) wc.mglConfig = {};
              wc.mglConfig.overlayPositions = e.detail.positions;
              if (app && app.markDirty) app.markDirty();
            });
            content.addEventListener('mgl-viewport-changed', function (e) {
              if (!wc.mglConfig) wc.mglConfig = {};
              wc.mglConfig.initialCenter  = e.detail.center;
              wc.mglConfig.initialZoom    = e.detail.zoom;
              wc.mglConfig.initialPitch   = e.detail.pitch;
              wc.mglConfig.initialBearing = e.detail.bearing;
              if (app && app.markDirty) app.markDirty();
            });
          }
        } catch (e) {
          content.textContent = wc.type;
        }
      }
      widgetInstances[wc.id] = widgetInstance;

      // Click: select widget
      card.addEventListener('click', function (e) {
        e.stopPropagation();
        // Update all outlines
        page.querySelectorAll('.widget').forEach(function (el) {
          el.style.outline = '2px solid ' +
            (el.dataset.widgetId === wc.id ? '#FDA4D4' : 'transparent');
        });
        app.showWidgetProps(wc.id);
      });

      // Hover highlight
      card.addEventListener('mouseenter', function () {
        if (wc.id !== app.selectedWidgetId) {
          card.style.outline = '2px solid rgba(253,164,212,0.5)';
        }
      });
      card.addEventListener('mouseleave', function () {
        if (wc.id !== app.selectedWidgetId) {
          card.style.outline = '2px solid transparent';
        }
      });

      enableDrag(card, wc);
      page.appendChild(card);
    });

    enableDropZone(page, dash);

    // Click on empty canvas area (page background) -> deselect, show dashboard props
    page.addEventListener('click', function () {
      app.selectedWidgetId = null;
      page.querySelectorAll('.widget').forEach(function (el) {
        el.style.outline = '2px solid transparent';
      });
      app.showDashboardProps();
    });

    canvas.appendChild(page);

    // Fetch live data and update widgets so the canvas preview shows real values
    fetch('/api/metrics/' + dash.id)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        dash.widgets.forEach(function (wc) {
          var inst = widgetInstances[wc.id];
          if (inst && inst.update && data[wc.id]) {
            try { inst.update(data[wc.id]); } catch (_) {}
          }
        });
      })
      .catch(function () {}); // fail silently — canvas still shows widget shells
  }

  function enableDrag(card, wc) {
    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', function (e) {
      // Suppress the browser's default ghost image
      var blank = document.createElement('div');
      document.body.appendChild(blank);
      e.dataTransfer.setDragImage(blank, 0, 0);
      setTimeout(function () { document.body.removeChild(blank); }, 0);

      e.dataTransfer.setData('widgetId', wc.id);
      card.style.opacity = '0.25';

      var page = card.closest('.dashboard-page');
      var dash = app.modifiedConfig.dashboards[app.activeDashIdx];
      _showOverlay(page, dash, wc);
    });

    card.addEventListener('dragend', function () {
      card.style.opacity = '1';
      var page = card.closest('.dashboard-page');
      _hideOverlay(page);
    });
  }

  function _eventToCell(e, page, dash, colSpan, rowSpan) {
    var rect = page.getBoundingClientRect();
    var col  = Math.max(1, Math.min(dash.grid.columns,
                 Math.ceil((e.clientX - rect.left) / (rect.width  / dash.grid.columns))));
    var row  = Math.max(1, Math.min(dash.grid.rows,
                 Math.ceil((e.clientY - rect.top)  / (rect.height / dash.grid.rows))));
    col = Math.min(col, dash.grid.columns - colSpan + 1);
    row = Math.min(row, dash.grid.rows    - rowSpan + 1);
    return { col: col, row: row };
  }

  function _hasCollision(dash, col, row, colSpan, rowSpan, excludeId) {
    return dash.widgets.some(function (w) {
      if (w.id === excludeId) return false;
      var wcs = w.position.colSpan || 1;
      var wrs = w.position.rowSpan || 1;
      var colOk = col < w.position.col + wcs && col + colSpan > w.position.col;
      var rowOk = row < w.position.row + wrs && row + rowSpan > w.position.row;
      return colOk && rowOk;
    });
  }

  function enableDropZone(page, dash) {
    page.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (!_dragWc || !_overlay) return;

      var colSpan = _dragWc.position.colSpan || 1;
      var rowSpan = _dragWc.position.rowSpan || 1;
      var pos     = _eventToCell(e, page, dash, colSpan, rowSpan);
      var col     = pos.col;
      var row     = pos.row;

      var blocked = _hasCollision(dash, col, row, colSpan, rowSpan, _dragWc.id);

      _highlightCells(col, row, colSpan, rowSpan, blocked);

      if (_ghost) {
        _ghost.style.gridColumn = col + ' / span ' + colSpan;
        _ghost.style.gridRow    = row + ' / span ' + rowSpan;
      }

      // Live-update properties panel inputs
      var colInput = document.getElementById('prop-col');
      var rowInput = document.getElementById('prop-row');
      if (colInput) colInput.value = col;
      if (rowInput) rowInput.value = row;
    });

    page.addEventListener('drop', function (e) {
      e.preventDefault();
      var widgetId = e.dataTransfer.getData('widgetId');
      var wc = dash.widgets.find(function (w) { return w.id === widgetId; });
      if (!wc) return;

      var colSpan = wc.position.colSpan || 1;
      var rowSpan = wc.position.rowSpan || 1;
      var pos     = _eventToCell(e, page, dash, colSpan, rowSpan);
      var col     = pos.col;
      var row     = pos.row;

      // Reject blocked drops
      if (_hasCollision(dash, col, row, colSpan, rowSpan, widgetId)) return;

      wc.position.col = col;
      wc.position.row = row;

      app.markDirty();
      app.renderCanvas();
      app.showWidgetProps(widgetId);
    });
  }

  function addResizeHandles(card, wc, dash) {
    // Don't add card-level resize handles for full-screen map widgets —
    // they overlap the map overlay resize handles and trigger unwanted renderCanvas calls
    if (wc.type === 'usa-map-gl' || wc.type === 'usa-map') return;

    // Right handle → resize colSpan
    const rightHandle = document.createElement('div');
    rightHandle.style.cssText = [
      'position:absolute', 'right:-4px', 'top:20%', 'height:60%', 'width:8px',
      'cursor:ew-resize', 'background:rgba(253,164,212,0.7)', 'border-radius:4px',
      'opacity:0', 'transition:opacity 0.15s', 'z-index:10'
    ].join(';');

    // Bottom handle → resize rowSpan
    const bottomHandle = document.createElement('div');
    bottomHandle.style.cssText = [
      'position:absolute', 'bottom:-4px', 'left:20%', 'width:60%', 'height:8px',
      'cursor:ns-resize', 'background:rgba(253,164,212,0.7)', 'border-radius:4px',
      'opacity:0', 'transition:opacity 0.15s', 'z-index:10'
    ].join(';');

    card.appendChild(rightHandle);
    card.appendChild(bottomHandle);

    var badge = document.createElement('div');
    badge.className = 'resize-badge';
    badge.id = 'resize-badge-' + wc.id;
    card.appendChild(badge);

    // Show/hide handles on hover
    card.addEventListener('mouseenter', function () {
      rightHandle.style.opacity = '1';
      bottomHandle.style.opacity = '1';
    });
    card.addEventListener('mouseleave', function () {
      rightHandle.style.opacity = '0';
      bottomHandle.style.opacity = '0';
    });

    // Right handle: resize colSpan
    rightHandle.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      const page = card.closest('.dashboard-page');
      const rect = page.getBoundingClientRect();
      const colWidth = rect.width / dash.grid.columns;
      const startX = e.clientX;
      const startSpan = wc.position.colSpan || 1;
      const maxSpan = dash.grid.columns - wc.position.col + 1;

      function onMove(e) {
        const delta = e.clientX - startX;
        const spanDelta = Math.round(delta / colWidth);
        wc.position.colSpan = Math.max(1, Math.min(maxSpan, startSpan + spanDelta));
        card.style.gridColumn = wc.position.col + ' / span ' + wc.position.colSpan;
        badge.style.display = 'block';
        badge.textContent = wc.position.colSpan + '\u00D7' + (wc.position.rowSpan || 1);
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        badge.style.display = 'none';
        app.markDirty();
        app.renderCanvas();
        app.showWidgetProps(wc.id);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Bottom handle: resize rowSpan
    bottomHandle.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      const page = card.closest('.dashboard-page');
      const rect = page.getBoundingClientRect();
      const rowHeight = rect.height / dash.grid.rows;
      const startY = e.clientY;
      const startSpan = wc.position.rowSpan || 1;
      const maxSpan = dash.grid.rows - wc.position.row + 1;

      function onMove(e) {
        const delta = e.clientY - startY;
        const spanDelta = Math.round(delta / rowHeight);
        wc.position.rowSpan = Math.max(1, Math.min(maxSpan, startSpan + spanDelta));
        card.style.gridRow = wc.position.row + ' / span ' + wc.position.rowSpan;
        badge.style.display = 'block';
        badge.textContent = (wc.position.colSpan || 1) + '\u00D7' + wc.position.rowSpan;
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        badge.style.display = 'none';
        app.markDirty();
        app.renderCanvas();
        app.showWidgetProps(wc.id);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  return { render: render };
})();
