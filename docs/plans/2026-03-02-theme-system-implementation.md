# Theme System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement TV-optimized theme system with backend manager, API, 5 pre-built themes, theme selector UI, and TV preview simulator

**Architecture:** Backend theme manager with YAML storage, RESTful API, vanilla JS components for theme selection and TV preview, real-time theme application

**Tech Stack:** Elysia.js, Bun test, Vanilla JavaScript, YAML, CSS custom properties

---

## Pre-Implementation Checklist

- [ ] Design document reviewed: `docs/plans/2026-02-27-admin-platform-enhancement-design.md`
- [ ] Existing components studied: `public/js/components/`
- [ ] Existing managers studied: `server/dashboard-manager.js`, `server/template-manager.js`

---

## Task 1: Create theme configuration file

**Files:**
- Create: `config/themes.yaml`

**Step 1: Create themes config with 5 TV-optimized themes**

Create `config/themes.yaml`:

```yaml
themes:
  - id: dark-high-contrast
    name: Dark High Contrast
    category: TV-Optimized
    description: Pure black background with vibrant colors for maximum visibility
    colors:
      background: "#000000"
      surface: "#1a1a1a"
      primary: "#FF006E"
      secondary: "#00F5FF"
      success: "#00FF41"
      warning: "#FFB627"
      error: "#FF0000"
      text: "#FFFFFF"
      textSecondary: "#B8B8B8"
    fonts:
      base: 24px
      title: 48px
      widget: 32px
      small: 18px
    spacing:
      gap: 20px
      padding: 16px
      margin: 12px
    author: MadHive
    isDefault: true
    createdAt: "2026-03-02"

  - id: light-clean
    name: Light Clean
    category: TV-Optimized
    description: Clean white background with subtle colors for professional displays
    colors:
      background: "#FFFFFF"
      surface: "#F5F5F5"
      primary: "#2563EB"
      secondary: "#7C3AED"
      success: "#10B981"
      warning: "#F59E0B"
      error: "#EF4444"
      text: "#1F2937"
      textSecondary: "#6B7280"
    fonts:
      base: 22px
      title: 44px
      widget: 30px
      small: 16px
    spacing:
      gap: 18px
      padding: 14px
      margin: 10px
    author: MadHive
    isDefault: false
    createdAt: "2026-03-02"

  - id: neon-cyberpunk
    name: Neon Cyberpunk
    category: TV-Optimized
    description: Futuristic dark theme with neon accents and glow effects
    colors:
      background: "#1a1a1a"
      surface: "#2a2a2a"
      primary: "#FF006E"
      secondary: "#00F5FF"
      success: "#39FF14"
      warning: "#FFD700"
      error: "#FF1744"
      text: "#E0E0E0"
      textSecondary: "#A0A0A0"
    fonts:
      base: 24px
      title: 50px
      widget: 34px
      small: 18px
    spacing:
      gap: 22px
      padding: 18px
      margin: 14px
    author: MadHive
    isDefault: false
    createdAt: "2026-03-02"

  - id: corporate-blue
    name: Corporate Blue
    category: Professional
    description: Professional navy theme for executive dashboards
    colors:
      background: "#1e3a5f"
      surface: "#2a4a6f"
      primary: "#3B82F6"
      secondary: "#60A5FA"
      success: "#34D399"
      warning: "#FBBF24"
      error: "#F87171"
      text: "#F3F4F6"
      textSecondary: "#D1D5DB"
    fonts:
      base: 22px
      title: 44px
      widget: 30px
      small: 16px
    spacing:
      gap: 18px
      padding: 14px
      margin: 10px
    author: MadHive
    isDefault: false
    createdAt: "2026-03-02"

  - id: alert-red
    name: Alert Red
    category: Operations
    description: High-urgency red theme for incident monitoring
    colors:
      background: "#2b0000"
      surface: "#3d0000"
      primary: "#FF0000"
      secondary: "#FF4444"
      success: "#00FF00"
      warning: "#FFAA00"
      error: "#FF0000"
      text: "#FFEEEE"
      textSecondary: "#FFCCCC"
    fonts:
      base: 26px
      title: 52px
      widget: 36px
      small: 20px
    spacing:
      gap: 24px
      padding: 20px
      margin: 16px
    author: MadHive
    isDefault: false
    createdAt: "2026-03-02"
```

**Step 2: Commit configuration file**

```bash
git add config/themes.yaml
git commit -m "feat: add theme configuration with 5 TV-optimized themes

- Add dark-high-contrast (default)
- Add light-clean
- Add neon-cyberpunk
- Add corporate-blue
- Add alert-red

Each theme includes colors, fonts, spacing optimized for TV displays"
```

---

## Task 2: Create theme manager backend

**Files:**
- Create: `server/theme-manager.js`

**Step 1: Write test for theme manager**

Create `tests/unit/theme-manager.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'bun:test';
import { ThemeManager } from '../../server/theme-manager.js';

describe('ThemeManager', () => {
  let themeManager;

  beforeEach(() => {
    themeManager = new ThemeManager();
  });

  describe('loadThemes()', () => {
    it('should load themes from config file', async () => {
      await themeManager.loadThemes();
      const themes = themeManager.getAllThemes();

      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeGreaterThan(0);
    });

    it('should identify default theme', async () => {
      await themeManager.loadThemes();
      const defaultTheme = themeManager.getDefaultTheme();

      expect(defaultTheme).toBeDefined();
      expect(defaultTheme.isDefault).toBe(true);
    });
  });

  describe('getTheme()', () => {
    it('should return theme by ID', async () => {
      await themeManager.loadThemes();
      const theme = themeManager.getTheme('dark-high-contrast');

      expect(theme).toBeDefined();
      expect(theme.id).toBe('dark-high-contrast');
      expect(theme.colors).toBeDefined();
    });

    it('should return null for non-existent theme', async () => {
      await themeManager.loadThemes();
      const theme = themeManager.getTheme('does-not-exist');

      expect(theme).toBeNull();
    });
  });

  describe('getThemesByCategory()', () => {
    it('should filter themes by category', async () => {
      await themeManager.loadThemes();
      const tvThemes = themeManager.getThemesByCategory('TV-Optimized');

      expect(Array.isArray(tvThemes)).toBe(true);
      expect(tvThemes.length).toBeGreaterThan(0);
      tvThemes.forEach(theme => {
        expect(theme.category).toBe('TV-Optimized');
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/theme-manager.test.js`
Expected: FAIL - ThemeManager module not found

**Step 3: Implement theme manager**

Create `server/theme-manager.js`:

```javascript
// ===========================================================================
// Theme Manager - Manages dashboard themes
// ===========================================================================

import fs from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';

const THEMES_CONFIG = 'config/themes.yaml';

export class ThemeManager {
  constructor(configPath = THEMES_CONFIG) {
    this.configPath = configPath;
    this.themes = [];
  }

  /**
   * Load themes from YAML configuration
   */
  async loadThemes() {
    try {
      const content = await fs.readFile(this.configPath, 'utf8');
      const config = yaml.load(content);

      if (!config || !config.themes) {
        console.warn('[theme-manager] No themes found in config');
        this.themes = [];
        return;
      }

      this.themes = config.themes;
      console.log(`[theme-manager] Loaded ${this.themes.length} themes`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn('[theme-manager] Themes config file not found:', this.configPath);
        this.themes = [];
      } else {
        console.error('[theme-manager] Failed to load themes:', error.message);
        throw error;
      }
    }
  }

  /**
   * Get all themes
   */
  getAllThemes() {
    return this.themes;
  }

  /**
   * Get theme by ID
   */
  getTheme(id) {
    const theme = this.themes.find(t => t.id === id);
    return theme || null;
  }

  /**
   * Get default theme
   */
  getDefaultTheme() {
    const defaultTheme = this.themes.find(t => t.isDefault === true);
    return defaultTheme || this.themes[0] || null;
  }

  /**
   * Get themes by category
   */
  getThemesByCategory(category) {
    return this.themes.filter(t => t.category === category);
  }

  /**
   * Get theme categories
   */
  getCategories() {
    const categories = new Set(this.themes.map(t => t.category));
    return Array.from(categories);
  }

  /**
   * Save custom theme
   */
  async saveTheme(theme) {
    // Validate theme
    if (!theme.id || !theme.name || !theme.colors) {
      throw new Error('Invalid theme: missing required fields');
    }

    // Check for duplicate ID
    const existing = this.getTheme(theme.id);
    if (existing && existing.author === 'MadHive') {
      throw new Error('Cannot overwrite built-in theme');
    }

    // Add or update theme
    const index = this.themes.findIndex(t => t.id === theme.id);
    if (index >= 0) {
      this.themes[index] = { ...theme, updatedAt: new Date().toISOString() };
    } else {
      this.themes.push({ ...theme, author: 'Custom', createdAt: new Date().toISOString() });
    }

    // Save to file
    await this.writeThemes();

    return this.getTheme(theme.id);
  }

  /**
   * Delete custom theme
   */
  async deleteTheme(id) {
    const theme = this.getTheme(id);

    if (!theme) {
      throw new Error('Theme not found');
    }

    if (theme.author === 'MadHive') {
      throw new Error('Cannot delete built-in theme');
    }

    this.themes = this.themes.filter(t => t.id !== id);

    await this.writeThemes();

    return true;
  }

  /**
   * Write themes to config file
   */
  async writeThemes() {
    try {
      const config = { themes: this.themes };
      const content = yaml.dump(config, { indent: 2, lineWidth: 120 });

      await fs.writeFile(this.configPath, content, 'utf8');
      console.log('[theme-manager] Themes saved successfully');
    } catch (error) {
      console.error('[theme-manager] Failed to save themes:', error.message);
      throw error;
    }
  }

  /**
   * Apply theme to dashboard config
   */
  applyTheme(dashboardConfig, themeId) {
    const theme = this.getTheme(themeId);

    if (!theme) {
      throw new Error(`Theme not found: ${themeId}`);
    }

    return {
      ...dashboardConfig,
      theme: {
        id: theme.id,
        name: theme.name,
        colors: theme.colors,
        fonts: theme.fonts,
        spacing: theme.spacing
      }
    };
  }
}

// Singleton instance
export const themeManager = new ThemeManager();
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/unit/theme-manager.test.js`
Expected: All tests PASS

**Step 5: Commit theme manager**

```bash
git add server/theme-manager.js tests/unit/theme-manager.test.js
git commit -m "feat: implement theme manager backend

- Load themes from YAML config
- Get themes by ID, category, default
- Save/delete custom themes
- Apply themes to dashboard configs
- Comprehensive test coverage"
```

---

## Task 3: Create theme API endpoints

**Files:**
- Modify: `server/index.js` (add theme routes)

**Step 1: Write API tests**

Create `tests/api/theme-api.test.js`:

```javascript
import { describe, it, expect, beforeAll } from 'bun:test';
import { treaty } from '@elysiajs/eden';

const api = treaty('http://localhost:3000');

describe('Theme API', () => {
  describe('GET /api/themes', () => {
    it('should return array of themes', async () => {
      const { data, error } = await api.api.themes.get();

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const { data } = await api.api.themes.get({ query: { category: 'TV-Optimized' } });

      expect(Array.isArray(data)).toBe(true);
      data.forEach(theme => {
        expect(theme.category).toBe('TV-Optimized');
      });
    });
  });

  describe('GET /api/themes/:id', () => {
    it('should return theme by ID', async () => {
      const { data, error } = await api.api.themes({ id: 'dark-high-contrast' }).get();

      expect(error).toBeNull();
      expect(data.id).toBe('dark-high-contrast');
      expect(data.colors).toBeDefined();
    });

    it('should return 404 for non-existent theme', async () => {
      const { error, status } = await api.api.themes({ id: 'does-not-exist' }).get();

      expect(status).toBe(404);
    });
  });

  describe('GET /api/themes/categories', () => {
    it('should return array of categories', async () => {
      const { data } = await api.api.themes.categories.get();

      expect(Array.isArray(data)).toBe(true);
      expect(data).toContain('TV-Optimized');
    });
  });

  describe('GET /api/themes/default', () => {
    it('should return default theme', async () => {
      const { data } = await api.api.themes.default.get();

      expect(data).toBeDefined();
      expect(data.isDefault).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/api/theme-api.test.js`
Expected: FAIL - API endpoints not defined

**Step 3: Add theme routes to server**

Add to `server/index.js` (after dashboards routes):

```javascript
// ===========================================================================
// Theme API
// ===========================================================================
import { themeManager } from './theme-manager.js';

// Initialize theme manager
await themeManager.loadThemes();

// GET /api/themes - List all themes (with optional category filter)
app.get('/api/themes', ({ query }) => {
  try {
    let themes = themeManager.getAllThemes();

    // Filter by category if provided
    if (query.category) {
      themes = themeManager.getThemesByCategory(query.category);
    }

    return themes;
  } catch (error) {
    console.error('[api] Failed to get themes:', error);
    throw error;
  }
});

// GET /api/themes/categories - List theme categories
app.get('/api/themes/categories', () => {
  try {
    return themeManager.getCategories();
  } catch (error) {
    console.error('[api] Failed to get categories:', error);
    throw error;
  }
});

// GET /api/themes/default - Get default theme
app.get('/api/themes/default', () => {
  try {
    const theme = themeManager.getDefaultTheme();
    if (!theme) {
      return { error: 'No default theme found' };
    }
    return theme;
  } catch (error) {
    console.error('[api] Failed to get default theme:', error);
    throw error;
  }
});

// GET /api/themes/:id - Get theme by ID
app.get('/api/themes/:id', ({ params, set }) => {
  try {
    const theme = themeManager.getTheme(params.id);

    if (!theme) {
      set.status = 404;
      return { error: 'Theme not found' };
    }

    return theme;
  } catch (error) {
    console.error('[api] Failed to get theme:', error);
    throw error;
  }
});

// POST /api/themes - Save custom theme
app.post('/api/themes', async ({ body, set }) => {
  try {
    const theme = await themeManager.saveTheme(body);
    set.status = 201;
    return theme;
  } catch (error) {
    console.error('[api] Failed to save theme:', error);
    set.status = 400;
    return { error: error.message };
  }
});

// PUT /api/themes/:id - Update theme
app.put('/api/themes/:id', async ({ params, body, set }) => {
  try {
    const updatedTheme = { ...body, id: params.id };
    const theme = await themeManager.saveTheme(updatedTheme);
    return theme;
  } catch (error) {
    console.error('[api] Failed to update theme:', error);
    set.status = 400;
    return { error: error.message };
  }
});

// DELETE /api/themes/:id - Delete custom theme
app.delete('/api/themes/:id', async ({ params, set }) => {
  try {
    await themeManager.deleteTheme(params.id);
    return { success: true };
  } catch (error) {
    console.error('[api] Failed to delete theme:', error);
    set.status = 400;
    return { error: error.message };
  }
});
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/api/theme-api.test.js`
Expected: All tests PASS

**Step 5: Commit API endpoints**

```bash
git add server/index.js tests/api/theme-api.test.js
git commit -m "feat: add theme API endpoints

- GET /api/themes (list all, filter by category)
- GET /api/themes/categories
- GET /api/themes/default
- GET /api/themes/:id
- POST /api/themes (save custom)
- PUT /api/themes/:id
- DELETE /api/themes/:id
- Comprehensive API tests"
```

---

_This is Phase 1 (Theme System) of the Admin Platform Enhancement. The plan continues with 5 more tasks for the theme selector and TV preview components..._

**Note:** The full plan is abbreviated here for brevity. Would you like me to continue with the remaining tasks (4-8)?
