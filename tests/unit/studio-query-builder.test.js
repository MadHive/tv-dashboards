import { describe, test } from 'bun:test';

// Wave 0 stubs for QRYX-01 and QRYX-02
// These tests will be filled in by Plan 03-02 (Query Builder)

describe('Query Builder', () => {
  describe('widget-scoped flow', () => {
    test.todo('stores _assignTargetWidgetId when opened from widget properties');
    test.todo('openQueryEditor populates source and metric fields from widget config');
  });

  describe('result format selection', () => {
    test.todo('selectResultFormat returns "table" for array-of-objects data');
    test.todo('selectResultFormat returns "json" for raw non-array data');
    test.todo('selectResultFormat returns "summary" for time-series data');
  });

  describe('assign to widget', () => {
    test.todo('_assignQueryToWidgetDirect sets queryId and source on target widget');
    test.todo('_assignQueryToWidgetDirect calls markDirty and renderCanvas');
  });
});
