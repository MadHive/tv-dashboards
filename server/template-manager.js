// ===========================================================================
// Template Manager — Dashboard template storage and retrieval
// ===========================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dump, load } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'config', 'templates');

/**
 * Save dashboard as template
 */
export async function saveTemplate(templateName, dashboardConfig, metadata = {}) {
  try {
    const template = {
      name: templateName,
      description: metadata.description || '',
      category: metadata.category || 'Custom',
      author: metadata.author || 'User',
      createdAt: new Date().toISOString(),
      dashboard: dashboardConfig
    };

    // Sanitize template name for filename
    const filename = templateName.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '.yaml';
    const filepath = join(TEMPLATES_DIR, filename);

    // Convert to YAML
    const yamlContent = dump(template, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false
    });

    // Write to file
    writeFileSync(filepath, yamlContent, 'utf8');

    console.log('[template-manager] Template saved:', filename);
    return { success: true, filename, template };
  } catch (error) {
    console.error('[template-manager] Failed to save template:', error.message);
    throw error;
  }
}

/**
 * List all available templates
 */
export function listTemplates() {
  try {
    if (!existsSync(TEMPLATES_DIR)) {
      return [];
    }

    const files = readdirSync(TEMPLATES_DIR);
    const templates = files
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(filename => {
        try {
          const filepath = join(TEMPLATES_DIR, filename);
          const content = readFileSync(filepath, 'utf8');
          const template = load(content);

          return {
            filename,
            name: template.name,
            description: template.description,
            category: template.category,
            author: template.author,
            createdAt: template.createdAt
          };
        } catch (err) {
          console.warn('[template-manager] Failed to load template:', filename, err.message);
          return null;
        }
      })
      .filter(Boolean);

    return templates;
  } catch (error) {
    console.error('[template-manager] Failed to list templates:', error.message);
    return [];
  }
}

/**
 * Load template by filename
 */
export function loadTemplate(filename) {
  try {
    const filepath = join(TEMPLATES_DIR, filename);

    if (!existsSync(filepath)) {
      throw new Error(`Template not found: ${filename}`);
    }

    const content = readFileSync(filepath, 'utf8');
    const template = load(content);

    console.log('[template-manager] Template loaded:', filename);
    return template;
  } catch (error) {
    console.error('[template-manager] Failed to load template:', error.message);
    throw error;
  }
}

/**
 * Delete template
 */
export function deleteTemplate(filename) {
  try {
    const filepath = join(TEMPLATES_DIR, filename);

    if (!existsSync(filepath)) {
      throw new Error(`Template not found: ${filename}`);
    }

    unlinkSync(filepath);

    console.log('[template-manager] Template deleted:', filename);
    return { success: true, filename };
  } catch (error) {
    console.error('[template-manager] Failed to delete template:', error.message);
    throw error;
  }
}

/**
 * Export dashboard configuration as JSON
 */
export function exportDashboard(dashboardConfig) {
  try {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      dashboard: dashboardConfig
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('[template-manager] Failed to export dashboard:', error.message);
    throw error;
  }
}

/**
 * Import dashboard configuration from JSON
 */
export function importDashboard(jsonString) {
  try {
    const importData = JSON.parse(jsonString);

    if (!importData.dashboard) {
      throw new Error('Invalid import format: missing dashboard field');
    }

    console.log('[template-manager] Dashboard imported successfully');
    return importData.dashboard;
  } catch (error) {
    console.error('[template-manager] Failed to import dashboard:', error.message);
    throw error;
  }
}
