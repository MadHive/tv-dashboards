import { describe, test } from 'bun:test';

// Wave 0 stubs for METR-01
// These tests will be filled in by Plan 03-04 (Metric Browser Sources)

describe('Metric Browser Sources', () => {
  describe('source tab visibility', () => {
    test.todo('always includes GCP tab even when disconnected');
    test.todo('includes BigQuery tab when isConnected is true');
    test.todo('excludes VulnTrack tab when isConnected is false');
  });

  describe('BigQuery static manifest', () => {
    test.todo('manifest contains known mad-data tables');
    test.todo('manifest entries have name and description');
  });
});
