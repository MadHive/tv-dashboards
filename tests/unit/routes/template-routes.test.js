// ===========================================================================
// Template Routes Tests — Following Elysia.js Testing Patterns
// Tests for dashboard template management endpoints
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import {
  createTestRequest,
  createJsonPostRequest,
  createDeleteRequest
} from '../../helpers/test-app.js';
import { testDashboard, testTemplate } from '../../helpers/fixtures.js';

describe('Template Routes (Elysia Unit Tests)', () => {
  let app;
  let templates;

  beforeEach(() => {
    // Mock template storage
    templates = [
      {
        filename: 'service-dashboard.json',
        name: 'Service Dashboard Template',
        dashboard: testDashboard,
        metadata: {
          author: 'Test User',
          description: 'Service monitoring template',
          tags: ['monitoring', 'services']
        }
      },
      {
        filename: 'security-dashboard.json',
        name: 'Security Dashboard Template',
        dashboard: {
          id: 'security',
          name: 'Security Dashboard',
          grid: { columns: 4, rows: 3, gap: 14 },
          widgets: []
        },
        metadata: {
          author: 'Admin',
          description: 'Security monitoring template',
          tags: ['security']
        }
      }
    ];

    // Create test app with template routes
    app = new Elysia()
      .get('/api/templates', () => {
        try {
          return { success: true, templates };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .get('/api/templates/:filename', ({ params }) => {
        try {
          const template = templates.find(t => t.filename === params.filename);

          if (!template) {
            return new Response(
              JSON.stringify({ success: false, error: `Template not found: ${params.filename}` }),
              { status: 404, headers: { 'content-type': 'application/json' } }
            );
          }

          return { success: true, template };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 404, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .post('/api/templates', async ({ body }) => {
        try {
          const { name, dashboard, metadata } = body;

          if (!name || !dashboard) {
            throw new Error('Template name and dashboard configuration required');
          }

          const filename = `${name.toLowerCase().replace(/\s+/g, '-')}.json`;

          const template = {
            filename,
            name,
            dashboard,
            metadata: metadata || {}
          };

          templates.push(template);

          return { success: true, template, filename };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .delete('/api/templates/:filename', ({ params }) => {
        try {
          const index = templates.findIndex(t => t.filename === params.filename);

          if (index === -1) {
            return new Response(
              JSON.stringify({ success: false, error: `Template not found: ${params.filename}` }),
              { status: 404, headers: { 'content-type': 'application/json' } }
            );
          }

          const deleted = templates.splice(index, 1)[0];

          return { success: true, deleted };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 404, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .post('/api/dashboards/export', ({ body }) => {
        try {
          const { dashboard } = body;

          if (!dashboard) {
            throw new Error('Dashboard configuration required');
          }

          const json = JSON.stringify(dashboard, null, 2);

          return new Response(json, {
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="${dashboard.id || 'dashboard'}.json"`
            }
          });
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .post('/api/dashboards/import', async ({ body }) => {
        try {
          const { json } = body;

          if (!json) {
            throw new Error('JSON data required');
          }

          let dashboard;
          if (typeof json === 'string') {
            dashboard = JSON.parse(json);
          } else {
            dashboard = json;
          }

          // Validate basic structure
          if (!dashboard.id || !dashboard.name) {
            throw new Error('Invalid dashboard: missing id or name');
          }

          return { success: true, dashboard };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      });
  });

  describe('GET /api/templates', () => {
    it('should list all saved templates', async () => {
      const request = createTestRequest('/api/templates');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.templates).toBeArray();
      expect(data.templates.length).toBe(2);
    });

    it('should include template metadata', async () => {
      const request = createTestRequest('/api/templates');
      const response = await app.handle(request);

      const data = await response.json();
      const template = data.templates[0];

      expect(template.filename).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.dashboard).toBeDefined();
      expect(template.metadata).toBeDefined();
    });

    it('should return empty array when no templates exist', async () => {
      templates = [];

      const request = createTestRequest('/api/templates');
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.templates).toBeArray();
      expect(data.templates.length).toBe(0);
    });
  });

  describe('GET /api/templates/:filename', () => {
    it('should load specific template', async () => {
      const request = createTestRequest('/api/templates/service-dashboard.json');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.template).toBeObject();
      expect(data.template.filename).toBe('service-dashboard.json');
    });

    it('should include dashboard configuration', async () => {
      const request = createTestRequest('/api/templates/service-dashboard.json');
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.template.dashboard).toBeDefined();
      expect(data.template.dashboard.id).toBeDefined();
      expect(data.template.dashboard.widgets).toBeArray();
    });

    it('should return 404 for missing template', async () => {
      const request = createTestRequest('/api/templates/nonexistent.json');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Template not found');
    });
  });

  describe('POST /api/templates', () => {
    it('should save new template', async () => {
      const newTemplate = {
        name: 'New Template',
        dashboard: testDashboard,
        metadata: {
          author: 'Test User',
          description: 'Test template'
        }
      };

      const request = createJsonPostRequest('/api/templates', newTemplate);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.template).toBeDefined();
      expect(data.filename).toBeDefined();
    });

    it('should generate filename from name', async () => {
      const newTemplate = {
        name: 'My Custom Template',
        dashboard: testDashboard
      };

      const request = createJsonPostRequest('/api/templates', newTemplate);
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.filename).toBe('my-custom-template.json');
    });

    it('should require name and dashboard', async () => {
      const invalidTemplate = {
        // Missing name and dashboard
        metadata: {}
      };

      const request = createJsonPostRequest('/api/templates', invalidTemplate);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('should save with metadata', async () => {
      const newTemplate = {
        name: 'Template with Metadata',
        dashboard: testDashboard,
        metadata: {
          author: 'John Doe',
          tags: ['custom', 'test']
        }
      };

      const request = createJsonPostRequest('/api/templates', newTemplate);
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.template.metadata).toBeDefined();
      expect(data.template.metadata.author).toBe('John Doe');
      expect(data.template.metadata.tags).toContain('custom');
    });

    it('should handle missing metadata gracefully', async () => {
      const newTemplate = {
        name: 'Template without Metadata',
        dashboard: testDashboard
      };

      const request = createJsonPostRequest('/api/templates', newTemplate);
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.template.metadata).toBeDefined();
    });
  });

  describe('DELETE /api/templates/:filename', () => {
    it('should delete template', async () => {
      const request = createDeleteRequest('/api/templates/service-dashboard.json');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted).toBeDefined();
      expect(data.deleted.filename).toBe('service-dashboard.json');
    });

    it('should return 404 for missing template', async () => {
      const request = createDeleteRequest('/api/templates/nonexistent.json');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Template not found');
    });

    it('should remove template from collection', async () => {
      const initialCount = templates.length;

      const request = createDeleteRequest('/api/templates/service-dashboard.json');
      await app.handle(request);

      expect(templates.length).toBe(initialCount - 1);
      expect(templates.find(t => t.filename === 'service-dashboard.json')).toBeUndefined();
    });
  });

  describe('POST /api/dashboards/export', () => {
    it('should export dashboard as JSON', async () => {
      const exportRequest = {
        dashboard: testDashboard
      };

      const request = createJsonPostRequest('/api/dashboards/export', exportRequest);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const headers = response.headers;
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should set download filename', async () => {
      const exportRequest = {
        dashboard: testDashboard
      };

      const request = createJsonPostRequest('/api/dashboards/export', exportRequest);
      const response = await app.handle(request);

      const contentDisposition = response.headers.get('Content-Disposition');
      expect(contentDisposition).toContain('attachment');
      expect(contentDisposition).toContain('test-dashboard.json');
    });

    it('should return valid JSON', async () => {
      const exportRequest = {
        dashboard: testDashboard
      };

      const request = createJsonPostRequest('/api/dashboards/export', exportRequest);
      const response = await app.handle(request);

      const text = await response.text();
      const parsed = JSON.parse(text);

      expect(parsed.id).toBe(testDashboard.id);
      expect(parsed.name).toBe(testDashboard.name);
    });

    it('should require dashboard parameter', async () => {
      const exportRequest = {
        // Missing dashboard
      };

      const request = createJsonPostRequest('/api/dashboards/export', exportRequest);
      const response = await app.handle(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/dashboards/import', () => {
    it('should import valid dashboard JSON', async () => {
      const importRequest = {
        json: JSON.stringify(testDashboard)
      };

      const request = createJsonPostRequest('/api/dashboards/import', importRequest);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.dashboard).toBeDefined();
    });

    it('should accept JSON object directly', async () => {
      const importRequest = {
        json: testDashboard
      };

      const request = createJsonPostRequest('/api/dashboards/import', importRequest);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.dashboard.id).toBe(testDashboard.id);
    });

    it('should return 400 for invalid JSON', async () => {
      const importRequest = {
        json: '{invalid json}'
      };

      const request = createJsonPostRequest('/api/dashboards/import', importRequest);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should validate dashboard structure', async () => {
      const invalidDashboard = {
        // Missing id and name
        widgets: []
      };

      const importRequest = {
        json: invalidDashboard
      };

      const request = createJsonPostRequest('/api/dashboards/import', importRequest);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid dashboard');
    });

    it('should require json parameter', async () => {
      const importRequest = {
        // Missing json
      };

      const request = createJsonPostRequest('/api/dashboards/import', importRequest);
      const response = await app.handle(request);

      expect(response.status).toBe(400);
    });
  });
});
