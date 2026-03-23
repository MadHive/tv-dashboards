import { describe, test, expect } from 'bun:test';

// Mirror of clipboard logic from studio.js -- pure functions, no DOM
function deepCopyWidgets(widgets) {
  return widgets.map(w => JSON.parse(JSON.stringify(w)));
}

function regenerateId(widget) {
  return widget.type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
}

function prepareForPaste(clipboardWidgets) {
  return clipboardWidgets.map(w => {
    const clone = JSON.parse(JSON.stringify(w));
    clone.id = regenerateId(clone);
    return clone;
  });
}

describe('Clipboard deep copy', () => {
  test('produces independent objects -- mutating copy does not affect original', () => {
    const original = [{ id: 'big-number-1', type: 'big-number', title: 'Test', position: { col: 0, row: 0, colSpan: 1, rowSpan: 1 } }];
    const copy = deepCopyWidgets(original);
    copy[0].title = 'Modified';
    copy[0].position.col = 5;
    expect(original[0].title).toBe('Test');
    expect(original[0].position.col).toBe(0);
  });

  test('preserves all widget fields in copy', () => {
    const widget = { id: 'gauge-1', type: 'gauge', title: 'CPU', source: 'gcp', queryId: 'k8s-cpu', position: { col: 2, row: 1, colSpan: 2, rowSpan: 1 } };
    const copy = deepCopyWidgets([widget]);
    expect(copy[0].type).toBe('gauge');
    expect(copy[0].title).toBe('CPU');
    expect(copy[0].source).toBe('gcp');
    expect(copy[0].queryId).toBe('k8s-cpu');
    expect(copy[0].position.col).toBe(2);
    expect(copy[0].position.colSpan).toBe(2);
  });

  test('empty input produces empty output', () => {
    expect(deepCopyWidgets([])).toEqual([]);
  });
});

describe('Widget ID regeneration', () => {
  test('pasted widget gets a new unique ID', () => {
    const widget = { id: 'big-number-old', type: 'big-number', title: 'Test', position: { col: 0, row: 0, colSpan: 1, rowSpan: 1 } };
    const pasted = prepareForPaste([widget]);
    expect(pasted[0].id).not.toBe('big-number-old');
    expect(pasted[0].id).toMatch(/^big-number-/);
  });

  test('two pastes produce different IDs', () => {
    const widget = { id: 'gauge-1', type: 'gauge', title: 'T', position: { col: 0, row: 0, colSpan: 1, rowSpan: 1 } };
    const paste1 = prepareForPaste([widget]);
    const paste2 = prepareForPaste([widget]);
    expect(paste1[0].id).not.toBe(paste2[0].id);
  });

  test('ID follows type-timestamp-random pattern', () => {
    const widget = { id: 'sparkline-x', type: 'sparkline', title: 'T', position: { col: 0, row: 0, colSpan: 1, rowSpan: 1 } };
    const pasted = prepareForPaste([widget]);
    expect(pasted[0].id).toMatch(/^sparkline-\d+-[a-z0-9]+$/);
  });

  test('original fields preserved after ID regeneration', () => {
    const widget = { id: 'bar-chart-1', type: 'bar-chart', title: 'Revenue', source: 'bigquery', position: { col: 1, row: 0, colSpan: 3, rowSpan: 2 } };
    const pasted = prepareForPaste([widget]);
    expect(pasted[0].type).toBe('bar-chart');
    expect(pasted[0].title).toBe('Revenue');
    expect(pasted[0].source).toBe('bigquery');
    expect(pasted[0].position.col).toBe(1);
  });
});
