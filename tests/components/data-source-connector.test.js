// tests/components/data-source-connector.test.js
import { describe, it, expect } from 'bun:test';

describe('DataSourceConnector', () => {
  it('should create connector with default config', async () => {
    const { DataSourceConnector } = await import('../../public/js/components/data-source-connector.js');

    const connector = new DataSourceConnector();

    expect(connector.config.availableSources).toEqual([]);
    expect(connector.wizard).toBeNull();
  });

  it('should validate BigQuery connection requires projectId', async () => {
    const { DataSourceConnector } = await import('../../public/js/components/data-source-connector.js');

    const connector = new DataSourceConnector();

    const invalid = connector._validateConnection({
      sourceType: 'bigquery',
      name: 'My Connection'
    });
    expect(invalid).toBe(false);

    const valid = connector._validateConnection({
      sourceType: 'bigquery',
      name: 'My Connection',
      projectId: 'my-project'
    });
    expect(valid).toBe(true);
  });

  it('should validate mock connection only requires name', async () => {
    const { DataSourceConnector } = await import('../../public/js/components/data-source-connector.js');

    const connector = new DataSourceConnector();

    const valid = connector._validateConnection({
      sourceType: 'mock',
      name: 'Mock Source'
    });
    expect(valid).toBe(true);
  });
});
