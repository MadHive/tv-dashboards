// ---------------------------------------------------------------------------
// Drizzle ORM Schema — Table definitions matching existing SQLite schema
// ---------------------------------------------------------------------------

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const dataSourceConfigs = sqliteTable('data_source_configs', {
  sourceName: text('source_name').primaryKey(),
  enabled:    integer('enabled', { mode: 'boolean' }).default(true),
  configJson: text('config_json'),
  updatedAt:  text('updated_at'),
  updatedBy:  text('updated_by'),
});

export const configAuditLog = sqliteTable('config_audit_log', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  sourceName:  text('source_name'),
  action:      text('action'),
  changesJson: text('changes_json'),
  userEmail:   text('user_email'),
  timestamp:   text('timestamp'),
}, (table) => [
  index('idx_audit_timestamp').on(table.timestamp),
  index('idx_audit_source').on(table.sourceName),
]);

export const dataSourceConfigsRelations = relations(dataSourceConfigs, ({ many }) => ({
  auditLogs: many(configAuditLog),
}));

export const configAuditLogRelations = relations(configAuditLog, ({ one }) => ({
  dataSource: one(dataSourceConfigs, {
    fields: [configAuditLog.sourceName],
    references: [dataSourceConfigs.sourceName],
  }),
}));
