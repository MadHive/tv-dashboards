// ===========================================================================
// Dashboard Routes Tests — Following Elysia.js Testing Patterns
// Tests for dashboard CRUD operations
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import {
  createTestRequest,
  createJsonPostRequest,
  createJsonPutRequest,
  createDeleteRequest
} from '../../helpers/test-app.js';
import {
  testDashboard,
  createTestDashboard,
  invalidDashboard
} from '../../helpers/fixtures.js';

describe('Dashboard Routes (Elysia Unit Tests)', () => {
  let app;
  let dashboards = [];

  beforeEach(() => {
    // Reset dashboards array
    dashboards = [
      { ...testDashboard },
      {
        id: 'dashboard-2',
        name: 'Dashboard 2',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: []
      }
    ];

    // Create test app with dashboard routes
    app = new Elysia()
      .put('/api/dashboards/:id', async ({ params, body }) => {
        try {
          const index = dashboards.findIndex(d => d.id === params.id);

          if (index === -1) {
            return new Response(
              JSON.stringify({ success: false, error: `Dashboard not found: ${params.id}` }),
              { status: 404, headers: { 'content-type': 'application/json' } }
            );
          }

          // Validate dashboard
          if (!body.id || !body.name || !body.grid) {
            throw new Error('Invalid dashboard: missing required fields (id, name, grid)');
          }

          // Update dashboard
          dashboards[index] = body;

          return { success: true, dashboard: body };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .post('/api/dashboards', async ({ body }) => {
        try {
          // Validate dashboard
          if (!body.name || !body.grid) {
            throw new Error('Invalid dashboard: missing required fields (name, grid)');
          }

          // Generate ID if missing
          const dashboard = {
            ...body,
            id: body.id || `dashboard-${Date.now()}`
          };

          // Check for duplicate ID
          if (dashboards.some(d => d.id === dashboard.id)) {
            throw new Error(`Dashboard already exists: ${dashboard.id}`);
          }

          dashboards.push(dashboard);

          return { success: true, dashboard };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .delete('/api/dashboards/:id', async ({ params }) => {
        try {
          const index = dashboards.findIndex(d => d.id === params.id);

          if (index === -1) {
            return new Response(
              JSON.stringify({ success: false, error: `Dashboard not found: ${params.id}` }),
              { status: 404, headers: { 'content-type': 'application/json' } }
            );
          }

          const deleted = dashboards.splice(index, 1)[0];

          return { success: true, deleted };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      });
  });

  describe('PUT /api/dashboards/:id', () => {
    it('should update existing dashboard', async () => {
      const updatedDashboard = {
        ...testDashboard,
        name: 'Updated Dashboard Name'
      };

      const request = createJsonPutRequest('/api/dashboards/test-dashboard', updatedDashboard);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.dashboard).toBeObject();
      expect(data.dashboard.name).toBe('Updated Dashboard Name');
      expect(data.dashboard.id).toBe('test-dashboard');
    });

    it('should validate dashboard before update', async () => {
      const invalidUpdate = {
        // Missing required fields
        name: 'Only Name'
      };

      const request = createJsonPutRequest('/api/dashboards/test-dashboard', invalidUpdate);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required fields');
    });

    it('should return 404 for non-existent dashboard', async () => {
      const updatedDashboard = createTestDashboard({ id: 'nonexistent' });

      const request = createJsonPutRequest('/api/dashboards/nonexistent', updatedDashboard);
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Dashboard not found');
    });

    it('should preserve other dashboards during update', async () => {
      const initialCount = dashboards.length;
      const updatedDashboard = {
        ...testDashboard,
        name: 'Modified'
      };

      const request = createJsonPutRequest('/api/dashboards/test-dashboard', updatedDashboard);
      await app.handle(request);

      expect(dashboards.length).toBe(initialCount);
      expect(dashboards.find(d => d.id === 'dashboard-2')).toBeDefined();
    });
  });

  describe('POST /api/dashboards', () => {
    it('should create new dashboard with valid data', async () => {
      const newDashboard = {
        id: 'new-dashboard',
        name: 'New Dashboard',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: []
      };

      const request = createJsonPostRequest('/api/dashboards', newDashboard);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.dashboard).toBeObject();
      expect(data.dashboard.id).toBe('new-dashboard');
      expect(data.dashboard.name).toBe('New Dashboard');
    });

    it('should generate unique ID if missing', async () => {
      const newDashboard = {
        name: 'Dashboard Without ID',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: []
      };

      const request = createJsonPostRequest('/api/dashboards', newDashboard);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.dashboard.id).toBeDefined();
      expect(data.dashboard.id).toContain('dashboard-');
    });

    it('should validate required fields', async () => {
      const invalidDashboard = {
        id: 'invalid',
        // Missing name and grid
      };

      const request = createJsonPostRequest('/api/dashboards', invalidDashboard);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required fields');
    });

    it('should reject duplicate dashboard IDs', async () => {
      const duplicateDashboard = {
        id: 'test-dashboard', // Already exists
        name: 'Duplicate',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: []
      };

      const request = createJsonPostRequest('/api/dashboards', duplicateDashboard);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });

    it('should add dashboard to collection', async () => {
      const initialCount = dashboards.length;
      const newDashboard = {
        id: 'added-dashboard',
        name: 'Added Dashboard',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: []
      };

      const request = createJsonPostRequest('/api/dashboards', newDashboard);
      await app.handle(request);

      expect(dashboards.length).toBe(initialCount + 1);
      expect(dashboards.find(d => d.id === 'added-dashboard')).toBeDefined();
    });
  });

  describe('DELETE /api/dashboards/:id', () => {
    it('should delete existing dashboard', async () => {
      const request = createDeleteRequest('/api/dashboards/test-dashboard');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted).toBeObject();
      expect(data.deleted.id).toBe('test-dashboard');
    });

    it('should return 404 for non-existent dashboard', async () => {
      const request = createDeleteRequest('/api/dashboards/nonexistent');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Dashboard not found');
    });

    it('should remove dashboard from collection', async () => {
      const initialCount = dashboards.length;

      const request = createDeleteRequest('/api/dashboards/test-dashboard');
      await app.handle(request);

      expect(dashboards.length).toBe(initialCount - 1);
      expect(dashboards.find(d => d.id === 'test-dashboard')).toBeUndefined();
    });

    it('should preserve other dashboards', async () => {
      const request = createDeleteRequest('/api/dashboards/test-dashboard');
      await app.handle(request);

      expect(dashboards.find(d => d.id === 'dashboard-2')).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle dashboard with empty widgets array', async () => {
      const dashboard = {
        id: 'empty-widgets',
        name: 'Empty Widgets',
        grid: { columns: 4, rows: 3, gap: 14 },
        widgets: []
      };

      const request = createJsonPostRequest('/api/dashboards', dashboard);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.dashboard.widgets).toBeArray();
      expect(data.dashboard.widgets.length).toBe(0);
    });

    it('should handle dashboard with many widgets', async () => {
      const widgets = Array.from({ length: 20 }, (_, i) => ({
        id: `widget-${i}`,
        type: 'big-number',
        title: `Widget ${i}`,
        source: 'mock',
        position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
      }));

      const dashboard = {
        id: 'many-widgets',
        name: 'Many Widgets',
        grid: { columns: 4, rows: 5, gap: 14 },
        widgets
      };

      const request = createJsonPostRequest('/api/dashboards', dashboard);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.dashboard.widgets.length).toBe(20);
    });
  });
});
