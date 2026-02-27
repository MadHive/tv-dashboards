import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryBuilder } from '@/pages/QueryBuilder';
import { WizardProgressTest } from '@/pages/WizardProgressTest';
import { DashboardWizard } from '@/pages/DashboardWizard';

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
          <Link
            to="/app/query-builder"
            className="block p-6 bg-madhive-purple-dark/50 backdrop-blur-sm rounded-lg border border-madhive-purple-medium hover:border-madhive-pink transition-colors"
          >
            <h2 className="text-tv-xl font-semibold text-madhive-pink mb-2">
              Visual Query Builder
            </h2>
            <p className="text-tv-base text-madhive-chalk/80">
              Build BigQuery queries visually without writing SQL
            </p>
          </Link>
          <Link
            to="/app/wizard-progress-test"
            className="block p-6 bg-madhive-purple-dark/50 backdrop-blur-sm rounded-lg border border-madhive-purple-medium hover:border-madhive-pink transition-colors"
          >
            <h2 className="text-tv-xl font-semibold text-madhive-pink mb-2">
              Wizard Progress Test
            </h2>
            <p className="text-tv-base text-madhive-chalk/80">
              Test the wizard progress indicator component
            </p>
          </Link>
          <Link
            to="/app/dashboard/wizard"
            className="block p-6 bg-madhive-purple-dark/50 backdrop-blur-sm rounded-lg border border-madhive-purple-medium hover:border-madhive-pink transition-colors"
          >
            <h2 className="text-tv-xl font-semibold text-madhive-pink mb-2">
              Dashboard Creation Wizard
            </h2>
            <p className="text-tv-base text-madhive-chalk/80">
              Create a beautiful TV dashboard in 6 easy steps
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/app/query-builder" element={<QueryBuilder />} />
        <Route path="/app/wizard-progress-test" element={<WizardProgressTest />} />
        <Route path="/app/dashboard/wizard" element={<DashboardWizard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
