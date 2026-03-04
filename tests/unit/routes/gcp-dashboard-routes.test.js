import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';

const mockListDashboards = mock(async (project) => [
  { name: `projects/${project}/dashboards/abc`, displayName: 'Bidder Overview', tileCount: 5 },
]);

const mockGetDashboard = mock(async (_name) => [
  {
    id:          'winner-candidates-a1b2',
    name:        'Winner Candidates',
    metricType:  'custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count',
    filters:     '',
    aggregation: { perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_SUM', alignmentPeriod: '60s' },
  },
]);

mock.module('../../../server/gcp-dashboards.js', () => ({
  listDashboards: mockListDashboards,
  getDashboard:   mockGetDashboard,
}));

const mockLoadQueries = mock(() => ({
  gcp: [{ id: 'existing-q', metricType: 'run.googleapis.com/request_count' }],
}));

mock.module('../../../server/query-manager.js', () => ({
  loadQueries: mockLoadQueries,
}));

const { gcpDashboardRoutes } = await import('../../../server/gcp-dashboard-routes.js');

describe('GCP Dashboard Routes', () => {
  let app;

  beforeEach(() => {
    app = new Elysia().use(gcpDashboardRoutes);
    mockListDashboards.mockClear();
    mockGetDashboard.mockClear();
  });

  describe('GET /api/gcp/dashboards', () => {
    it('returns dashboard list for default project', async () => {
      const res  = await app.handle(new Request('http://localhost/api/gcp/dashboards'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.dashboards)).toBe(true);
      expect(body.dashboards[0].displayName).toBe('Bidder Overview');
    });

    it('passes project query param to listDashboards', async () => {
      await app.handle(new Request('http://localhost/api/gcp/dashboards?project=mad-data'));
      expect(mockListDashboards).toHaveBeenCalledWith('mad-data');
    });

    it('returns 500 with error when GCP call fails', async () => {
      mockListDashboards.mockRejectedValueOnce(new Error('auth failed'));
      const res  = await app.handle(new Request('http://localhost/api/gcp/dashboards'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('auth failed');
    });
  });

  describe('GET /api/gcp/dashboards/:name', () => {
    it('returns parsed tiles for a dashboard', async () => {
      const res  = await app.handle(new Request('http://localhost/api/gcp/dashboards/abc?project=mad-master'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.tiles)).toBe(true);
      expect(body.tiles[0].metricType).toBe('custom.googleapis.com/opencensus/mhive/bidder/winner_candidates_count');
    });

    it('flags tiles whose metricType already exists in queries.yaml', async () => {
      mockGetDashboard.mockResolvedValueOnce([{
        id: 'req-count-xxxx',
        name: 'Request Count',
        metricType: 'run.googleapis.com/request_count',
        filters: '',
        aggregation: { perSeriesAligner: 'ALIGN_RATE', alignmentPeriod: '60s' },
      }]);
      const res  = await app.handle(new Request('http://localhost/api/gcp/dashboards/abc?project=mad-master'));
      const body = await res.json();
      expect(body.tiles[0].conflictId).toBe('existing-q');
    });

    it('reconstructs full resource name from :name param and project', async () => {
      await app.handle(new Request('http://localhost/api/gcp/dashboards/abc123?project=mad-data'));
      expect(mockGetDashboard).toHaveBeenCalledWith('projects/mad-data/dashboards/abc123');
    });
  });
});
