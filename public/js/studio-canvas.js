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
    // expose deleteWidget to canvas controls — always fresh so activeDashIdx is never stale
    app.deleteWidget = function (widgetId) {
      const d = app.modifiedConfig.dashboards[app.activeDashIdx];
      if (!d) return;
      d.widgets = d.widgets.filter(function (w) { return w.id !== widgetId; });
      if (app.selectedWidgetId === widgetId) {
        app.selectedWidgetId = null;
        app.selectedWidgetIds = new Set();
      }
      app.markDirty();
      app.renderCanvas();
      app.renderSidebar();
      app.showDashboardProps();
    };

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
    // Set CSS custom properties for the persistent grid background
    page.style.setProperty('--grid-cols', dash.grid.columns);
    page.style.setProperty('--grid-rows', dash.grid.rows);

    // Render each widget
    dash.widgets.forEach(function (wc) {
      const card = document.createElement('div');
      card.className = 'widget widget-' + wc.type;
      card.dataset.widgetId = wc.id;
      card.style.gridColumn = wc.position.col + ' / span ' + (wc.position.colSpan || 1);
      card.style.gridRow = wc.position.row + ' / span ' + (wc.position.rowSpan || 1);
      card.style.cursor = 'pointer';
      card.style.position = 'relative';
      // Multi-select-aware outline
      if (app.selectedWidgetIds && app.selectedWidgetIds.size >= 2 && app.selectedWidgetIds.has(wc.id)) {
        card.style.outline = '2px dashed #60A5FA';
        card.style.boxShadow = '0 0 0 2px rgba(96,165,250,0.10)';
      } else if (wc.id === app.selectedWidgetId) {
        card.style.outline = '2px solid #FDA4D4';
        card.style.boxShadow = '';
      } else {
        card.style.outline = '2px solid transparent';
        card.style.boxShadow = '';
      }
      card.style.borderRadius = '4px';
      card.style.transition = 'outline 0.1s';
      // Map widgets: overflow must be visible so absolutely-positioned overlays
      // (leaderboard, region panels, total overlay, resize corner) aren't clipped.
      card.style.overflow = (wc.type === 'usa-map-gl' || wc.type === 'usa-map') ? 'visible' : 'hidden';

      addResizeHandles(card, wc, dash);

      // Studio control bar — drag handle (≡) + delete (×), shown on card hover.
      // Sits at z-index 100 so it's above the Mapbox canvas for map widgets.
      var studioBar = document.createElement('div');
      studioBar.className = 'studio-widget-bar';

      var dragHandle = document.createElement('div');
      dragHandle.className = 'studio-drag-handle';
      dragHandle.textContent = '\u2630';  // ☰
      dragHandle.title = 'Drag to move';

      var deleteHandle = document.createElement('div');
      deleteHandle.className = 'studio-delete-handle';
      deleteHandle.textContent = '\u2715'; // ✕
      deleteHandle.title = 'Remove widget';
      deleteHandle.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('Remove "' + (wc.title || wc.type) + '"?')) {
          app.deleteWidget(wc.id);
        }
      });

      studioBar.appendChild(dragHandle);
      studioBar.appendChild(deleteHandle);
      card.appendChild(studioBar);

      enableDrag(card, dragHandle, wc);

      // Title
      const title = document.createElement('div');
      title.className = 'widget-title';
      title.textContent = wc.title;
      card.appendChild(title);

      // Subtitle (optional)
      if (wc.subtitle) {
        var subtitle = document.createElement('div');
        subtitle.className = 'widget-subtitle';
        subtitle.textContent = wc.subtitle;
        card.appendChild(subtitle);
      }

      // Content (widget renders into this)
      const content = document.createElement('div');
      content.className = 'widget-content';
      card.appendChild(content);

      // No-data badge — show warning if widget has no query configured
      if (!wc.queryId && !wc.query) {
        const noBadge = document.createElement('div');
        noBadge.className = 'widget-no-data-badge';
        noBadge.textContent = '⚠ No data source';
        noBadge.title = 'This widget has no query assigned — click to configure';
        card.appendChild(noBadge);
      }

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
            content.addEventListener('mgl-overlay-hidden', function (e) {
              // Persist the per-overlay visibility flag (e.g. showLeaderboard: false)
              if (!wc.mglConfig) wc.mglConfig = {};
              wc.mglConfig[e.detail.flag] = e.detail.value;
              if (app && app.markDirty) app.markDirty();
              // Refresh the mgl-config props panel if it's currently visible
              if (app && app.showWidgetProps && app.selectedWidgetId === wc.id) {
                app.showWidgetProps(wc.id);
              }
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
          var ph = document.createElement('div');
          ph.className = 'widget-placeholder';
          var typeName = document.createElement('div');
          typeName.className = 'widget-placeholder-type';
          typeName.textContent = wc.type;
          var badge = document.createElement('span');
          badge.className = 'widget-placeholder-badge';
          badge.textContent = 'beta';
          ph.appendChild(typeName);
          ph.appendChild(badge);
          content.appendChild(ph);
        }
      }
      widgetInstances[wc.id] = widgetInstance;
      card._widgetInstance = widgetInstance;

      // Click: select widget (supports shift+click multi-select)
      card.addEventListener('click', function (e) {
        e.stopPropagation();

        if (e.shiftKey) {
          // Toggle this widget in/out of multi-select set
          if (app.selectedWidgetIds.has(wc.id)) {
            app.selectedWidgetIds.delete(wc.id);
          } else {
            app.selectedWidgetIds.add(wc.id);
          }

          var size = app.selectedWidgetIds.size;
          if (size === 1) {
            var singleId = Array.from(app.selectedWidgetIds)[0];
            app.selectedWidgetId = singleId;
            app.showWidgetProps(singleId);
          } else if (size === 0) {
            app.selectedWidgetId = null;
            app.showDashboardProps();
          } else {
            app.selectedWidgetId = null;
            app.showMultiSelectProps();
          }

          // Update outlines directly without re-rendering
          page.querySelectorAll('.widget').forEach(function (el) {
            var eid = el.dataset.widgetId;
            if (size >= 2 && app.selectedWidgetIds.has(eid)) {
              el.style.outline = '2px dashed #60A5FA';
              el.style.boxShadow = '0 0 0 2px rgba(96,165,250,0.10)';
            } else if (eid === app.selectedWidgetId) {
              el.style.outline = '2px solid #FDA4D4';
              el.style.boxShadow = '';
            } else {
              el.style.outline = '2px solid transparent';
              el.style.boxShadow = '';
            }
          });
          return;
        }

        // Normal single click — reset multi-select to just this widget
        app.selectedWidgetIds = new Set([wc.id]);
        app.selectedWidgetId = wc.id;

        // Update all outlines
        page.querySelectorAll('.widget').forEach(function (el) {
          el.style.outline = '2px solid ' +
            (el.dataset.widgetId === wc.id ? '#FDA4D4' : 'transparent');
          el.style.boxShadow = '';
        });
        app.showWidgetProps(wc.id);
      });

      // Hover highlight
      card.addEventListener('mouseenter', function () {
        if (app.selectedWidgetIds && app.selectedWidgetIds.has(wc.id)) return;
        if (wc.id !== app.selectedWidgetId) {
          card.style.outline = '2px solid rgba(253,164,212,0.5)';
        }
      });
      card.addEventListener('mouseleave', function () {
        if (app.selectedWidgetIds && app.selectedWidgetIds.has(wc.id)) return;
        if (wc.id !== app.selectedWidgetId) {
          card.style.outline = '2px solid transparent';
        }
      });

      page.appendChild(card);
    });

    enableDropZone(page, dash);

    // Rubber-band selection on empty canvas area
    var rbStartX = 0;
    var rbStartY = 0;
    var rbEl = null;
    var rbActive = false;

    page.addEventListener('mousedown', function (e) {
      // Only start rubber-band on left button, not on widget or resize handle
      if (e.button !== 0) return;
      if (e.target.closest('.widget')) return;
      if (e.target.closest('[style*="cursor:ew-resize"]') || e.target.closest('[style*="cursor:ns-resize"]')) return;

      rbStartX = e.clientX;
      rbStartY = e.clientY;
      rbActive = false;

      function onMove(ev) {
        var dx = ev.clientX - rbStartX;
        var dy = ev.clientY - rbStartY;
        if (!rbActive && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        rbActive = true;

        if (!rbEl) {
          rbEl = document.createElement('div');
          rbEl.className = 'rubber-band-rect';
          page.appendChild(rbEl);
        }

        var pageRect = page.getBoundingClientRect();
        var x1 = Math.min(rbStartX, ev.clientX) - pageRect.left;
        var y1 = Math.min(rbStartY, ev.clientY) - pageRect.top;
        var x2 = Math.max(rbStartX, ev.clientX) - pageRect.left;
        var y2 = Math.max(rbStartY, ev.clientY) - pageRect.top;

        rbEl.style.left   = x1 + 'px';
        rbEl.style.top    = y1 + 'px';
        rbEl.style.width  = (x2 - x1) + 'px';
        rbEl.style.height = (y2 - y1) + 'px';
      }

      function onUp(ev) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        if (rbEl && rbEl.parentNode) rbEl.parentNode.removeChild(rbEl);
        rbEl = null;

        if (!rbActive) {
          // Tiny click on empty space — deselect
          app.selectedWidgetId = null;
          app.selectedWidgetIds = new Set();
          page.querySelectorAll('.widget').forEach(function (el) {
            el.style.outline = '2px solid transparent';
            el.style.boxShadow = '';
          });
          app.showDashboardProps();
          return;
        }

        // Compute selection rect in page-relative coords
        var pageRect = page.getBoundingClientRect();
        var selLeft   = Math.min(rbStartX, ev.clientX) - pageRect.left;
        var selTop    = Math.min(rbStartY, ev.clientY) - pageRect.top;
        var selRight  = Math.max(rbStartX, ev.clientX) - pageRect.left;
        var selBottom = Math.max(rbStartY, ev.clientY) - pageRect.top;

        var matched = [];
        page.querySelectorAll('.widget').forEach(function (el) {
          var cr = el.getBoundingClientRect();
          var elLeft   = cr.left   - pageRect.left;
          var elTop    = cr.top    - pageRect.top;
          var elRight  = cr.right  - pageRect.left;
          var elBottom = cr.bottom - pageRect.top;

          // Intersection test
          if (elLeft < selRight && elRight > selLeft && elTop < selBottom && elBottom > selTop) {
            matched.push(el.dataset.widgetId);
          }
        });

        app.selectedWidgetIds = new Set(matched);
        var sz = matched.length;

        if (sz === 0) {
          app.selectedWidgetId = null;
          app.showDashboardProps();
        } else if (sz === 1) {
          app.selectedWidgetId = matched[0];
          app.showWidgetProps(matched[0]);
        } else {
          app.selectedWidgetId = null;
          app.showMultiSelectProps();
        }

        // Update outlines
        page.querySelectorAll('.widget').forEach(function (el) {
          var eid = el.dataset.widgetId;
          if (sz >= 2 && app.selectedWidgetIds.has(eid)) {
            el.style.outline = '2px dashed #60A5FA';
            el.style.boxShadow = '0 0 0 2px rgba(96,165,250,0.10)';
          } else if (eid === app.selectedWidgetId) {
            el.style.outline = '2px solid #FDA4D4';
            el.style.boxShadow = '';
          } else {
            el.style.outline = '2px solid transparent';
            el.style.boxShadow = '';
          }
        });

        rbActive = false;
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
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

  function enableDrag(card, dragHandle, wc) {
    // Only the dedicated handle initiates a drag — prevents Mapbox canvas from
    // blocking drag start when the user grabs inside a map widget.
    dragHandle.setAttribute('draggable', 'true');

    // dragstart bubbles, so listening on card catches it after handle fires it
    card.addEventListener('dragstart', function (e) {
      // Only respond to drags that originated from our handle
      if (!e.target.classList.contains('studio-drag-handle')) return;

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

  function _snapToNearest(dash, desiredCol, desiredRow, colSpan, rowSpan, excludeId) {
    // Clamp desired position to valid grid range before checking collision
    var dc = Math.max(1, Math.min(dash.grid.columns - colSpan + 1, desiredCol));
    var dr = Math.max(1, Math.min(dash.grid.rows    - rowSpan + 1, desiredRow));
    if (!_hasCollision(dash, dc, dr, colSpan, rowSpan, excludeId)) {
      return { col: dc, row: dr };
    }
    // Search in direction order: right, down, left, up — expanding radius
    var maxR = Math.max(dash.grid.columns, dash.grid.rows);
    for (var d = 1; d <= maxR; d++) {
      var candidates = [
        { col: desiredCol + d, row: desiredRow },
        { col: desiredCol,     row: desiredRow + d },
        { col: desiredCol - d, row: desiredRow },
        { col: desiredCol,     row: desiredRow - d },
      ];
      for (var i = 0; i < candidates.length; i++) {
        var c = Math.max(1, Math.min(dash.grid.columns - colSpan + 1, candidates[i].col));
        var r = Math.max(1, Math.min(dash.grid.rows    - rowSpan + 1, candidates[i].row));
        if (!_hasCollision(dash, c, r, colSpan, rowSpan, excludeId)) {
          return { col: c, row: r };
        }
      }
    }
    // No open slot found — return original position unchanged
    return { col: desiredCol, row: desiredRow };
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
      var colspanInput = document.getElementById('prop-colspan');
      var rowspanInput = document.getElementById('prop-rowspan');
      if (colspanInput) colspanInput.value = colSpan;
      if (rowspanInput) rowspanInput.value = rowSpan;
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

      // Snap to nearest open slot if collision
      var snapped = _snapToNearest(dash, col, row, colSpan, rowSpan, widgetId);
      wc.position.col = snapped.col;
      wc.position.row = snapped.row;

      app.markDirty();
      app.renderCanvas();
      app.showWidgetProps(widgetId);
    });
  }

  function addResizeHandles(card, wc, dash) {
    // Map widgets get a dedicated corner resize handle that sits outside the card
    // (overflow:visible on the card means it renders correctly) and resizes
    // both colSpan + rowSpan simultaneously from one drag target.
    if (wc.type === 'usa-map-gl' || wc.type === 'usa-map') {
      const corner = document.createElement('div');
      corner.className = 'mgl-card-resize-corner';
      card.appendChild(corner);

      const badge = document.createElement('div');
      badge.className = 'mgl-card-resize-badge';
      card.appendChild(badge);

      corner.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        e.preventDefault();
        const page  = card.closest('.dashboard-page');
        const rect  = page.getBoundingClientRect();
        const colW  = rect.width  / dash.grid.columns;
        const rowH  = rect.height / dash.grid.rows;
        const startX    = e.clientX;
        const startY    = e.clientY;
        const startCols = wc.position.colSpan || 1;
        const startRows = wc.position.rowSpan || 1;
        const maxCols   = dash.grid.columns - wc.position.col + 1;
        const maxRows   = dash.grid.rows    - wc.position.row + 1;

        function onMove(ev) {
          const newCols = Math.max(1, Math.min(maxCols, startCols + Math.round((ev.clientX - startX) / colW)));
          const newRows = Math.max(1, Math.min(maxRows, startRows + Math.round((ev.clientY - startY) / rowH)));
          wc.position.colSpan = newCols;
          wc.position.rowSpan = newRows;
          card.style.gridColumn = wc.position.col + ' / span ' + newCols;
          card.style.gridRow    = wc.position.row + ' / span ' + newRows;
          badge.style.display   = 'block';
          badge.textContent     = newCols + '\u00D7' + newRows;
        }

        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',   onUp);
          badge.style.display = 'none';
          app.markDirty();
          app.renderCanvas();
          app.showWidgetProps(wc.id);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
      });
      return; // map widgets only get the corner handle — not the edge bars
    }

    // ── Non-map widgets: edge resize bars ────────────────────────────────────

    // Right handle → resize colSpan (fully inside card to avoid overflow:hidden clipping)
    const rightHandle = document.createElement('div');
    rightHandle.style.cssText = [
      'position:absolute', 'right:0', 'top:15%', 'height:70%', 'width:12px',
      'cursor:ew-resize', 'background:rgba(253,164,212,0.6)', 'border-radius:4px 0 0 4px',
      'opacity:0', 'transition:opacity 0.15s', 'z-index:15'
    ].join(';');

    // Bottom handle → resize rowSpan (fully inside card)
    const bottomHandle = document.createElement('div');
    bottomHandle.style.cssText = [
      'position:absolute', 'bottom:0', 'left:15%', 'width:70%', 'height:12px',
      'cursor:ns-resize', 'background:rgba(253,164,212,0.6)', 'border-radius:4px 4px 0 0',
      'opacity:0', 'transition:opacity 0.15s', 'z-index:15'
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

      // Add resizing class for visual feedback
      card.classList.add('is-resizing');

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
        card.classList.remove('is-resizing');
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

      // Add resizing class for visual feedback
      card.classList.add('is-resizing');

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
        card.classList.remove('is-resizing');
        badge.style.display = 'none';
        app.markDirty();
        app.renderCanvas();
        app.showWidgetProps(wc.id);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  return { render: render, hasCollision: _hasCollision, snapToNearest: _snapToNearest };
})();
