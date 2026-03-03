// tests/unit/env-writer.test.js
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const TMP_ENV = join(import.meta.dir, '__test__.env');

import { updateEnvVars } from '../../server/env-writer.js';

const INITIAL = `# Dashboard
PORT=3000
DATADOG_API_KEY=
DATADOG_APP_KEY=old_app_key
DD_SITE=datadoghq.com
SESSION_SECRET=abc123
`;

beforeEach(() => writeFileSync(TMP_ENV, INITIAL, 'utf8'));
afterEach(() => { try { unlinkSync(TMP_ENV); } catch {} });

describe('updateEnvVars', () => {
  it('updates an existing key in-place', () => {
    updateEnvVars({ DATADOG_API_KEY: 'new_api_key' }, TMP_ENV);
    const content = readFileSync(TMP_ENV, 'utf8');
    expect(content).toContain('DATADOG_API_KEY=new_api_key');
  });

  it('preserves surrounding keys untouched', () => {
    updateEnvVars({ DATADOG_API_KEY: 'x' }, TMP_ENV);
    const content = readFileSync(TMP_ENV, 'utf8');
    expect(content).toContain('SESSION_SECRET=abc123');
    expect(content).toContain('DD_SITE=datadoghq.com');
    expect(content).toContain('PORT=3000');
  });

  it('updates multiple keys in one call', () => {
    updateEnvVars({ DATADOG_API_KEY: 'k1', DATADOG_APP_KEY: 'k2' }, TMP_ENV);
    const content = readFileSync(TMP_ENV, 'utf8');
    expect(content).toContain('DATADOG_API_KEY=k1');
    expect(content).toContain('DATADOG_APP_KEY=k2');
  });

  it('appends a key that does not yet exist', () => {
    updateEnvVars({ NEW_KEY: 'hello' }, TMP_ENV);
    const content = readFileSync(TMP_ENV, 'utf8');
    expect(content).toContain('NEW_KEY=hello');
  });

  it('preserves comments and blank lines', () => {
    updateEnvVars({ DATADOG_API_KEY: 'x' }, TMP_ENV);
    const content = readFileSync(TMP_ENV, 'utf8');
    expect(content).toContain('# Dashboard');
    expect(content).toContain('PORT=3000');
  });
});
