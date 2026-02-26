import { useStore } from '@nanostores/react';
import { $config, $currentPage, nextPage, prevPage, goToPage } from '@stores/dashboard';
import { useEffect, useState } from 'react';

export default function BottomNav() {
  const config = useStore($config);
  const currentPage = useStore($currentPage);
  const [progress, setProgress] = useState(0);

  const totalPages = config?.dashboards.length ?? 0;
  const pageNumber = currentPage + 1; // Display as 1-indexed
  const ROTATION_INTERVAL = 30000; // 30 seconds (match Layout.tsx)

  // Progress bar animation
  useEffect(() => {
    setProgress(0); // Reset on page change

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / ROTATION_INTERVAL) * 100, 100);
      setProgress(newProgress);
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(interval);
  }, [currentPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        nextPage();
      } else if (e.key === 'ArrowLeft') {
        prevPage();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!config || !config.dashboards || !Array.isArray(config.dashboards) || totalPages === 0) {
    return null;
  }

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 z-50">
      {/* Progress bar */}
      <div className="w-full h-1 bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="h-16 px-6 flex items-center justify-between">
        {/* Left: Page Navigation */}
        <div className="flex items-center gap-4">
          <button
            onClick={prevPage}
            aria-label="previous page"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-lg">←</span>
            <span className="text-sm">Prev</span>
          </button>

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="font-mono tabular-nums">
              {pageNumber} / {totalPages}
            </span>
          </div>

          <button
            onClick={nextPage}
            aria-label="next page"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-sm">Next</span>
            <span className="text-lg">→</span>
          </button>
        </div>

        {/* Center: Page Indicators */}
        <div className="flex items-center gap-2">
          {config?.dashboards?.map((dashboard, index) => (
            <button
              key={dashboard.id}
              onClick={() => goToPage(index)}
              aria-label={`go to page ${index + 1}`}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-blue-500 scale-125'
                  : 'bg-slate-600 hover:bg-slate-500'
              }`}
            />
          )) || []}
        </div>

        {/* Right: Keyboard Shortcuts Hint */}
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span>Navigate:</span>
          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono">
            ←
          </kbd>
          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono">
            →
          </kbd>
        </div>
      </div>
    </footer>
  );
}
