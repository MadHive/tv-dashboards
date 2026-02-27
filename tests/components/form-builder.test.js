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
});
