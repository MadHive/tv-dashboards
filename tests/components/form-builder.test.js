// tests/components/form-builder.test.js
import { describe, it, expect } from 'bun:test';

describe('FormBuilder', () => {
  it('should validate required fields', async () => {
    const { FormBuilder } = await import('../../public/js/components/form-builder.js');

    const form = new FormBuilder({
      fields: [
        { id: 'name', type: 'text', label: 'Name', required: true },
        { id: 'email', type: 'email', label: 'Email', required: true }
      ]
    });

    const result = form.validate({});
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.email).toBeDefined();
  });

  it('should validate email format', async () => {
    const { FormBuilder } = await import('../../public/js/components/form-builder.js');

    const form = new FormBuilder({
      fields: [{ id: 'email', type: 'email', label: 'Email', required: true }]
    });

    const invalid = form.validate({ email: 'notanemail' });
    expect(invalid.valid).toBe(false);

    const valid = form.validate({ email: 'test@example.com' });
    expect(valid.valid).toBe(true);
  });

  it('should accept 0 as valid for required number fields', async () => {
    const { FormBuilder } = await import('../../public/js/components/form-builder.js');

    const form = new FormBuilder({
      fields: [{ id: 'count', type: 'number', label: 'Count', required: true }]
    });

    const result = form.validate({ count: 0 });
    expect(result.valid).toBe(true);
  });

  it('should validate number min/max ranges', async () => {
    const { FormBuilder } = await import('../../public/js/components/form-builder.js');

    const form = new FormBuilder({
      fields: [{ id: 'age', type: 'number', label: 'Age', min: 18, max: 65 }]
    });

    const tooLow = form.validate({ age: 17 });
    expect(tooLow.valid).toBe(false);
    expect(tooLow.errors.age).toContain('at least 18');

    const tooHigh = form.validate({ age: 66 });
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.errors.age).toContain('at most 65');

    const valid = form.validate({ age: 25 });
    expect(valid.valid).toBe(true);
  });

  it('should trim whitespace from string inputs', async () => {
    const { FormBuilder } = await import('../../public/js/components/form-builder.js');

    const form = new FormBuilder({
      fields: [{ id: 'name', type: 'text', label: 'Name', required: true }]
    });

    const whitespace = form.validate({ name: '   ' });
    expect(whitespace.valid).toBe(false);
  });
});
