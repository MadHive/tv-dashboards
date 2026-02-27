import { readFile, writeFile } from 'fs/promises';
import YAML from 'js-yaml';

export default class DashboardManager {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = null;
  }

  async loadConfig() {
    const content = await readFile(this.configPath, 'utf-8');
    this.config = YAML.load(content);
    return this.config;
  }

  async listDashboards() {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config.dashboards.map((dashboard, index) => ({
      id: dashboard.id,
      name: dashboard.name,
      subtitle: dashboard.subtitle,
      icon: dashboard.icon,
      widgetCount: dashboard.widgets?.length || 0,
      order: index,
      grid: dashboard.grid
    }));
  }

  async getDashboard(id) {
    if (!this.config) {
      await this.loadConfig();
    }
    const dashboard = this.config.dashboards.find(d => d.id === id);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${id}`);
    }
    return { ...dashboard };
  }

  generateId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async createDashboard(dashboardData) {
    if (!this.config) {
      await this.loadConfig();
    }

    // Generate ID if not provided
    const id = dashboardData.id || this.generateId(dashboardData.name);

    // Check for duplicate ID
    if (this.config.dashboards.some(d => d.id === id)) {
      throw new Error(`Dashboard ID already exists: ${id}`);
    }

    // Create dashboard object
    const newDashboard = {
      id,
      name: dashboardData.name,
      subtitle: dashboardData.subtitle || '',
      icon: dashboardData.icon,
      grid: dashboardData.grid,
      widgets: dashboardData.widgets || []
    };

    // Add to config
    this.config.dashboards.push(newDashboard);

    // Save to file
    await this.saveConfig();

    return { ...newDashboard };
  }

  async updateDashboard(id, updates) {
    if (!this.config) {
      await this.loadConfig();
    }

    const index = this.config.dashboards.findIndex(d => d.id === id);
    if (index === -1) {
      throw new Error(`Dashboard not found: ${id}`);
    }

    // Check for ID conflict if ID is being changed
    if (updates.id && updates.id !== id) {
      if (this.config.dashboards.some(d => d.id === updates.id)) {
        throw new Error(`Dashboard ID already exists: ${updates.id}`);
      }
    }

    // Merge updates
    this.config.dashboards[index] = {
      ...this.config.dashboards[index],
      ...updates
    };

    await this.saveConfig();

    return { ...this.config.dashboards[index] };
  }

  async deleteDashboard(id) {
    if (!this.config) {
      await this.loadConfig();
    }

    if (this.config.dashboards.length === 1) {
      throw new Error('Cannot delete the last dashboard');
    }

    const index = this.config.dashboards.findIndex(d => d.id === id);
    if (index === -1) {
      throw new Error(`Dashboard not found: ${id}`);
    }

    this.config.dashboards.splice(index, 1);
    await this.saveConfig();

    return { success: true, id };
  }

  async duplicateDashboard(id) {
    const original = await this.getDashboard(id);

    // Generate new ID
    let newId = `${id}-copy`;
    let counter = 1;
    while (this.config.dashboards.some(d => d.id === newId)) {
      counter++;
      newId = `${id}-copy-${counter}`;
    }

    // Create duplicate
    const duplicate = {
      ...original,
      id: newId,
      name: `${original.name} (Copy${counter > 1 ? ' ' + counter : ''})`,
      widgets: JSON.parse(JSON.stringify(original.widgets)) // Deep clone widgets
    };

    this.config.dashboards.push(duplicate);
    await this.saveConfig();

    return duplicate;
  }

  async saveConfig() {
    const yamlContent = YAML.dump(this.config);
    await writeFile(this.configPath, yamlContent, 'utf-8');
  }
}
