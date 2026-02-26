import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import TopBar from './TopBar';
import DashboardGrid from './DashboardGrid';
import BottomNav from './BottomNav';
import { nextPage, $config } from '@stores/dashboard';

/**
 * Main layout component that wraps the entire dashboard app
 */
export default function Layout() {
  const config = useStore($config);

  // Auto-rotate pages every 15 seconds (only when config is loaded)
  useEffect(() => {
    if (!config || !config.dashboards || config.dashboards.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      nextPage();
    }, 30000); // 30 seconds (slower rotation)

    return () => clearInterval(interval);
  }, [config]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopBar />
      <DashboardGrid />
      <BottomNav />
    </div>
  );
}
