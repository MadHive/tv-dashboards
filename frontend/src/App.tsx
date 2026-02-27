import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QueryBuilder } from '@/pages/QueryBuilder';

// Placeholder home page - will be replaced with actual dashboard viewer
function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-madhive-purple-deepest via-madhive-purple-deep to-madhive-purple-dark">
      <div className="container mx-auto px-8 py-16">
        <h1 className="text-tv-huge font-display font-bold text-madhive-pink mb-4">
          MadHive
        </h1>
        <p className="text-tv-xl text-madhive-chalk mb-8">
          TV Dashboards - React Edition
        </p>
        <div className="mt-8 space-y-4">
          <div className="block p-6 bg-madhive-purple-dark/50 backdrop-blur-sm rounded-lg border border-madhive-purple-medium">
            <h2 className="text-tv-xl font-semibold text-madhive-pink mb-2">
              Frontend Components Ready
            </h2>
            <p className="text-tv-base text-madhive-chalk/80 mb-4">
              All 14 widget types implemented with full accessibility support
            </p>
            <ul className="list-disc list-inside text-tv-sm text-madhive-chalk/70 space-y-1">
              <li>WCAG 2.1 AA compliant</li>
              <li>Lazy loading for performance</li>
              <li>Error boundaries and loading states</li>
              <li>Comprehensive documentation</li>
            </ul>
          </div>
          <a
            href="/app/query-builder"
            className="block p-6 bg-madhive-pink/10 hover:bg-madhive-pink/20 backdrop-blur-sm rounded-lg border border-madhive-pink transition-colors"
          >
            <h2 className="text-tv-xl font-semibold text-madhive-pink mb-2">
              → Visual Query Builder
            </h2>
            <p className="text-tv-base text-madhive-chalk/80">
              Build BigQuery queries with a no-code interface
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename="/app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/query-builder" element={<QueryBuilder />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
