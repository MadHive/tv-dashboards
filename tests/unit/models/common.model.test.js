import { describe, it, expect } from 'bun:test';
import { t } from 'elysia';
import { Value } from '@sinclair/typebox/value';

const ErrorSchema  = t.Object({ success: t.Literal(false), error: t.String() });
const SuccessSchema = t.Object({ success: t.Literal(true) });

describe('common models', () => {
  it('error schema validates correct shape', () => {
    expect(Value.Check(ErrorSchema, { success: false, error: 'oops' })).toBe(true);
  });
  it('error schema rejects missing error field', () => {
    expect(Value.Check(ErrorSchema, { success: false })).toBe(false);
  });
  it('success schema validates correct shape', () => {
    expect(Value.Check(SuccessSchema, { success: true })).toBe(true);
  });
});
