// ===========================================================================
// Theme Routes Tests — Following Elysia.js Testing Patterns
// Tests for theme API endpoints (CRUD operations)
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import {
  createTestRequest,
  createJsonPostRequest,
  createJsonPutRequest,
  createDeleteRequest
} from '../../helpers/test-app.js';
import { ThemeManager } from '../../../server/theme-manager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('Theme Routes (Elysia Unit Tests)', () => {
  let app;
  let themeManager;
  let testConfigPath;

  beforeEach(async () => {
    // Create temporary test config file
    const testDir = path.join(tmpdir(), 'theme-tests', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    testConfigPath = path.join(testDir, 'themes.yaml');

    // Initialize theme manager with test config
    themeManager = new ThemeManager(testConfigPath);

    // Seed with test data
    themeManager.themes = [
      {
        id: 'madhive-dark',
        name: 'MadHive Dark',
        author: 'MadHive',
        category: 'dark',
        isDefault: true,
        colors: {
          background: '#0a0a0a',
          text: '#ffffff',
          primary: '#00d9ff',
          secondary: '#ff006e',
          accent: '#8338ec'
        }
      },
      {
        id: 'madhive-light',
        name: 'MadHive Light',
        author: 'MadHive',
        category: 'light',
        isDefault: false,
        colors: {
          background: '#ffffff',
          text: '#000000',
          primary: '#0099cc',
          secondary: '#cc0055',
          accent: '#6622bb'
        }
      },
      {
        id: 'custom-blue',
        name: 'Custom Blue',
        author: 'Custom',
        category: 'custom',
        isDefault: false,
        colors: {
          background: '#001122',
          text: '#eeffff',
          primary: '#0088ff',
          secondary: '#00ffaa',
          accent: '#ff8800'
        }
      }
    ];

    // Build map
    themeManager.themesMap.clear();
    for (const theme of themeManager.themes) {
      themeManager.themesMap.set(theme.id, theme);
    }

    // Write initial config
    await themeManager.writeThemes();

    // Create test app with theme routes
    app = new Elysia()
      .get('/api/themes', ({ query }) => {
        if (query.category) {
          return themeManager.getThemesByCategory(query.category);
        }
        return themeManager.getAllThemes();
      })
      .get('/api/themes/categories', () => {
        return themeManager.getCategories();
      })
      .get('/api/themes/default', ({ set }) => {
        const defaultTheme = themeManager.getDefaultTheme();
        if (!defaultTheme) {
          set.status = 404;
          return { error: 'No default theme found' };
        }
        return defaultTheme;
      })
      .get('/api/themes/:id', ({ params, set }) => {
        const theme = themeManager.getTheme(params.id);
        if (!theme) {
          set.status = 404;
          return { error: 'Theme not found' };
        }
        return theme;
      })
      .post('/api/themes', async ({ body, set }) => {
        try {
          const theme = await themeManager.saveTheme(body);
          set.status = 201;
          return theme;
        } catch (error) {
          set.status = 400;
          return { error: error.message };
        }
      })
      .put('/api/themes/:id', async ({ params, body, set }) => {
        try {
          // Merge ID from params into body
          const themeData = { ...body, id: params.id };
          const theme = await themeManager.saveTheme(themeData);
          return theme;
        } catch (error) {
          set.status = 400;
          return { error: error.message };
        }
      })
      .delete('/api/themes/:id', async ({ params, set }) => {
        try {
          const deleted = await themeManager.deleteTheme(params.id);
          if (!deleted) {
            set.status = 404;
            return { error: 'Theme not found' };
          }
          return { success: true, message: 'Theme deleted' };
        } catch (error) {
          set.status = 400;
          return { error: error.message };
        }
      });
  });

  afterEach(async () => {
    // Cleanup test files
    if (testConfigPath) {
      try {
        await fs.rm(path.dirname(testConfigPath), { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });

  describe('GET /api/themes', () => {
    it('should return all themes', async () => {
      const request = createTestRequest('/api/themes');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const themes = await response.json();
      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBe(3);
    });

    it('should return themes with correct structure', async () => {
      const request = createTestRequest('/api/themes');
      const response = await app.handle(request);

      const themes = await response.json();
      const theme = themes[0];

      expect(theme).toHaveProperty('id');
      expect(theme).toHaveProperty('name');
      expect(theme).toHaveProperty('author');
      expect(theme).toHaveProperty('category');
      expect(theme).toHaveProperty('colors');
      expect(theme.colors).toHaveProperty('background');
      expect(theme.colors).toHaveProperty('text');
      expect(theme.colors).toHaveProperty('primary');
    });

    it('should filter themes by category', async () => {
      const request = createTestRequest('/api/themes?category=dark');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const themes = await response.json();
      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBe(1);
      expect(themes[0].category).toBe('dark');
      expect(themes[0].id).toBe('madhive-dark');
    });

    it('should return empty array for non-existent category', async () => {
      const request = createTestRequest('/api/themes?category=nonexistent');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const themes = await response.json();
      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBe(0);
    });

    it('should include both MadHive and custom themes', async () => {
      const request = createTestRequest('/api/themes');
      const response = await app.handle(request);

      const themes = await response.json();
      const madhiveThemes = themes.filter(t => t.author === 'MadHive');
      const customThemes = themes.filter(t => t.author === 'Custom');

      expect(madhiveThemes.length).toBeGreaterThan(0);
      expect(customThemes.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/themes/categories', () => {
    it('should return array of categories', async () => {
      const request = createTestRequest('/api/themes/categories');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const categories = await response.json();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should return unique categories', async () => {
      const request = createTestRequest('/api/themes/categories');
      const response = await app.handle(request);

      const categories = await response.json();
      const uniqueCategories = [...new Set(categories)];

      expect(categories.length).toBe(uniqueCategories.length);
    });

    it('should include expected categories', async () => {
      const request = createTestRequest('/api/themes/categories');
      const response = await app.handle(request);

      const categories = await response.json();

      expect(categories).toContain('dark');
      expect(categories).toContain('light');
      expect(categories).toContain('custom');
    });
  });

  describe('GET /api/themes/default', () => {
    it('should return default theme', async () => {
      const request = createTestRequest('/api/themes/default');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const theme = await response.json();
      expect(theme.isDefault).toBe(true);
      expect(theme.id).toBe('madhive-dark');
    });

    it('should return 404 when no default theme exists', async () => {
      // Remove default flag from all themes
      for (const theme of themeManager.themes) {
        theme.isDefault = false;
      }

      const request = createTestRequest('/api/themes/default');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/themes/:id', () => {
    it('should return theme by ID', async () => {
      const request = createTestRequest('/api/themes/madhive-dark');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const theme = await response.json();
      expect(theme.id).toBe('madhive-dark');
      expect(theme.name).toBe('MadHive Dark');
    });

    it('should return 404 for non-existent theme', async () => {
      const request = createTestRequest('/api/themes/nonexistent');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error).toContain('not found');
    });

    it('should return complete theme data', async () => {
      const request = createTestRequest('/api/themes/madhive-light');
      const response = await app.handle(request);

      const theme = await response.json();

      expect(theme.id).toBe('madhive-light');
      expect(theme.name).toBeDefined();
      expect(theme.author).toBeDefined();
      expect(theme.category).toBeDefined();
      expect(theme.colors).toBeDefined();
      expect(theme.colors.background).toBeDefined();
      expect(theme.colors.text).toBeDefined();
      expect(theme.colors.primary).toBeDefined();
    });
  });

  describe('POST /api/themes', () => {
    it('should create new custom theme', async () => {
      const newTheme = {
        id: 'custom-green',
        name: 'Custom Green',
        category: 'custom',
        colors: {
          background: '#002200',
          text: '#eeffee',
          primary: '#00ff00',
          secondary: '#00aa00',
          accent: '#88ff88'
        }
      };

      const request = createJsonPostRequest('/api/themes', newTheme);
      const response = await app.handle(request);

      expect(response.status).toBe(201);

      const theme = await response.json();
      expect(theme.id).toBe('custom-green');
      expect(theme.name).toBe('Custom Green');
      expect(theme.author).toBe('Custom');
      expect(theme.createdAt).toBeDefined();
    });

    it('should return 400 for invalid theme data', async () => {
      const invalidTheme = {
        id: 'invalid',
        name: 'Invalid'
        // Missing required colors field
      };

      const request = createJsonPostRequest('/api/themes', invalidTheme);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 400 when trying to overwrite MadHive theme', async () => {
      const overwriteTheme = {
        id: 'madhive-dark',
        name: 'Hacked Dark',
        colors: {
          background: '#ff0000',
          text: '#000000',
          primary: '#ff0000'
        }
      };

      const request = createJsonPostRequest('/api/themes', overwriteTheme);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('MadHive');
    });

    it('should validate required color fields', async () => {
      const incompleteTheme = {
        id: 'incomplete',
        name: 'Incomplete',
        colors: {
          background: '#000000'
          // Missing text and primary
        }
      };

      const request = createJsonPostRequest('/api/themes', incompleteTheme);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('PUT /api/themes/:id', () => {
    it('should update existing custom theme', async () => {
      const updates = {
        name: 'Updated Blue',
        colors: {
          background: '#001133',
          text: '#ffffff',
          primary: '#0099ff',
          secondary: '#00ffbb',
          accent: '#ff9900'
        }
      };

      const request = createJsonPutRequest('/api/themes/custom-blue', updates);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const theme = await response.json();
      expect(theme.id).toBe('custom-blue');
      expect(theme.name).toBe('Updated Blue');
      expect(theme.updatedAt).toBeDefined();
    });

    it('should return 400 when trying to update MadHive theme', async () => {
      const updates = {
        name: 'Hacked Light',
        colors: {
          background: '#ff0000',
          text: '#000000',
          primary: '#ff0000'
        }
      };

      const request = createJsonPutRequest('/api/themes/madhive-light', updates);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('MadHive');
    });

    it('should create theme if it does not exist', async () => {
      const newTheme = {
        name: 'New Purple',
        category: 'custom',
        colors: {
          background: '#220022',
          text: '#ffffff',
          primary: '#aa00aa',
          secondary: '#ff00ff',
          accent: '#ffaaff'
        }
      };

      const request = createJsonPutRequest('/api/themes/custom-purple', newTheme);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const theme = await response.json();
      expect(theme.id).toBe('custom-purple');
      expect(theme.name).toBe('New Purple');
      expect(theme.author).toBe('Custom');
    });
  });

  describe('DELETE /api/themes/:id', () => {
    it('should delete custom theme', async () => {
      const request = createDeleteRequest('/api/themes/custom-blue');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify theme is deleted
      const verifyRequest = createTestRequest('/api/themes/custom-blue');
      const verifyResponse = await app.handle(verifyRequest);
      expect(verifyResponse.status).toBe(404);
    });

    it('should return 400 when trying to delete MadHive theme', async () => {
      const request = createDeleteRequest('/api/themes/madhive-dark');
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('MadHive');
    });

    it('should return 404 for non-existent theme', async () => {
      const request = createDeleteRequest('/api/themes/nonexistent');
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should persist custom theme across operations', async () => {
      // Create
      const newTheme = {
        id: 'persist-test',
        name: 'Persistence Test',
        category: 'custom',
        colors: {
          background: '#111111',
          text: '#eeeeee',
          primary: '#ff00ff',
          secondary: '#00ffff',
          accent: '#ffff00'
        }
      };

      const createRequest = createJsonPostRequest('/api/themes', newTheme);
      const createResponse = await app.handle(createRequest);
      expect(createResponse.status).toBe(201);

      // Read
      const readRequest = createTestRequest('/api/themes/persist-test');
      const readResponse = await app.handle(readRequest);
      expect(readResponse.status).toBe(200);

      const readTheme = await readResponse.json();
      expect(readTheme.id).toBe('persist-test');
      expect(readTheme.name).toBe('Persistence Test');

      // Update
      const updateRequest = createJsonPutRequest('/api/themes/persist-test', {
        name: 'Updated Persistence',
        colors: readTheme.colors
      });
      const updateResponse = await app.handle(updateRequest);
      expect(updateResponse.status).toBe(200);

      // Read updated
      const readUpdatedRequest = createTestRequest('/api/themes/persist-test');
      const readUpdatedResponse = await app.handle(readUpdatedRequest);
      const updatedTheme = await readUpdatedResponse.json();
      expect(updatedTheme.name).toBe('Updated Persistence');

      // Delete
      const deleteRequest = createDeleteRequest('/api/themes/persist-test');
      const deleteResponse = await app.handle(deleteRequest);
      expect(deleteResponse.status).toBe(200);

      // Verify deleted
      const verifyRequest = createTestRequest('/api/themes/persist-test');
      const verifyResponse = await app.handle(verifyRequest);
      expect(verifyResponse.status).toBe(404);
    });

    it('should handle concurrent requests safely', async () => {
      const requests = [
        createTestRequest('/api/themes'),
        createTestRequest('/api/themes/madhive-dark'),
        createTestRequest('/api/themes/categories'),
        createTestRequest('/api/themes/default')
      ];

      const responses = await Promise.all(
        requests.map(req => app.handle(req))
      );

      responses.forEach(response => {
        expect(response.status).toBeLessThan(300);
      });
    });
  });
});
