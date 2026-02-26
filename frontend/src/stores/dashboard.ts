import { atom, computed } from 'nanostores';
import type { DashboardConfig, Dashboard, Widget } from '@lib/api';

// Core state atoms
export const $config = atom<DashboardConfig | null>(null);
export const $currentPage = atom<number>(0);
export const $isEditMode = atom<boolean>(false);

// Computed stores
export const $currentDashboard = computed(
  [$config, $currentPage],
  (config, page) => {
    if (!config) return null;
    return config.dashboards[page] ?? null;
  }
);

export const $totalPages = computed($config, (config) => {
  return config?.dashboards.length ?? 0;
});

// Actions
export function setConfig(config: DashboardConfig) {
  $config.set(config);
}

// Implemented widget types
const IMPLEMENTED_WIDGET_TYPES = new Set([
  'big-number',
  'stat-card',
  'gauge',
  'line-chart',
  'bar-chart',
  'table',
  'list',
  'map',
]);

// Check if a dashboard has ALL widgets unimplemented (should be skipped)
function hasOnlyUnimplementedWidgets(dashboard: Dashboard | undefined): boolean {
  if (!dashboard || !dashboard.widgets || dashboard.widgets.length === 0) return true;
  return dashboard.widgets.every(
    (widget) => !IMPLEMENTED_WIDGET_TYPES.has(widget.type)
  );
}

export function nextPage() {
  const config = $config.get();
  if (!config || !config.dashboards) return;

  const total = config.dashboards.length;
  if (total === 0) return;

  const current = $currentPage.get();
  let nextIndex = (current + 1) % total;
  let attempts = 0;

  // Skip dashboards with only unimplemented widgets
  while (hasOnlyUnimplementedWidgets(config.dashboards[nextIndex]) && attempts < total) {
    nextIndex = (nextIndex + 1) % total;
    attempts++;
  }

  // If all dashboards have only unimplemented widgets, just go to next one anyway
  if (attempts >= total) {
    nextIndex = (current + 1) % total;
  }

  $currentPage.set(nextIndex);
}

export function prevPage() {
  const config = $config.get();
  if (!config || !config.dashboards) return;

  const total = config.dashboards.length;
  if (total === 0) return;

  const current = $currentPage.get();
  let prevIndex = current === 0 ? total - 1 : current - 1;
  let attempts = 0;

  // Skip dashboards with only unimplemented widgets
  while (hasOnlyUnimplementedWidgets(config.dashboards[prevIndex]) && attempts < total) {
    prevIndex = prevIndex === 0 ? total - 1 : prevIndex - 1;
    attempts++;
  }

  // If all dashboards have only unimplemented widgets, just go to previous one anyway
  if (attempts >= total) {
    prevIndex = current === 0 ? total - 1 : current - 1;
  }

  $currentPage.set(prevIndex);
}

export function goToPage(index: number) {
  const total = $totalPages.get();
  if (index >= 0 && index < total) {
    $currentPage.set(index);
  }
}

export function toggleEditMode() {
  $isEditMode.set(!$isEditMode.get());
}

export function enableEditMode() {
  $isEditMode.set(true);
}

export function disableEditMode() {
  $isEditMode.set(false);
}

export function updateWidget(widgetId: string, updates: Partial<Widget>) {
  const config = $config.get();
  if (!config) return;

  const currentPageIndex = $currentPage.get();
  const dashboard = config.dashboards[currentPageIndex];
  if (!dashboard) return;

  const widgetIndex = dashboard.widgets.findIndex((w) => w.id === widgetId);
  if (widgetIndex === -1) return;

  // Create updated config
  const updatedConfig = {
    ...config,
    dashboards: config.dashboards.map((dash, idx) => {
      if (idx !== currentPageIndex) return dash;

      return {
        ...dash,
        widgets: dash.widgets.map((widget, wIdx) => {
          if (wIdx !== widgetIndex) return widget;
          return { ...widget, ...updates };
        }),
      };
    }),
  };

  $config.set(updatedConfig);
}

export function addWidget(widget: Widget) {
  const config = $config.get();
  if (!config) return;

  const currentPageIndex = $currentPage.get();
  const dashboard = config.dashboards[currentPageIndex];
  if (!dashboard) return;

  const updatedConfig = {
    ...config,
    dashboards: config.dashboards.map((dash, idx) => {
      if (idx !== currentPageIndex) return dash;
      return {
        ...dash,
        widgets: [...dash.widgets, widget],
      };
    }),
  };

  $config.set(updatedConfig);
}

export function deleteWidget(widgetId: string) {
  const config = $config.get();
  if (!config) return;

  const currentPageIndex = $currentPage.get();
  const dashboard = config.dashboards[currentPageIndex];
  if (!dashboard) return;

  const updatedConfig = {
    ...config,
    dashboards: config.dashboards.map((dash, idx) => {
      if (idx !== currentPageIndex) return dash;
      return {
        ...dash,
        widgets: dash.widgets.filter((w) => w.id !== widgetId),
      };
    }),
  };

  $config.set(updatedConfig);
}
