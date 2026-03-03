// server/env-writer.js
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');

/**
 * Update specific keys in a .env file without touching anything else.
 * Existing keys are updated in-place; missing keys are appended at the end.
 *
 * @param {Record<string, string>} updates - key → new value pairs
 * @param {string} [envPath] - path to .env file (defaults to project root .env)
 */
export function updateEnvVars(updates, envPath = DEFAULT_ENV_PATH) {
  const content = readFileSync(envPath, 'utf8');
  const lines   = content.split('\n');
  const pending = new Set(Object.keys(updates));

  const updated = lines.map(line => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && pending.has(match[1])) {
      pending.delete(match[1]);
      return match[1] + '=' + updates[match[1]];
    }
    return line;
  });

  for (const key of pending) {
    updated.push(key + '=' + updates[key]);
  }

  writeFileSync(envPath, updated.join('\n'), 'utf8');
}
