// ===========================================================================
// Backup Routes Tests — Following Elysia.js Testing Patterns
// Tests for configuration backup and restore operations
// ===========================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { createTestRequest, createJsonPostRequest } from '../../helpers/test-app.js';

describe('Backup Routes (Elysia Unit Tests)', () => {
  let app;
  let backups;

  beforeEach(() => {
    // Mock backup storage
    backups = [
      {
        filename: 'dashboards.yaml.backup.2026-02-27T10-00-00',
        timestamp: '2026-02-27T10:00:00Z',
        size: 1024
      },
      {
        filename: 'dashboards.yaml.backup.2026-02-27T11-00-00',
        timestamp: '2026-02-27T11:00:00Z',
        size: 2048
      },
      {
        filename: 'dashboards.yaml.backup.2026-02-27T12-00-00',
        timestamp: '2026-02-27T12:00:00Z',
        size: 1536
      }
    ];

    // Create test app with backup routes
    app = new Elysia()
      .get('/api/backups', () => {
        try {
          return { success: true, backups };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      })
      .post('/api/backups/restore', async ({ body }) => {
        try {
          if (!body.filename) {
            return new Response(
              JSON.stringify({ success: false, error: 'Backup filename required' }),
              { status: 400, headers: { 'content-type': 'application/json' } }
            );
          }

          const backup = backups.find(b => b.filename === body.filename);

          if (!backup) {
            return new Response(
              JSON.stringify({ success: false, error: `Backup not found: ${body.filename}` }),
              { status: 404, headers: { 'content-type': 'application/json' } }
            );
          }

          // Mock restore operation
          return {
            success: true,
            message: `Configuration restored from ${body.filename}`,
            backup
          };
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      });
  });

  describe('GET /api/backups', () => {
    it('should list all backup files', async () => {
      const request = createTestRequest('/api/backups');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.backups).toBeArray();
      expect(data.backups.length).toBe(3);
    });

    it('should include backup metadata', async () => {
      const request = createTestRequest('/api/backups');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      const backup = data.backups[0];

      expect(backup.filename).toBeDefined();
      expect(backup.timestamp).toBeDefined();
      expect(backup.size).toBeDefined();
    });

    it('should return empty array when no backups exist', async () => {
      // Clear backups
      backups = [];

      const request = createTestRequest('/api/backups');
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.backups).toBeArray();
      expect(data.backups.length).toBe(0);
    });

    it('should include timestamps in ISO format', async () => {
      const request = createTestRequest('/api/backups');
      const response = await app.handle(request);

      const data = await response.json();
      const backup = data.backups[0];

      expect(backup.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(backup.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('POST /api/backups/restore', () => {
    it('should restore valid backup file', async () => {
      const restoreRequest = {
        filename: 'dashboards.yaml.backup.2026-02-27T10-00-00'
      };

      const request = createJsonPostRequest('/api/backups/restore', restoreRequest);
      const response = await app.handle(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('restored');
      expect(data.backup).toBeDefined();
    });

    it('should return backup metadata after restore', async () => {
      const restoreRequest = {
        filename: 'dashboards.yaml.backup.2026-02-27T10-00-00'
      };

      const request = createJsonPostRequest('/api/backups/restore', restoreRequest);
      const response = await app.handle(request);

      const data = await response.json();
      expect(data.backup.filename).toBe(restoreRequest.filename);
      expect(data.backup.timestamp).toBeDefined();
      expect(data.backup.size).toBeDefined();
    });

    it('should return 400 for missing filename', async () => {
      const restoreRequest = {
        // Missing filename
      };

      const request = createJsonPostRequest('/api/backups/restore', restoreRequest);
      const response = await app.handle(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('filename required');
    });

    it('should return 404 for non-existent backup', async () => {
      const restoreRequest = {
        filename: 'dashboards.yaml.backup.nonexistent'
      };

      const request = createJsonPostRequest('/api/backups/restore', restoreRequest);
      const response = await app.handle(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Backup not found');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty filename string', async () => {
      const restoreRequest = {
        filename: ''
      };

      const request = createJsonPostRequest('/api/backups/restore', restoreRequest);
      const response = await app.handle(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle special characters in filename', async () => {
      backups.push({
        filename: 'dashboards.yaml.backup.2026-02-27T10:00:00+00:00',
        timestamp: '2026-02-27T10:00:00Z',
        size: 1024
      });

      const restoreRequest = {
        filename: 'dashboards.yaml.backup.2026-02-27T10:00:00+00:00'
      };

      const request = createJsonPostRequest('/api/backups/restore', restoreRequest);
      const response = await app.handle(request);

      // Should handle special characters
      expect(response.status).toBeLessThan(500);
    });

    it('should list backups sorted by timestamp', async () => {
      const request = createTestRequest('/api/backups');
      const response = await app.handle(request);

      const data = await response.json();

      // Check if timestamps are in order (oldest to newest or vice versa)
      const timestamps = data.backups.map(b => new Date(b.timestamp).getTime());
      const sorted = [...timestamps].sort((a, b) => a - b);
      const reverseSorted = [...timestamps].sort((a, b) => b - a);

      const isOrdered =
        JSON.stringify(timestamps) === JSON.stringify(sorted) ||
        JSON.stringify(timestamps) === JSON.stringify(reverseSorted);

      expect(isOrdered).toBe(true);
    });
  });
});
