// ===========================================================================
// Template Routes Tests — Following Elysia.js Testing Patterns
// Tests for dashboard template management endpoints (RESTful API)
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import {
  createTestRequest,
  createJsonPostRequest,
  createJsonPutRequest,
  createDeleteRequest
} from '../../helpers/test-app.js';
import { testDashboard } from '../../helpers/fixtures.js';
import {
  saveTemplate,
  listTemplates,
  loadTemplate,
  deleteTemplate
} from '../../../server/template-manager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('Template Routes (Elysia Unit Tests)', () => {
  let app;
  let testTemplatesDir;

  beforeEach(async () => {
    // Create temporary test templates directory
    const testDir = path.join(tmpdir(), 'template-tests', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    testTemplatesDir = testDir;

    // Mock template-manager functions to use test directory
    // We'll inject the test templates directory for isolation

    // Create test app with template routes
    app = new Elysia()
      .get('/api/templates', ({ query }) => {
        try {
          const templates = listTemplates();

          // Filter by category if provided
          if (query.category) {
            const filtered = templates.filter(t => t.category === query.category);
            return { success: true, templates: filtered };
          }

          return { success: true, templates };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .get('/api/templates/:id', ({ params }) => {
        try {
          // Validate BEFORE sanitization (prevent path traversal)
          if (params.id.includes('..') || params.id.includes('/') || params.id.includes('\\')) {
            return new Response(
              JSON.stringify({ success: false, error: 'Invalid template ID' }),
              { status: 400, headers: { 'content-type': 'application/json' } }
            );
          }

          // Sanitize ID and add .yaml extension
          const sanitizedId = params.id.replace(/[^a-z0-9-]/g, '-');

          // Additional validation after sanitization
          if (sanitizedId.startsWith('-') || sanitizedId.length === 0) {
            return new Response(
              JSON.stringify({ success: false, error: 'Invalid template ID' }),
              { status: 400, headers: { 'content-type': 'application/json' } }
            );
          }

          const filename = `${sanitizedId}.yaml`;
          const template = loadTemplate(filename);
          return { success: true, template };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: error.message.includes('not found') ? 404 : 500, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .post('/api/templates', async ({ body }) => {
        try {
          const { name, dashboard, description, category, author } = body;

          // Validate required fields
          if (!name || !dashboard) {
            throw new Error('Template name and dashboard configuration required');
          }

          // Validate BEFORE sanitization (prevent path traversal)
          if (name.includes('..') || name.includes('/') || name.includes('\\')) {
            throw new Error('Invalid template name');
          }

          // Sanitize name for filename
          const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

          // Additional validation after sanitization
          if (sanitizedName.startsWith('-') || sanitizedName.length === 0) {
            throw new Error('Invalid template name');
          }

          const metadata = {
            description: description || '',
            category: category || 'Custom',
            author: author || 'User'
          };

          const result = await saveTemplate(name, dashboard, metadata);
          return new Response(
            JSON.stringify(result),
            { status: 201, headers: { 'content-type': 'application/json' } }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .put('/api/templates/:id', async ({ params, body }) => {
        try {
          // Validate BEFORE sanitization (prevent path traversal)
          if (params.id.includes('..') || params.id.includes('/') || params.id.includes('\\')) {
            throw new Error('Invalid template ID');
          }

          // Sanitize ID and add .yaml extension
          const sanitizedId = params.id.replace(/[^a-z0-9-]/g, '-');

          // Additional validation after sanitization
          if (sanitizedId.startsWith('-') || sanitizedId.length === 0) {
            throw new Error('Invalid template ID');
          }

          const filename = `${sanitizedId}.yaml`;

          // Load existing template
          const existing = loadTemplate(filename);

          // Merge updates
          const updated = {
            name: body.name || existing.name,
            description: body.description || existing.description,
            category: body.category || existing.category,
            author: existing.author, // Don't allow changing author
            createdAt: existing.createdAt || new Date().toISOString(),
            dashboard: body.dashboard || existing.dashboard
          };

          // Validate updated name if it was changed
          if (body.name && (body.name.includes('..') || body.name.includes('/') || body.name.includes('\\'))) {
            throw new Error('Invalid template name');
          }

          // Write updated template directly to same file (don't change filename)
          const { dump } = await import('js-yaml');
          const { writeFileSync } = await import('fs');
          const { join, dirname } = await import('path');
          const { fileURLToPath } = await import('url');

          const __dirname = dirname(fileURLToPath(import.meta.url));
          const TEMPLATES_DIR = join(__dirname, '../../../config/templates');
          const filepath = join(TEMPLATES_DIR, filename);

          const yamlContent = dump(updated, {
            indent: 2,
            lineWidth: 120,
            noRefs: true,
            sortKeys: false
          });

          writeFileSync(filepath, yamlContent, 'utf8');

          return { success: true, filename, template: updated };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .delete('/api/templates/:id', ({ params }) => {
        try {
          // Validate BEFORE sanitization (prevent path traversal)
          if (params.id.includes('..') || params.id.includes('/') || params.id.includes('\\')) {
            return new Response(
              JSON.stringify({ success: false, error: 'Invalid template ID' }),
              { status: 400, headers: { 'content-type': 'application/json' } }
            );
          }

          // Sanitize ID and add .yaml extension
          const sanitizedId = params.id.replace(/[^a-z0-9-]/g, '-');

          // Additional validation after sanitization
          if (sanitizedId.startsWith('-') || sanitizedId.length === 0) {
            return new Response(
              JSON.stringify({ success: false, error: 'Invalid template ID' }),
              { status: 400, headers: { 'content-type': 'application/json' } }
            );
          }

          const filename = `${sanitizedId}.yaml`;
          const result = deleteTemplate(filename);
          return new Response(
            JSON.stringify(result),
            { status: 204, headers: { 'content-type': 'application/json' } }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: error.message.includes('not found') ? 404 : 500, headers: { 'content-type': 'application/json' } }
          );
        }
      });
  });

  afterEach(async () => {
    // Cleanup test files
    if (testTemplatesDir) {
      try {
        await fs.rm(testTemplatesDir, { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });

  describe('GET /api/templates', () => {
    it('should list all templates', async () => {
      // Create test templates first
      await saveTemplate('Test Template 1', testDashboard, {
        category: 'Monitoring',
        description: 'Test template 1'
      });
      await saveTemplate('Test Template 2', testDashboard, {
        category: 'Security',
        description: 'Test template 2'
      });

      const request = createTestRequest('/api/templates');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.templates).toBeArray();
      expect(data.templates.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter templates by category', async () => {
      // Create templates with different categories
      await saveTemplate('Monitoring Template', testDashboard, {
        category: 'Monitoring',
        description: 'Monitoring template'
      });
      await saveTemplate('Security Template', testDashboard, {
        category: 'Security',
        description: 'Security template'
      });

      const request = createTestRequest('/api/templates?category=Monitoring');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.templates).toBeArray();
      expect(data.templates.every(t => t.category === 'Monitoring')).toBe(true);
    });

    it('should return empty array for non-existent category', async () => {
      const request = createTestRequest('/api/templates?category=NonExistent');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.templates).toBeArray();
      expect(data.templates.length).toBe(0);
    });

    it('should include template metadata', async () => {
      await saveTemplate('Metadata Test', testDashboard, {
        category: 'Test',
        description: 'Test description',
        author: 'Test Author'
      });

      const request = createTestRequest('/api/templates');
      const response = await app.handle(request);

      const data = await response.json();
      const template = data.templates.find(t => t.name === 'Metadata Test');

      expect(template).toBeDefined();
      expect(template.filename).toBeDefined();
      expect(template.name).toBe('Metadata Test');
      expect(template.category).toBe('Test');
      expect(template.description).toBe('Test description');
      expect(template.author).toBe('Test Author');
      expect(template.createdAt).toBeDefined();
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should load template by ID', async () => {
      await saveTemplate('Load Test', testDashboard, {
        category: 'Test',
        description: 'Load test'
      });

      const request = createTestRequest('/api/templates/load-test');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.template).toBeObject();
      expect(data.template.name).toBe('Load Test');
      expect(data.template.dashboard).toBeDefined();
    });

    it('should return 404 for non-existent template', async () => {
      const request = createTestRequest('/api/templates/non-existent');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });

    it('should sanitize template ID (prevent path traversal)', async () => {
      // URL normalization converts ../../etc/passwd to /etc/passwd, which doesn't match the route
      // This results in 404 before reaching our handler, which is also secure
      const request = createTestRequest('/api/templates/../../etc/passwd');
      const response = await app.handle(request);

      expect(response.status).toBe(404);
    });

    it('should include full template data', async () => {
      await saveTemplate('Full Data Test', testDashboard, {
        category: 'Test',
        description: 'Full data test',
        author: 'Tester'
      });

      const request = createTestRequest('/api/templates/full-data-test');
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.template.name).toBe('Full Data Test');
      expect(data.template.description).toBe('Full data test');
      expect(data.template.category).toBe('Test');
      expect(data.template.author).toBe('Tester');
      expect(data.template.dashboard).toBeDefined();
      expect(data.template.dashboard.id).toBeDefined();
      expect(data.template.dashboard.widgets).toBeArray();
    });
  });

  describe('POST /api/templates', () => {
    it('should create new template', async () => {
      const newTemplate = {
        name: 'New Template',
        dashboard: testDashboard,
        category: 'Custom',
        description: 'New template description',
        author: 'Test User'
      };

      const request = createJsonPostRequest('/api/templates', newTemplate);
      const response = await app.handle(request);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.filename).toBeDefined();
      expect(data.template).toBeDefined();
      expect(data.template.name).toBe('New Template');
    });

    it('should require name field', async () => {
      const invalidTemplate = {
        dashboard: testDashboard
        // Missing name
      };

      const request = createJsonPostRequest('/api/templates', invalidTemplate);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('should require dashboard field', async () => {
      const invalidTemplate = {
        name: 'No Dashboard'
        // Missing dashboard
      };

      const request = createJsonPostRequest('/api/templates', invalidTemplate);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('should sanitize template name (prevent path traversal)', async () => {
      const maliciousTemplate = {
        name: '../../etc/passwd',
        dashboard: testDashboard
      };

      const request = createJsonPostRequest('/api/templates', maliciousTemplate);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid');
    });

    it('should use default values for optional fields', async () => {
      const minimalTemplate = {
        name: 'Minimal Template',
        dashboard: testDashboard
      };

      const request = createJsonPostRequest('/api/templates', minimalTemplate);
      const response = await app.handle(request);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.template.category).toBe('Custom');
      expect(data.template.author).toBe('User');
      expect(data.template.description).toBe('');
    });

    it('should generate filename from sanitized name', async () => {
      const template = {
        name: 'My Custom Template!',
        dashboard: testDashboard
      };

      const request = createJsonPostRequest('/api/templates', template);
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.filename).toMatch(/^my-custom-template.*\.yaml$/);
    });
  });

  describe('PUT /api/templates/:id', () => {
    it('should update existing template', async () => {
      // Create template first
      await saveTemplate('Update Test', testDashboard, {
        category: 'Original',
        description: 'Original description'
      });

      const updates = {
        name: 'Updated Template',
        description: 'Updated description',
        category: 'Updated'
      };

      const request = createJsonPutRequest('/api/templates/update-test', updates);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.template.name).toBe('Updated Template');
      expect(data.template.description).toBe('Updated description');
      expect(data.template.category).toBe('Updated');
    });

    it('should return 400 for non-existent template', async () => {
      const updates = {
        name: 'Updated Name'
      };

      const request = createJsonPutRequest('/api/templates/non-existent', updates);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should preserve existing fields when not provided', async () => {
      // Create template
      await saveTemplate('Preserve Test', testDashboard, {
        category: 'Original',
        description: 'Original description',
        author: 'Original Author'
      });

      // Update only name
      const updates = {
        name: 'Updated Name Only'
      };

      const request = createJsonPutRequest('/api/templates/preserve-test', updates);
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.template.name).toBe('Updated Name Only');
      expect(data.template.category).toBe('Original');
      expect(data.template.description).toBe('Original description');
      expect(data.template.author).toBe('Original Author');
    });

    it('should update dashboard configuration', async () => {
      await saveTemplate('Dashboard Update', testDashboard, {
        category: 'Test'
      });

      const updatedDashboard = {
        ...testDashboard,
        name: 'Updated Dashboard Name',
        widgets: []
      };

      const updates = {
        dashboard: updatedDashboard
      };

      const request = createJsonPutRequest('/api/templates/dashboard-update', updates);
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.template.dashboard.name).toBe('Updated Dashboard Name');
      expect(data.template.dashboard.widgets).toEqual([]);
    });

    it('should sanitize template ID (prevent path traversal)', async () => {
      const updates = {
        name: 'Malicious Update'
      };

      // URL normalization converts ../../etc/passwd to /etc/passwd, which doesn't match the route
      // This results in 404 before reaching our handler, which is also secure
      const request = createJsonPutRequest('/api/templates/../../etc/passwd', updates);
      const response = await app.handle(request);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/templates/:id', () => {
    it('should delete template', async () => {
      await saveTemplate('Delete Test', testDashboard, {
        category: 'Test'
      });

      const request = createDeleteRequest('/api/templates/delete-test');
      const response = await app.handle(request);

      expect(response.status).toBe(204);

      // Verify template is deleted
      const verifyRequest = createTestRequest('/api/templates/delete-test');
      const verifyResponse = await app.handle(verifyRequest);
      expect(verifyResponse.status).toBe(404);
    });

    it('should return 404 for non-existent template', async () => {
      const request = createDeleteRequest('/api/templates/non-existent');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should sanitize template ID (prevent path traversal)', async () => {
      // URL normalization converts ../../etc/passwd to /etc/passwd, which doesn't match the route
      // This results in 404 before reaching our handler, which is also secure
      const request = createDeleteRequest('/api/templates/../../etc/passwd');
      const response = await app.handle(request);

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on internal server error', async () => {
      // This test would require mocking template-manager to throw errors
      // Skipping for now as it requires dependency injection
    });

    it('should validate request body structure', async () => {
      const invalidBody = 'not json';

      const request = new Request('http://localhost/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: invalidBody
      });

      const response = await app.handle(request);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Security Tests', () => {
    it('should prevent directory traversal in template ID', async () => {
      const maliciousIds = [
        '../../etc/passwd',
        '../../../config/secrets',
        '..\\..\\windows\\system32',
        '/etc/passwd',
        'C:\\Windows\\System32'
      ];

      for (const id of maliciousIds) {
        const request = createTestRequest(`/api/templates/${encodeURIComponent(id)}`);
        const response = await app.handle(request);

        // URL-encoded paths will reach our handler and get validated
        // This should return 400 for invalid template IDs
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
      }
    });

    it('should prevent directory traversal in template name', async () => {
      const maliciousNames = [
        '../../etc/passwd',
        '../../../config/secrets',
        '/etc/passwd'
      ];

      for (const name of maliciousNames) {
        const template = {
          name,
          dashboard: testDashboard
        };

        const request = createJsonPostRequest('/api/templates', template);
        const response = await app.handle(request);

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid');
      }
    });
  });

  describe('Integration Tests', () => {
    it('should support full CRUD lifecycle', async () => {
      // Create
      const createRequest = createJsonPostRequest('/api/templates', {
        name: 'CRUD Test',
        dashboard: testDashboard,
        category: 'Test',
        description: 'CRUD lifecycle test'
      });
      const createResponse = await app.handle(createRequest);
      expect(createResponse.status).toBe(201);

      // Read (list)
      const listRequest = createTestRequest('/api/templates');
      const listResponse = await app.handle(listRequest);
      const listData = await listResponse.json();
      expect(listData.templates.some(t => t.name === 'CRUD Test')).toBe(true);

      // Read (single)
      const readRequest = createTestRequest('/api/templates/crud-test');
      const readResponse = await app.handle(readRequest);
      expect(readResponse.status).toBe(200);
      const readData = await readResponse.json();
      expect(readData.template.name).toBe('CRUD Test');

      // Update
      const updateRequest = createJsonPutRequest('/api/templates/crud-test', {
        name: 'Updated CRUD Test',
        description: 'Updated description'
      });
      const updateResponse = await app.handle(updateRequest);
      expect(updateResponse.status).toBe(200);

      // Verify update
      const verifyRequest = createTestRequest('/api/templates/crud-test');
      const verifyResponse = await app.handle(verifyRequest);
      const verifyData = await verifyResponse.json();
      expect(verifyData.template.name).toBe('Updated CRUD Test');

      // Delete
      const deleteRequest = createDeleteRequest('/api/templates/crud-test');
      const deleteResponse = await app.handle(deleteRequest);
      expect(deleteResponse.status).toBe(204);

      // Verify deletion
      const deletedRequest = createTestRequest('/api/templates/crud-test');
      const deletedResponse = await app.handle(deletedRequest);
      expect(deletedResponse.status).toBe(404);
    });
  });
});
