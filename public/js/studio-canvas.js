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
    const page = document.createElement('div');
    page.className = 'dashboard-page';
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
      card.style.outline = '2px solid ' + (wc.id === app.selectedWidgetId ? '#00d4ff' : 'transparent');
      card.style.borderRadius = '4px';
      card.style.transition = 'outline 0.1s';
      card.style.overflow = 'hidden';

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
            (el.dataset.widgetId === wc.id ? '#00d4ff' : 'transparent');
        });
        app.showWidgetProps(wc.id);
      });

      // Hover highlight
      card.addEventListener('mouseenter', function () {
        if (wc.id !== app.selectedWidgetId) {
          card.style.outline = '2px solid rgba(0,212,255,0.4)';
        }
      });
      card.addEventListener('mouseleave', function () {
        if (wc.id !== app.selectedWidgetId) {
          card.style.outline = '2px solid transparent';
        }
      });

      page.appendChild(card);
    });

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

  return { render: render };
})();
