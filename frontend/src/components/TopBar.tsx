import { useStore } from '@nanostores/react';
import { $config, $currentDashboard } from '@stores/dashboard';
import { useEffect, useState } from 'react';

export default function TopBar() {
  const config = useStore($config);
  const currentDashboard = useStore($currentDashboard);
  const [time, setTime] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time as HH:MM:SS
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Format refresh time as relative
  const formatLastRefresh = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const globalTitle = config?.global?.title || 'Dashboard';
  const [firstWord, ...restWords] = globalTitle.split(' ');

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 z-50">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Platform Title */}
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-white tracking-tight">
            {firstWord.toUpperCase()}
          </span>
          <span className="text-xl font-medium text-slate-400">
            {restWords.join(' ').toUpperCase()}
          </span>
        </div>

        {/* Center: Current Dashboard */}
        <div className="flex items-center gap-3">
          {currentDashboard?.icon && (
            <span className="text-2xl" role="img" aria-label="dashboard icon">
              {currentDashboard.icon}
            </span>
          )}
          <span className="text-lg font-medium text-white">
            {currentDashboard?.name || 'Dashboard'}
          </span>
        </div>

        {/* Right: Status Info */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Data Source:</span>
            <span className="text-emerald-400 font-medium">GCP Cloud Monitoring</span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <div
            className="flex items-center gap-2"
            data-testid="last-refresh"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">
              {formatLastRefresh(lastRefresh)}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <div
            className="font-mono text-slate-300 tabular-nums"
            data-testid="clock"
          >
            {formatTime(time)}
          </div>
        </div>
      </div>
    </header>
  );
}
