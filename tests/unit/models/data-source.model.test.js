import { describe, it, expect } from 'bun:test';
import { Value } from '@sinclair/typebox/value';
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox';
import { dataSourceConfigs } from '../../../server/db/schema.js';

const InsertSchema = createInsertSchema(dataSourceConfigs);
const SelectSchema = createSelectSchema(dataSourceConfigs);

describe('data-source models', () => {
  it('insert schema accepts valid config row', () => {
    expect(Value.Check(InsertSchema, {
      sourceName: 'gcp', enabled: true,
      configJson: '{}', updatedAt: new Date().toISOString(), updatedBy: 'test',
    })).toBe(true);
  });
  it('insert schema rejects row with missing sourceName', () => {
    expect(Value.Check(InsertSchema, { enabled: true })).toBe(false);
  });
  it('select schema is defined and has sourceName property', () => {
    expect(SelectSchema).toBeDefined();
    expect(SelectSchema.properties).toHaveProperty('sourceName');
  });
});
