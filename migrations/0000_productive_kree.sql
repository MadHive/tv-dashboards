CREATE TABLE `config_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_name` text,
	`action` text,
	`changes_json` text,
	`user_email` text,
	`timestamp` text
);
--> statement-breakpoint
CREATE INDEX `idx_audit_timestamp` ON `config_audit_log` ("timestamp" DESC);--> statement-breakpoint
CREATE INDEX `idx_audit_source` ON `config_audit_log` (`source_name`);--> statement-breakpoint
CREATE TABLE `data_source_configs` (
	`source_name` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true,
	`config_json` text,
	`updated_at` text,
	`updated_by` text
);
