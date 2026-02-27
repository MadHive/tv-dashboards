import { useState } from 'react';

interface Step6DeployProps {
  dashboardName: string;
  refreshInterval: number;
  onUpdateName: (name: string) => void;
  onUpdateInterval: (interval: number) => void;
  onDeploy: () => void;
  onBack: () => void;
}

export function Step6Deploy({
  dashboardName,
  refreshInterval,
  onUpdateName,
  onUpdateInterval,
  onDeploy,
  onBack
}: Step6DeployProps) {
  const [deployed, setDeployed] = useState(false);
  const [displayUrl, setDisplayUrl] = useState('');

  const handleDeploy = () => {
    // Generate URL based on dashboard name
    const slug = dashboardName.toLowerCase().replace(/\s+/g, '-');
    const url = `http://tv.madhive.dev/dashboard/${slug}`;
    setDisplayUrl(url);
    setDeployed(true);
    onDeploy();
  };

  if (deployed) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="text-7xl mb-6">✅</div>
          <h2 className="text-tv-3xl font-semibold text-madhive-pink mb-4">
            Dashboard Created!
          </h2>
        </div>

        <div className="bg-madhive-purple-dark border-2 border-madhive-pink rounded-lg p-8 space-y-6">
          <div>
            <div className="text-tv-sm text-madhive-chalk/60 mb-2">📺 Display URL</div>
            <div className="text-tv-xl text-madhive-pink font-mono">{displayUrl}</div>
            <div className="text-tv-sm text-madhive-chalk/60 mt-2">
              Open this URL on your office TV and press F11 for full-screen
            </div>
          </div>

          <div>
            <div className="text-tv-sm text-madhive-chalk/60 mb-2">📋 Edit URL</div>
            <div className="text-tv-lg text-madhive-chalk font-mono">
              {displayUrl}/edit
            </div>
          </div>

          <div className="pt-4 border-t border-madhive-purple-medium">
            <div className="text-tv-base text-madhive-chalk mb-3">Next Steps:</div>
            <ul className="space-y-2 text-tv-sm text-madhive-chalk/80">
              <li>1. Open Display URL on your office TV</li>
              <li>2. Press F11 for full-screen mode</li>
              <li>3. Dashboard will auto-refresh every {refreshInterval}s</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <a
            href="/app"
            className="px-8 py-4 bg-madhive-purple-dark border-2 border-madhive-purple-medium text-madhive-chalk rounded-lg text-tv-lg font-semibold hover:bg-madhive-purple-medium transition-all"
          >
            Back to Home
          </a>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 bg-madhive-pink text-madhive-purple-deepest rounded-lg text-tv-lg font-semibold hover:bg-madhive-pink/80 transition-all"
          >
            View Dashboard →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-4">
          Deploy to TV
        </h2>
        <p className="text-tv-lg text-madhive-chalk/80">
          Configure final settings for your dashboard
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Dashboard Name */}
        <div>
          <label className="block text-tv-base font-semibold text-madhive-chalk mb-2">
            Dashboard Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={dashboardName}
            onChange={(e) => onUpdateName(e.target.value)}
            placeholder="e.g., Infrastructure Health"
            className="w-full px-6 py-4 bg-madhive-purple-dark border-2 border-madhive-purple-medium rounded-lg text-tv-lg text-madhive-chalk placeholder-madhive-chalk/40 focus:outline-none focus:ring-2 focus:ring-madhive-pink"
          />
        </div>

        {/* Refresh Interval */}
        <div>
          <label className="block text-tv-base font-semibold text-madhive-chalk mb-2">
            Refresh Interval
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => onUpdateInterval(Number(e.target.value))}
            className="w-full px-6 py-4 bg-madhive-purple-dark border-2 border-madhive-purple-medium rounded-lg text-tv-lg text-madhive-chalk focus:outline-none focus:ring-2 focus:ring-madhive-pink"
          >
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute (recommended)</option>
            <option value={300}>5 minutes</option>
            <option value={900}>15 minutes</option>
          </select>
        </div>

        {/* Info Box */}
        <div className="p-6 bg-madhive-purple-dark/50 border border-madhive-purple-medium rounded-lg">
          <div className="text-tv-sm text-madhive-chalk/80 space-y-2">
            <div>• Dashboard will auto-refresh at the selected interval</div>
            <div>• Best viewed on 1080p or 4K displays</div>
            <div>• Use Chrome or Chromium for best compatibility</div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-8 py-4 bg-madhive-purple-dark border-2 border-madhive-purple-medium text-madhive-chalk rounded-lg text-tv-lg font-semibold hover:bg-madhive-purple-medium transition-all"
        >
          ← Back
        </button>
        <button
          onClick={handleDeploy}
          disabled={!dashboardName}
          className={`
            px-8 py-4 rounded-lg text-tv-lg font-semibold transition-all
            ${
              dashboardName
                ? 'bg-madhive-pink text-madhive-purple-deepest hover:bg-madhive-pink/80'
                : 'bg-madhive-purple-medium text-madhive-chalk/50 cursor-not-allowed'
            }
          `}
        >
          Create Dashboard 🚀
        </button>
      </div>
    </div>
  );
}
