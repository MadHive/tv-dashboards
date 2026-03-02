import { promises as fs } from "fs";
import path from "path";
import yaml from "js-yaml";

/**
 * ThemeManager - Manages theme configurations for TV dashboards
 *
 * Features:
 * - Load themes from YAML configuration
 * - CRUD operations for custom themes
 * - Protection for built-in MadHive themes
 * - Category-based filtering
 * - Theme application to dashboard configs
 */
export class ThemeManager {
  constructor(configPath = null) {
    this.configPath = configPath || path.resolve(process.cwd(), "config/themes.yaml");
    this.themes = [];
    this.themesMap = new Map();
  }

  /**
   * Load themes from YAML configuration file
   * Handles file not found gracefully
   */
  async loadThemes() {
    try {
      const content = await fs.readFile(this.configPath, "utf8");
      const data = yaml.load(content, { schema: yaml.CORE_SCHEMA });
      this.themes = data.themes || [];

      // Build lookup map for performance
      this.themesMap.clear();
      for (const theme of this.themes) {
        this.themesMap.set(theme.id, theme);
      }

      return this.themes;
    } catch (error) {
      if (error.code === "ENOENT") {
        // File doesn't exist - start with empty array
        this.themes = [];
        this.themesMap.clear();
        return this.themes;
      }
      throw error;
    }
  }

  /**
   * Get all themes
   * @returns {Array} Array of theme objects
   */
  getAllThemes() {
    return [...this.themes];
  }

  /**
   * Get theme by ID
   * @param {string} id - Theme ID
   * @returns {object|null} Theme object or null if not found
   */
  getTheme(id) {
    return this.themesMap.get(id) || null;
  }

  /**
   * Get the default theme
   * @returns {object|null} Default theme or null
   */
  getDefaultTheme() {
    return this.themes.find(theme => theme.isDefault === true) || null;
  }

  /**
   * Get themes by category
   * @param {string} category - Category name
   * @returns {Array} Array of themes in category
   */
  getThemesByCategory(category) {
    return this.themes.filter(theme => theme.category === category);
  }

  /**
   * Get unique categories
   * @returns {Array} Array of category names
   */
  getCategories() {
    const categories = new Set();
    for (const theme of this.themes) {
      if (theme.category) {
        categories.add(theme.category);
      }
    }
    return Array.from(categories);
  }

  /**
   * Save or update a theme
   * @param {object} theme - Theme object
   * @returns {object} Saved theme
   * @throws {Error} If validation fails or attempting to overwrite MadHive theme
   */
  async saveTheme(theme) {
    // Validate required fields
    if (!theme.id || !theme.name || !theme.colors) {
      throw new Error("Theme must have id, name, and colors");
    }

    // Validate theme.id format (security - prevent path traversal)
    if (typeof theme.id !== 'string' || !/^[a-z0-9-]+$/.test(theme.id)) {
      throw new Error('Theme ID must be lowercase alphanumeric with hyphens');
    }
    if (theme.id.length > 50) {
      throw new Error('Theme ID must be less than 50 characters');
    }

    // Validate colors structure
    const requiredColors = ['background', 'text', 'primary'];
    if (!theme.colors || typeof theme.colors !== 'object') {
      throw new Error('Theme colors must be an object');
    }
    for (const color of requiredColors) {
      if (!theme.colors[color]) {
        throw new Error(`Theme colors must include ${color}`);
      }
    }

    // Check if theme exists
    const existingTheme = this.getTheme(theme.id);

    // Prevent overwriting MadHive themes
    if (existingTheme && existingTheme.author === "MadHive") {
      throw new Error(`Cannot overwrite built-in MadHive theme: ${theme.id}`);
    }

    // Set metadata
    const now = new Date().toISOString();
    if (existingTheme) {
      // Update existing custom theme
      theme.updatedAt = now;
      theme.createdAt = existingTheme.createdAt || now;
      theme.author = existingTheme.author || "Custom";
    } else {
      // Create new custom theme
      theme.createdAt = now;
      theme.author = "Custom";
    }

    // Add or update in arrays
    if (existingTheme) {
      const index = this.themes.findIndex(t => t.id === theme.id);
      this.themes[index] = theme;
    } else {
      this.themes.push(theme);
    }

    // Update map
    this.themesMap.set(theme.id, theme);

    // Persist to disk
    await this.writeThemes();

    return theme;
  }

  /**
   * Delete a theme
   * @param {string} id - Theme ID
   * @returns {boolean} True if deleted, false if not found
   * @throws {Error} If attempting to delete MadHive theme
   */
  async deleteTheme(id) {
    const theme = this.getTheme(id);

    if (!theme) {
      return false;
    }

    // Prevent deleting MadHive themes
    if (theme.author === "MadHive") {
      throw new Error(`Cannot delete built-in MadHive theme: ${id}`);
    }

    // Remove from array
    const index = this.themes.findIndex(t => t.id === id);
    if (index !== -1) {
      this.themes.splice(index, 1);
    }

    // Remove from map
    this.themesMap.delete(id);

    // Persist to disk
    await this.writeThemes();

    return true;
  }

  /**
   * Write themes to YAML file
   */
  async writeThemes() {
    try {
      const data = {
        themes: this.themes
      };

      const yamlContent = yaml.dump(data, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });

      await fs.writeFile(this.configPath, yamlContent, "utf8");
    } catch (error) {
      throw new Error(`Failed to write themes to ${this.configPath}: ${error.message}`);
    }
  }

  /**
   * Apply theme to dashboard configuration
   * @param {object} dashboardConfig - Dashboard configuration
   * @param {string} themeId - Theme ID to apply
   * @returns {object} Dashboard config with theme applied
   */
  applyTheme(dashboardConfig, themeId) {
    const theme = this.getTheme(themeId);
    const effectiveThemeId = theme ? themeId : this.getDefaultTheme()?.id;

    return {
      ...dashboardConfig,
      theme: effectiveThemeId
    };
  }
}

// Export singleton instance
export const themeManager = new ThemeManager();
