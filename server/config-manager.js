// ===========================================================================
// Configuration Manager — Save/load/validate dashboard configurations
// ===========================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load, dump } from 'js-yaml';
import { validateConfig, validateDashboard } from './config-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config', 'dashboards.yaml');
const CONFIG_DIR = join(__dirname, '..', 'config');
const MAX_BACKUPS = 10;

/**
 * Load dashboard configuration from YAML file
 */
export function loadConfig() {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    const config = load(raw);

    // Add runtime metadata
    const LIVE = process.env.USE_REAL_DATA === 'true';
    config.dataMode = LIVE ? 'LIVE' : 'MOCK';

    return config;
  } catch (error) {
    console.error('[config-manager] Failed to load config:', error.message);
    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

/**
 * Save entire dashboard configuration to YAML file
 */
export async function saveConfig(config) {
  try {
    // Remove runtime metadata before saving
    const cleanConfig = { ...config };
    delete cleanConfig.dataMode;

    // Validate configuration
    const validation = validateConfig(cleanConfig);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Create backup before saving
    await createBackup();

    // Convert to YAML
    const yamlContent = dump(cleanConfig, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false
    });

    // Write to file
    writeFileSync(CONFIG_PATH, yamlContent, 'utf8');

    console.log('[config-manager] Configuration saved successfully');
    return { success: true };
  } catch (error) {
    console.error('[config-manager] Failed to save config:', error.message);
    throw error;
  }
}

/**
 * Update a single dashboard in the configuration
 */
export async function updateDashboard(dashboardId, dashboardData) {
  try {
    // Validate dashboard
    const validation = validateDashboard(dashboardData);
    if (validation.length > 0) {
      throw new Error(`Invalid dashboard: ${validation.join(', ')}`);
    }

    // Load current config
    const config = loadConfig();

    // Find dashboard index
    const index = config.dashboards.findIndex(d => d.id === dashboardId);

    if (index === -1) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    // Update dashboard
    config.dashboards[index] = dashboardData;

    // Save updated config
    await saveConfig(config);

    console.log('[config-manager] Dashboard updated:', dashboardId);
    return { success: true, dashboard: dashboardData };
  } catch (error) {
    console.error('[config-manager] Failed to update dashboard:', error.message);
    throw error;
  }
}

/**
 * Create a new dashboard
 */
export async function createDashboard(dashboardData) {
  try {
    // Validate dashboard
    const validation = validateDashboard(dashboardData);
    if (validation.length > 0) {
      throw new Error(`Invalid dashboard: ${validation.join(', ')}`);
    }

    // Load current config
    const config = loadConfig();

    // Check for duplicate ID
    const exists = config.dashboards.some(d => d.id === dashboardData.id);
    if (exists) {
      throw new Error(`Dashboard ID already exists: ${dashboardData.id}`);
    }

    // Add new dashboard
    config.dashboards.push(dashboardData);

    // Save updated config
    await saveConfig(config);

    console.log('[config-manager] Dashboard created:', dashboardData.id);
    return { success: true, dashboard: dashboardData };
  } catch (error) {
    console.error('[config-manager] Failed to create dashboard:', error.message);
    throw error;
  }
}

/**
 * Delete a dashboard
 */
export async function deleteDashboard(dashboardId) {
  try {
    // Load current config
    const config = loadConfig();

    // Find dashboard index
    const index = config.dashboards.findIndex(d => d.id === dashboardId);

    if (index === -1) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    // Prevent deleting last dashboard
    if (config.dashboards.length === 1) {
      throw new Error('Cannot delete the last dashboard');
    }

    // Remove dashboard
    const deleted = config.dashboards.splice(index, 1)[0];

    // Save updated config
    await saveConfig(config);

    console.log('[config-manager] Dashboard deleted:', dashboardId);
    return { success: true, deleted };
  } catch (error) {
    console.error('[config-manager] Failed to delete dashboard:', error.message);
    throw error;
  }
}

/**
 * Create a timestamped backup of the current configuration
 */
export async function createBackup() {
  try {
    if (!existsSync(CONFIG_PATH)) {
      console.warn('[config-manager] No config file to backup');
      return null;
    }

    // Read current config
    const content = readFileSync(CONFIG_PATH, 'utf8');

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = join(CONFIG_DIR, `dashboards.yaml.backup.${timestamp}`);

    // Write backup
    writeFileSync(backupPath, content, 'utf8');

    console.log('[config-manager] Backup created:', backupPath);

    // Clean up old backups
    await cleanupOldBackups();

    return backupPath;
  } catch (error) {
    console.error('[config-manager] Failed to create backup:', error.message);
    // Don't throw - backups are best-effort
    return null;
  }
}

/**
 * Delete old backups, keeping only the most recent MAX_BACKUPS
 */
async function cleanupOldBackups() {
  try {
    // List all backup files
    const files = readdirSync(CONFIG_DIR);
    const backups = files
      .filter(f => f.startsWith('dashboards.yaml.backup.'))
      .map(f => ({
        name: f,
        path: join(CONFIG_DIR, f),
        time: f.replace('dashboards.yaml.backup.', '')
      }))
      .sort((a, b) => b.time.localeCompare(a.time)); // Sort by timestamp, newest first

    // Delete old backups
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      toDelete.forEach(backup => {
        unlinkSync(backup.path);
        console.log('[config-manager] Deleted old backup:', backup.name);
      });
    }
  } catch (error) {
    console.error('[config-manager] Failed to cleanup backups:', error.message);
    // Don't throw - cleanup is best-effort
  }
}

/**
 * List available backups
 */
export function listBackups() {
  try {
    const files = readdirSync(CONFIG_DIR);
    const backups = files
      .filter(f => f.startsWith('dashboards.yaml.backup.'))
      .map(f => ({
        filename: f,
        timestamp: f.replace('dashboards.yaml.backup.', ''),
        path: join(CONFIG_DIR, f)
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return backups;
  } catch (error) {
    console.error('[config-manager] Failed to list backups:', error.message);
    return [];
  }
}

/**
 * Restore from a backup file
 */
export async function restoreBackup(backupFilename) {
  try {
    const backupPath = join(CONFIG_DIR, backupFilename);

    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupFilename}`);
    }

    // Read backup content
    const content = readFileSync(backupPath, 'utf8');
    const config = load(content);

    // Validate backup config
    const validation = validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Backup contains invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Create backup of current state before restoring
    await createBackup();

    // Restore backup
    writeFileSync(CONFIG_PATH, content, 'utf8');

    console.log('[config-manager] Restored from backup:', backupFilename);
    return { success: true, backup: backupFilename };
  } catch (error) {
    console.error('[config-manager] Failed to restore backup:', error.message);
    throw error;
  }
}
