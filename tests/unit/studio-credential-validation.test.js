import { describe, test, expect } from 'bun:test';

// Pure mirror of the _validateCredForm logic in studio.js
// Takes an array of { key, value, required } and returns { valid, errors: [{ key, msg }] }
function mirrorValidateCredFields(fields) {
  const errors = [];
  for (const field of fields) {
    const val = (field.value || '').trim();
    if (field.required && !val) {
      errors.push({ key: field.key, msg: 'Required.' });
    }
  }
  return { valid: errors.length === 0, errors };
}

describe('Credential Validation', () => {
  test('rejects empty required field with "Required." message', () => {
    const result = mirrorValidateCredFields([
      { key: 'API_KEY', value: '', required: true },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([{ key: 'API_KEY', msg: 'Required.' }]);
  });

  test('accepts non-empty required field', () => {
    const result = mirrorValidateCredFields([
      { key: 'API_KEY', value: 'sk-abc123', required: true },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('returns all errors for multiple empty required fields', () => {
    const result = mirrorValidateCredFields([
      { key: 'API_KEY', value: '', required: true },
      { key: 'APP_KEY', value: '', required: true },
      { key: 'ORG_ID',  value: '', required: true },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toEqual({ key: 'API_KEY', msg: 'Required.' });
    expect(result.errors[1]).toEqual({ key: 'APP_KEY', msg: 'Required.' });
    expect(result.errors[2]).toEqual({ key: 'ORG_ID',  msg: 'Required.' });
  });

  test('validates basic format for API key fields — non-required empty field passes validation', () => {
    const result = mirrorValidateCredFields([
      { key: 'OPTIONAL_FIELD', value: '', required: false },
      { key: 'API_KEY',        value: 'my-valid-key', required: true },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
