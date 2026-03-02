import { describe, it, expect, beforeAll } from "bun:test";
import { promises as fs } from "fs";
import path from "path";
import yaml from "js-yaml";
import { ThemeManager } from "../../server/theme-manager.js";

describe("ThemeManager", () => {
  let manager;
  const testConfigPath = path.resolve(
    process.cwd(),
    "config/themes.yaml"
  );

  beforeAll(async () => {
    manager = new ThemeManager(testConfigPath);
    await manager.loadThemes();
  });

  describe("loadThemes()", () => {
    it("should load themes from config file", async () => {
      const themes = manager.getAllThemes();
      expect(themes).toBeArray();
      expect(themes.length).toBeGreaterThan(0);
    });

    it("should identify default theme", async () => {
      const defaultTheme = manager.getDefaultTheme();
      expect(defaultTheme).toBeDefined();
      expect(defaultTheme.isDefault).toBe(true);
      expect(defaultTheme.id).toBe("dark-high-contrast");
    });

    it("should handle missing file gracefully", async () => {
      const emptyManager = new ThemeManager("/nonexistent/path.yaml");
      await emptyManager.loadThemes();
      expect(emptyManager.getAllThemes()).toEqual([]);
    });
  });

  describe("getTheme()", () => {
    it("should return theme by ID", () => {
      const theme = manager.getTheme("dark-high-contrast");
      expect(theme).toBeDefined();
      expect(theme.id).toBe("dark-high-contrast");
      expect(theme.name).toBe("Dark High Contrast");
    });

    it("should return null for non-existent theme", () => {
      const theme = manager.getTheme("non-existent-theme");
      expect(theme).toBeNull();
    });
  });

  describe("getAllThemes()", () => {
    it("should return all themes", () => {
      const themes = manager.getAllThemes();
      expect(themes).toBeArray();
      expect(themes.length).toBe(5);
    });
  });

  describe("getDefaultTheme()", () => {
    it("should return the default theme", () => {
      const defaultTheme = manager.getDefaultTheme();
      expect(defaultTheme).toBeDefined();
      expect(defaultTheme.isDefault).toBe(true);
    });
  });

  describe("getThemesByCategory()", () => {
    it("should filter themes by category", () => {
      const tvThemes = manager.getThemesByCategory("TV-Optimized");
      expect(tvThemes).toBeArray();
      expect(tvThemes.length).toBe(3);
      expect(tvThemes.every(t => t.category === "TV-Optimized")).toBe(true);
    });

    it("should return empty array for non-existent category", () => {
      const themes = manager.getThemesByCategory("NonExistent");
      expect(themes).toEqual([]);
    });
  });

  describe("getCategories()", () => {
    it("should return unique categories", () => {
      const categories = manager.getCategories();
      expect(categories).toBeArray();
      expect(categories).toContain("TV-Optimized");
      expect(categories).toContain("Professional");
      expect(categories).toContain("Operations");
      expect(categories.length).toBe(3);
    });
  });

  describe("saveTheme()", () => {
    it("should validate required fields", () => {
      const invalidTheme = { name: "Test" };
      expect(() => manager.saveTheme(invalidTheme)).toThrow();
    });

    it("should prevent overwriting MadHive themes", () => {
      const madhiveTheme = {
        id: "dark-high-contrast",
        name: "Modified",
        author: "MadHive",
        colors: { background: "#000" }
      };
      expect(() => manager.saveTheme(madhiveTheme)).toThrow();
    });

    it("should add createdAt timestamp for new themes", () => {
      const newTheme = {
        id: "test-theme",
        name: "Test Theme",
        category: "Test",
        colors: {
          background: "#000",
          text: "#fff"
        }
      };
      const saved = manager.saveTheme(newTheme);
      expect(saved.createdAt).toBeDefined();
      expect(saved.author).toBe("Custom");
    });

    it("should add updatedAt timestamp for existing themes", () => {
      const existingTheme = {
        id: "test-theme",
        name: "Test Theme Updated",
        category: "Test",
        colors: {
          background: "#000",
          text: "#fff"
        }
      };
      const saved = manager.saveTheme(existingTheme);
      expect(saved.updatedAt).toBeDefined();
    });
  });

  describe("deleteTheme()", () => {
    it("should prevent deleting MadHive themes", () => {
      expect(() => manager.deleteTheme("dark-high-contrast")).toThrow();
    });

    it("should delete custom themes", () => {
      // First create a custom theme
      const customTheme = {
        id: "delete-test",
        name: "Delete Test",
        category: "Test",
        colors: { background: "#000", text: "#fff" }
      };
      manager.saveTheme(customTheme);

      // Then delete it
      const result = manager.deleteTheme("delete-test");
      expect(result).toBe(true);
      expect(manager.getTheme("delete-test")).toBeNull();
    });

    it("should return false for non-existent theme", () => {
      const result = manager.deleteTheme("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("applyTheme()", () => {
    it("should apply theme to dashboard config", () => {
      const dashboardConfig = {
        title: "Test Dashboard",
        widgets: [
          { id: "widget1", type: "metric" }
        ]
      };

      const themed = manager.applyTheme(dashboardConfig, "dark-high-contrast");
      expect(themed.theme).toBe("dark-high-contrast");
      expect(themed.title).toBe("Test Dashboard");
      expect(themed.widgets).toEqual(dashboardConfig.widgets);
    });

    it("should use default theme if theme not found", () => {
      const dashboardConfig = { title: "Test" };
      const themed = manager.applyTheme(dashboardConfig, "non-existent");
      expect(themed.theme).toBe("dark-high-contrast");
    });
  });
});
