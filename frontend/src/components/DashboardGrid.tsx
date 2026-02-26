import { useStore } from '@nanostores/react';
import { $currentDashboard } from '@stores/dashboard';
import Widget from './Widget';

export default function DashboardGrid() {
  const currentDashboard = useStore($currentDashboard);

  if (!currentDashboard) {
    return null;
  }

  const { grid, widgets } = currentDashboard;

  return (
    <main className="pt-16 pb-16 px-6 h-screen overflow-auto">
      {widgets.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center text-slate-400">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-xl">No widgets configured</p>
            <p className="text-sm mt-2">Add widgets to get started</p>
          </div>
        </div>
      ) : (
        <div
          data-testid="dashboard-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
            gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
            gap: `${grid.gap}px`,
            height: 'calc(100vh - 128px)', // Account for top and bottom nav
          }}
        >
          {widgets.map((widget) => (
            <Widget key={widget.id} widget={widget} />
          ))}
        </div>
      )}
    </main>
  );
}
