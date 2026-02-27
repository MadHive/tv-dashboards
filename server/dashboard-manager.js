import { readFile } from 'fs/promises';
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
}
