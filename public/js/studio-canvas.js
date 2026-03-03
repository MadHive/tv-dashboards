window.StudioCanvas = (function () {
  'use strict';

  let app = null;

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

      // Render widget using widgets.js
      if (window.Widgets && window.Widgets.create) {
        try {
          window.Widgets.create(wc.type, content, wc);
        } catch (e) {
          content.textContent = wc.type;
        }
      }

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
  }

  function enableDrag(card, wc) {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', function (e) {
      card.style.opacity = '0.5';
      e.dataTransfer.setData('widgetId', wc.id);
    });
    card.addEventListener('dragend', function () {
      card.style.opacity = '1';
    });
  }

  function enableDropZone(page, dash) {
    page.addEventListener('dragover', function (e) {
      e.preventDefault();
    });
    page.addEventListener('drop', function (e) {
      e.preventDefault();
      const widgetId = e.dataTransfer.getData('widgetId');
      const wc = dash.widgets.find(function (w) { return w.id === widgetId; });
      if (!wc) return;

      const rect = page.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const colWidth = rect.width / dash.grid.columns;
      const rowHeight = rect.height / dash.grid.rows;

      const col = Math.max(1, Math.min(dash.grid.columns, Math.ceil(relX / colWidth)));
      const row = Math.max(1, Math.min(dash.grid.rows, Math.ceil(relY / rowHeight)));

      wc.position.col = col;
      wc.position.row = row;

      app.markDirty();
      app.renderCanvas();
      app.showWidgetProps(widgetId);
    });
  }

  function addResizeHandles(card, wc, dash) {
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
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
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
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
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
