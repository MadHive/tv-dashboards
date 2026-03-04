// ===========================================================================
// Template Manager — Dashboard template storage and retrieval
// ===========================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dump, load } from 'js-yaml';
import logger from './logger.js';

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

    logger.info({ filename }, 'Template saved');
    return { success: true, filename, template };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to save template');
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
          logger.warn({ filename, error: err.message }, 'Failed to load template');
          return null;
        }
      })
      .filter(Boolean);

    return templates;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to list templates');
    return [];
  }
}

/**
 * Load template by filename
 */
export function loadTemplate(filename) {
  try {
    // Validate filename to prevent path traversal attacks
    if (!filename || typeof filename !== 'string') {
      throw new Error('Filename is required');
    }
    if (filename.includes('..') || 
        filename.includes('/') || 
        filename.includes('\\') ||
        !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      throw new Error('Invalid filename: path traversal not allowed');
    }
    
    const filepath = join(TEMPLATES_DIR, filename);

    if (!existsSync(filepath)) {
      throw new Error(`Template not found: ${filename}`);
    }

    const content = readFileSync(filepath, 'utf8');
    const template = load(content);

    logger.info({ filename }, 'Template loaded');
    return template;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to load template');
    throw error;
  }
}

/**
 * Delete template
 */
export function deleteTemplate(filename) {
  try {
    // Validate filename to prevent path traversal attacks
    if (!filename || typeof filename !== 'string') {
      throw new Error('Filename is required');
    }
    if (filename.includes('..') || 
        filename.includes('/') || 
        filename.includes('\\') ||
        !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      throw new Error('Invalid filename: path traversal not allowed');
    }
    
    const filepath = join(TEMPLATES_DIR, filename);

    if (!existsSync(filepath)) {
      throw new Error(`Template not found: ${filename}`);
    }

    unlinkSync(filepath);

    logger.info({ filename }, 'Template deleted');
    return { success: true, filename };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to delete template');
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
    logger.error({ error: error.message }, 'Failed to export dashboard');
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

    logger.info('Dashboard imported successfully');
    return importData.dashboard;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to import dashboard');
    throw error;
  }
}
