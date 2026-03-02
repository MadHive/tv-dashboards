// ===========================================================================
// Query API Routes — Universal query management for all data sources
// ===========================================================================

import { Elysia, t } from 'elysia';
import {
  listAllQueries,
  listQueries,
  getQuery,
  saveQuery,
  deleteQuery,
  listBackups,
  restoreBackup
} from './query-manager.js';
import { dataSourceRegistry } from './data-source-registry.js';

/**
 * Universal query routes for all data sources
 * Supports: bigquery, gcp, aws, datadog, elasticsearch, etc.
 */
export const queryRoutes = new Elysia({ prefix: '/api/queries' })
  // List all queries (all sources)
  .get('/', async () => {
    try {
      const queries = await listAllQueries();
      return { success: true, queries };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    detail: {
      tags: ['Queries'],
      summary: 'List all queries',
      description: 'Retrieve all saved queries grouped by data source'
    }
  })

  // List queries for a specific data source
  .get('/:source', async ({ params }) => {
    try {
      const queries = await listQueries(params.source);
      return { success: true, source: params.source, queries };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    detail: {
      tags: ['Queries'],
      summary: 'List queries by source',
      description: 'Retrieve all saved queries for a specific data source'
    }
  })

  // Get a specific query
  .get('/:source/:id', async ({ params }) => {
    try {
      const query = await getQuery(params.source, params.id);
      if (!query) {
        return new Response(
          JSON.stringify({ success: false, error: 'Query not found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        );
      }
      return { success: true, query };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    detail: {
      tags: ['Queries'],
      summary: 'Get specific query',
      description: 'Retrieve a specific saved query by source and ID'
    }
  })

  // Create or update a query
  .post('/:source', async ({ params, body }) => {
    try {
      const { id, name, description, sql, metricType, project, timeWindow,
              aggregation, filters, params: queryParams, transform, widgetTypes } = body;

      if (!id || !name) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required fields: id, name'
          }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      // Validate source-specific required fields
      if (params.source === 'bigquery' && !sql) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'BigQuery queries require sql field'
          }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      if (params.source === 'gcp' && !metricType) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'GCP queries require metricType field'
          }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      // Build query definition based on source
      const queryDef = {
        id,
        name,
        description,
        widgetTypes: widgetTypes || []
      };

      // Add source-specific fields
      if (params.source === 'bigquery') {
        queryDef.sql = sql;
        if (queryParams) queryDef.params = queryParams;
        if (transform) queryDef.transform = transform;
      } else if (params.source === 'gcp') {
        queryDef.metricType = metricType;
        queryDef.project = project || 'mad-master';
        if (timeWindow) queryDef.timeWindow = timeWindow;
        if (aggregation) queryDef.aggregation = aggregation;
        if (filters) queryDef.filters = filters;
      }

      const result = await saveQuery(params.source, queryDef);
      return result;
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['Queries'],
      summary: 'Create or update query',
      description: 'Save a new query or update an existing one'
    }
  })

  // Update a query (PUT)
  .put('/:source/:id', async ({ params, body }) => {
    try {
      // Check if query exists
      const existing = await getQuery(params.source, params.id);
      if (!existing) {
        return new Response(
          JSON.stringify({ success: false, error: 'Query not found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        );
      }

      // Merge with existing data
      const queryDef = {
        ...existing,
        ...body,
        id: params.id // Ensure ID doesn't change
      };

      const result = await saveQuery(params.source, queryDef);
      return result;
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['Queries'],
      summary: 'Update query',
      description: 'Update an existing query'
    }
  })

  // Delete a query
  .delete('/:source/:id', async ({ params }) => {
    try {
      const result = await deleteQuery(params.source, params.id);
      return result;
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['Queries'],
      summary: 'Delete query',
      description: 'Delete a saved query'
    }
  })

  // Test query execution (dry run)
  .post('/:source/test', async ({ params, body }) => {
    const startTime = Date.now();

    try {
      const { source } = params;
      let results = null;
      let rowCount = 0;
      let error = null;

      // Execute query based on data source type
      if (source === 'bigquery') {
        // Validate required fields
        if (!body.sql) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'BigQuery test queries require sql field'
            }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }

        // Import and execute BigQuery query
        const { bigQueryDataSource } = await import('./data-sources/bigquery.js');

        // Add LIMIT to prevent large result sets
        let testSql = body.sql.trim();
        if (!testSql.toLowerCase().includes('limit')) {
          testSql += ' LIMIT 10';
        }

        try {
          const rows = await bigQueryDataSource.executeQuery(
            testSql,
            body.params || {},
            false // Don't use cache for test queries
          );

          results = rows.slice(0, 50); // Limit to 50 rows max
          rowCount = rows.length;
        } catch (err) {
          error = err.message;
        }

      } else if (source === 'gcp') {
        // Validate required fields
        if (!body.metricType) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'GCP test queries require metricType field'
            }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }

        // Import and execute GCP monitoring query
        const gcpMetrics = await import('./gcp-metrics.js');

        try {
          // Convert filters object to filter string if needed
          let filterString = null;
          if (body.filters) {
            if (typeof body.filters === 'string') {
              filterString = body.filters;
            } else if (typeof body.filters === 'object' && Object.keys(body.filters).length > 0) {
              // Convert object to filter string format
              filterString = Object.entries(body.filters)
                .map(([key, value]) => `${key} = "${value}"`)
                .join(' AND ');
            }
          }

          const timeSeries = await gcpMetrics.query(
            body.project || 'mad-master',
            body.metricType,
            filterString,
            body.timeWindow || 10,
            body.aggregation
          );

          results = timeSeries.slice(0, 10); // Limit time series results
          rowCount = timeSeries.length;
        } catch (err) {
          error = err.message;
        }

      } else if (source === 'aws') {
        // AWS CloudWatch test query
        if (!body.metricName || !body.namespace) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'AWS test queries require metricName and namespace fields'
            }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }

        try {
          const { awsDataSource } = await import('./data-sources/aws.js');
          const metrics = await awsDataSource.fetchMetrics({
            metricName: body.metricName,
            namespace: body.namespace,
            dimensions: body.dimensions || [],
            statistic: body.statistic || 'Average',
            period: body.period || 300,
            type: 'line-chart' // Default widget type for testing
          });

          results = metrics.data;
          rowCount = metrics.data?.series?.[0]?.data?.length || 0;
        } catch (err) {
          error = err.message;
        }

      } else if (source === 'mock') {
        // Mock data source - always succeeds with sample data
        results = [
          { label: 'Sample 1', value: 100 },
          { label: 'Sample 2', value: 200 },
          { label: 'Sample 3', value: 150 }
        ];
        rowCount = 3;

      } else {
        // For other data sources, return a basic success message
        // These would need implementation once the data sources are active
        return {
          success: true,
          message: `Test query validation for ${source} - data source not yet implemented`,
          source,
          query: body,
          executionTime: Date.now() - startTime
        };
      }

      const executionTime = Date.now() - startTime;

      if (error) {
        return {
          success: false,
          source,
          error,
          executionTime
        };
      }

      return {
        success: true,
        source,
        results,
        rowCount,
        executionTime,
        message: `Query executed successfully in ${executionTime}ms`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }, {
    detail: {
      tags: ['Queries'],
      summary: 'Test query',
      description: 'Test query execution without saving (dry run)'
    }
  })

  // List backups
  .get('/backups/list', async () => {
    try {
      const backups = listBackups();
      return { success: true, backups };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    detail: {
      tags: ['Queries'],
      summary: 'List backups',
      description: 'List available query backup files'
    }
  })

  // Restore from backup
  .post('/backups/restore', async ({ body }) => {
    try {
      const { filename } = body;
      if (!filename) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required field: filename'
          }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      const result = await restoreBackup(filename);
      return result;
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['Queries'],
      summary: 'Restore backup',
      description: 'Restore queries from a backup file'
    }
  });
