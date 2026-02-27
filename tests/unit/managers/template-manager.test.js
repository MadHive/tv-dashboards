// ===========================================================================
// Template Manager Tests — Following Elysia.js Testing Patterns
// Tests for dashboard template save/load/delete operations
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, unlinkSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  saveTemplate,
  listTemplates,
  loadTemplate,
  deleteTemplate,
  exportDashboard,
  importDashboard
} from '../../../server/template-manager.js';
import { testDashboard, testTemplate } from '../../helpers/fixtures.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../../config/templates');
const TEST_TEMPLATE_PREFIX = 'test-template-';

describe('Template Manager', () => {
  let createdTemplates = [];

  beforeEach(() => {
    // Ensure template directory exists
    if (!existsSync(TEMPLATE_DIR)) {
      mkdirSync(TEMPLATE_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test templates
    createdTemplates.forEach(filename => {
      const templatePath = join(TEMPLATE_DIR, filename);
      if (existsSync(templatePath)) {
        try {
          unlinkSync(templatePath);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });
    createdTemplates = [];
  });

  describe('saveTemplate()', () => {
    it('should save template with dashboard data', async () => {
      const templateName = `${TEST_TEMPLATE_PREFIX}save-test`;
      const result = await saveTemplate(templateName, testDashboard);

      expect(result.success).toBe(true);
      expect(result.filename).toBeDefined();
      expect(result.template).toBeObject();

      createdTemplates.push(result.filename);
    });

    it('should save with metadata', async () => {
      const templateName = `${TEST_TEMPLATE_PREFIX}with-metadata`;
      const metadata = {
        author: 'Test User',
        description: 'Test template',
        category: 'Testing'
      };

      const result = await saveTemplate(templateName, testDashboard, metadata);

      expect(result.success).toBe(true);
      expect(result.template.author).toBe('Test User');
      expect(result.template.description).toBe('Test template');
      expect(result.template.category).toBe('Testing');

      createdTemplates.push(result.filename);
    });

    it('should create templates directory if missing', async () => {
      // This is tested implicitly by beforeEach
      const templateName = `${TEST_TEMPLATE_PREFIX}create-dir`;
      const result = await saveTemplate(templateName, testDashboard);

      expect(result.success).toBe(true);
      expect(existsSync(TEMPLATE_DIR)).toBe(true);

      createdTemplates.push(result.filename);
    });

    it('should generate valid filename from name', async () => {
      const templateName = `${TEST_TEMPLATE_PREFIX}Name With Spaces`;
      const result = await saveTemplate(templateName, testDashboard);

      expect(result.filename).toContain('name-with-spaces');
      expect(result.filename).toMatch(/\.yaml$/);

      createdTemplates.push(result.filename);
    });

    it('should include timestamp in saved template', async () => {
      const templateName = `${TEST_TEMPLATE_PREFIX}timestamp`;
      const result = await saveTemplate(templateName, testDashboard);

      const loaded = await loadTemplate(result.filename);
      expect(loaded.createdAt).toBeDefined();

      createdTemplates.push(result.filename);
    });
  });

  describe('listTemplates()', () => {
    it('should list all template files', async () => {
      // Create a test template
      const result = await saveTemplate(`${TEST_TEMPLATE_PREFIX}list-test`, testDashboard);
      createdTemplates.push(result.filename);

      const templates = listTemplates();

      expect(Array.isArray(templates)).toBe(true);
      const testTemplates = templates.filter(t => t.filename.includes(TEST_TEMPLATE_PREFIX));
      expect(testTemplates.length).toBeGreaterThan(0);
    });

    it('should parse metadata from templates', async () => {
      const metadata = { author: 'Test', description: 'Test template' };
      const result = await saveTemplate(`${TEST_TEMPLATE_PREFIX}metadata`, testDashboard, metadata);
      createdTemplates.push(result.filename);

      const templates = listTemplates();
      const found = templates.find(t => t.filename === result.filename);

      expect(found).toBeDefined();
      expect(found.author).toBe('Test');
      expect(found.description).toBe('Test template');
    });

    it('should return empty array when no templates exist', async () => {
      // Clean up any existing test templates first
      const allTemplates = listTemplates();
      const testTemplates = allTemplates.filter(t => t.filename.includes(TEST_TEMPLATE_PREFIX));

      for (const template of testTemplates) {
        await deleteTemplate(template.filename);
      }

      const templates = listTemplates();
      const remaining = templates.filter(t => t.filename.includes(TEST_TEMPLATE_PREFIX));

      expect(remaining.length).toBe(0);
    });
  });

  describe('loadTemplate()', () => {
    it('should load template by filename', async () => {
      const result = await saveTemplate(`${TEST_TEMPLATE_PREFIX}load`, testDashboard);
      createdTemplates.push(result.filename);

      const loaded = loadTemplate(result.filename);

      expect(loaded).toBeObject();
      expect(loaded.dashboard).toBeDefined();
      expect(loaded.dashboard.id).toBe(testDashboard.id);
    });

    it('should include all template fields', async () => {
      const metadata = { author: 'Test User', description: 'Test' };
      const result = await saveTemplate(`${TEST_TEMPLATE_PREFIX}fields`, testDashboard, metadata);
      createdTemplates.push(result.filename);

      const loaded = loadTemplate(result.filename);

      expect(loaded.name).toBeDefined();
      expect(loaded.dashboard).toBeDefined();
      expect(loaded.author).toBe('Test User');
      expect(loaded.createdAt).toBeDefined();
    });

    it('should throw error for missing template', async () => {
      try {
        loadTemplate('nonexistent-template.yaml');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('deleteTemplate()', () => {
    it('should delete template file', async () => {
      const result = await saveTemplate(`${TEST_TEMPLATE_PREFIX}delete`, testDashboard);
      const filename = result.filename;

      const deleteResult = deleteTemplate(filename);

      expect(deleteResult.success).toBe(true);
      expect(existsSync(join(TEMPLATE_DIR, filename))).toBe(false);
    });

    it('should throw error for missing template', async () => {
      try {
        deleteTemplate('nonexistent-template.yaml');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('not found');
      }
    });

    it('should return deleted template info', async () => {
      const result = await saveTemplate(`${TEST_TEMPLATE_PREFIX}delete-info`, testDashboard);
      createdTemplates.push(result.filename);

      const deleteResult = await deleteTemplate(result.filename);

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.filename).toBe(result.filename);
    });
  });

  describe('exportDashboard()', () => {
    it('should export dashboard as JSON string', () => {
      const json = exportDashboard(testDashboard);

      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.dashboard).toBeDefined();
      expect(parsed.dashboard.id).toBe(testDashboard.id);
      expect(parsed.dashboard.name).toBe(testDashboard.name);
    });

    it('should include all dashboard properties', () => {
      const json = exportDashboard(testDashboard);
      const parsed = JSON.parse(json);

      expect(parsed.dashboard.id).toBeDefined();
      expect(parsed.dashboard.name).toBeDefined();
      expect(parsed.dashboard.grid).toBeDefined();
      expect(parsed.dashboard.widgets).toBeArray();
    });

    it('should produce valid JSON', () => {
      const json = exportDashboard(testDashboard);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should handle dashboards with many widgets', () => {
      const largeDashboard = {
        ...testDashboard,
        widgets: Array.from({ length: 50 }, (_, i) => ({
          id: `widget-${i}`,
          type: 'big-number',
          title: `Widget ${i}`,
          source: 'mock',
          position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 }
        }))
      };

      const json = exportDashboard(largeDashboard);
      const parsed = JSON.parse(json);

      expect(parsed.dashboard.widgets.length).toBe(50);
    });
  });

  describe('importDashboard()', () => {
    it('should parse JSON string', () => {
      const json = JSON.stringify({ dashboard: testDashboard });
      const dashboard = importDashboard(json);

      expect(dashboard).toBeObject();
      expect(dashboard.id).toBe(testDashboard.id);
    });

    it('should require dashboard field', () => {
      const json = JSON.stringify(testDashboard);

      try {
        importDashboard(json);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('missing dashboard');
      }
    });

    it('should validate basic structure', () => {
      const invalid = JSON.stringify({ invalid: 'data' });

      try {
        importDashboard(invalid);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('missing dashboard');
      }
    });

    it('should throw error for malformed JSON', () => {
      const invalid = '{invalid json}';

      try {
        importDashboard(invalid);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toBeDefined();
      }
    });

    it('should preserve all dashboard properties', () => {
      const json = JSON.stringify({ dashboard: testDashboard });
      const dashboard = importDashboard(json);

      expect(dashboard.id).toBe(testDashboard.id);
      expect(dashboard.name).toBe(testDashboard.name);
      expect(dashboard.grid).toEqual(testDashboard.grid);
      expect(dashboard.widgets.length).toBe(testDashboard.widgets.length);
    });
  });

  describe('Export/Import Round-trip', () => {
    it('should preserve dashboard through export/import', () => {
      const exported = exportDashboard(testDashboard);
      const imported = importDashboard(exported);

      expect(imported.id).toBe(testDashboard.id);
      expect(imported.name).toBe(testDashboard.name);
      expect(imported.widgets.length).toBe(testDashboard.widgets.length);
    });

    it('should handle complex dashboards', () => {
      const complexDashboard = {
        ...testDashboard,
        widgets: testDashboard.widgets.map(w => ({
          ...w,
          customProperty: 'test value',
          nestedObject: { key: 'value' }
        }))
      };

      const exported = exportDashboard(complexDashboard);
      const imported = importDashboard(exported);

      expect(imported.widgets[0].customProperty).toBe('test value');
      expect(imported.widgets[0].nestedObject.key).toBe('value');
    });
  });
});
