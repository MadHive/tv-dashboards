import { describe, test, expect } from 'bun:test';

// ── Pure mirror of MetricBrowser._buildSourceTabs tab-building logic ──
// Takes array of { name, isConnected }, returns array of { name, disabled }
const BROWSABLE_SOURCES = ['bigquery', 'vulntrack'];

function mirrorBuildSourceTabs(sources) {
  const tabs = [{ name: 'gcp', disabled: false }];
  sources.forEach(src => {
    if (BROWSABLE_SOURCES.includes(src.name)) {
      tabs.push({ name: src.name, disabled: !src.isConnected });
    }
  });
  return tabs;
}

// ── Static BigQuery manifest (mirrored from studio.js BQ_MANIFEST) ──
const BQ_MANIFEST = [
  { name: 'mad-data.reporting.impressions', description: 'Ad impression events with campaign, device, and geo dimensions' },
  { name: 'mad-data.reporting.bid_requests', description: 'Bid request log with win rates, CPM, and auction metadata' },
  { name: 'mad-data.reporting.campaign_delivery', description: 'Campaign pacing, delivery stats, and budget utilization by day' },
  { name: 'mad-data.reporting.win_events', description: 'Auction win events with DSP, advertiser, and creative details' },
  { name: 'mad-data.reporting.segment_memberships', description: 'User segment membership counts and audience overlap' },
  { name: 'mad-data.analytics.daily_summary', description: 'Aggregated daily KPIs: impressions, clicks, spend, CPM' },
  { name: 'mad-data.analytics.client_performance', description: 'Per-client performance metrics: win rate, fill rate, eCPM' },
];

describe('Metric Browser Sources', () => {
  describe('source tab visibility', () => {
    test('always includes GCP tab even when no sources are provided', () => {
      const tabs = mirrorBuildSourceTabs([]);
      const gcpTab = tabs.find(t => t.name === 'gcp');
      expect(gcpTab).toBeDefined();
      expect(gcpTab.disabled).toBe(false);
    });

    test('always includes GCP tab when other sources exist', () => {
      const tabs = mirrorBuildSourceTabs([
        { name: 'bigquery', isConnected: true },
        { name: 'vulntrack', isConnected: false },
      ]);
      const gcpTab = tabs.find(t => t.name === 'gcp');
      expect(gcpTab).toBeDefined();
      expect(gcpTab.disabled).toBe(false);
    });

    test('includes BigQuery tab when isConnected is true and not disabled', () => {
      const tabs = mirrorBuildSourceTabs([{ name: 'bigquery', isConnected: true }]);
      const bqTab = tabs.find(t => t.name === 'bigquery');
      expect(bqTab).toBeDefined();
      expect(bqTab.disabled).toBe(false);
    });

    test('includes BigQuery tab but marks disabled when isConnected is false', () => {
      const tabs = mirrorBuildSourceTabs([{ name: 'bigquery', isConnected: false }]);
      const bqTab = tabs.find(t => t.name === 'bigquery');
      expect(bqTab).toBeDefined();
      expect(bqTab.disabled).toBe(true);
    });

    test('includes VulnTrack tab when isConnected is true and not disabled', () => {
      const tabs = mirrorBuildSourceTabs([{ name: 'vulntrack', isConnected: true }]);
      const vtTab = tabs.find(t => t.name === 'vulntrack');
      expect(vtTab).toBeDefined();
      expect(vtTab.disabled).toBe(false);
    });

    test('includes VulnTrack tab but marks disabled when isConnected is false', () => {
      const tabs = mirrorBuildSourceTabs([{ name: 'vulntrack', isConnected: false }]);
      const vtTab = tabs.find(t => t.name === 'vulntrack');
      expect(vtTab).toBeDefined();
      expect(vtTab.disabled).toBe(true);
    });

    test('does not include non-browsable sources (e.g. elasticsearch)', () => {
      const tabs = mirrorBuildSourceTabs([
        { name: 'elasticsearch', isConnected: true },
        { name: 'datadog', isConnected: true },
      ]);
      const esTab = tabs.find(t => t.name === 'elasticsearch');
      const ddTab = tabs.find(t => t.name === 'datadog');
      expect(esTab).toBeUndefined();
      expect(ddTab).toBeUndefined();
      // Only GCP tab should exist
      expect(tabs.length).toBe(1);
    });

    test('GCP tab is always first in the tab list', () => {
      const tabs = mirrorBuildSourceTabs([
        { name: 'bigquery', isConnected: true },
        { name: 'vulntrack', isConnected: true },
      ]);
      expect(tabs[0].name).toBe('gcp');
    });
  });

  describe('BigQuery static manifest', () => {
    test('manifest is a non-empty array', () => {
      expect(Array.isArray(BQ_MANIFEST)).toBe(true);
      expect(BQ_MANIFEST.length).toBeGreaterThan(0);
    });

    test('each manifest entry has a name string property', () => {
      BQ_MANIFEST.forEach(entry => {
        expect(typeof entry.name).toBe('string');
        expect(entry.name.length).toBeGreaterThan(0);
      });
    });

    test('each manifest entry has a description string property', () => {
      BQ_MANIFEST.forEach(entry => {
        expect(typeof entry.description).toBe('string');
        expect(entry.description.length).toBeGreaterThan(0);
      });
    });

    test('manifest entries reference mad-data project tables', () => {
      const madDataEntries = BQ_MANIFEST.filter(e => e.name.startsWith('mad-data.'));
      expect(madDataEntries.length).toBeGreaterThan(0);
    });
  });
});
