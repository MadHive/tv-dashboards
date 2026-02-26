// ===========================================================================
// BigQuery API Routes — Query management and execution
// ===========================================================================

import { Elysia, t } from 'elysia';
import { bigQueryDataSource } from './data-sources/bigquery.js';

/**
 * BigQuery routes for query management
 * Following VulnTrack/Elysia patterns
 */
export const bigQueryRoutes = new Elysia({ prefix: '/api/bigquery' })
  // List all saved queries
  .get('/queries', () => {
    try {
      const queries = bigQueryDataSource.listSavedQueries();
      return { success: true, queries };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    detail: {
      tags: ['BigQuery'],
      summary: 'List saved queries',
      description: 'Retrieve all saved BigQuery queries'
    }
  })

  // Get a specific saved query
  .get('/queries/:id', ({ params }) => {
    try {
      const query = bigQueryDataSource.getSavedQuery(params.id);
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
      tags: ['BigQuery'],
      summary: 'Get saved query',
      description: 'Retrieve a specific saved query by ID'
    }
  })

  // Save a new query
  .post('/queries', async ({ body }) => {
    try {
      const { id, name, description, sql, params, transform, widgetTypes } = body;

      if (!id || !name || !sql) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required fields: id, name, sql'
          }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      const query = bigQueryDataSource.saveQuery(id, {
        name,
        description,
        sql,
        params,
        transform,
        widgetTypes
      });

      return { success: true, query };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['BigQuery'],
      summary: 'Save query',
      description: 'Save a new BigQuery query for reuse'
    },
    body: t.Object({
      id: t.String(),
      name: t.String(),
      description: t.Optional(t.String()),
      sql: t.String(),
      params: t.Optional(t.Any()),
      transform: t.Optional(t.Any()),
      widgetTypes: t.Optional(t.Array(t.String()))
    })
  })

  // Update an existing query
  .put('/queries/:id', async ({ params, body }) => {
    try {
      const existing = bigQueryDataSource.getSavedQuery(params.id);
      if (!existing) {
        return new Response(
          JSON.stringify({ success: false, error: 'Query not found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        );
      }

      const query = bigQueryDataSource.saveQuery(params.id, {
        ...existing,
        ...body,
        updatedAt: new Date().toISOString()
      });

      return { success: true, query };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['BigQuery'],
      summary: 'Update query',
      description: 'Update an existing saved query'
    }
  })

  // Delete a query
  .delete('/queries/:id', ({ params }) => {
    try {
      const deleted = bigQueryDataSource.deleteSavedQuery(params.id);
      if (!deleted) {
        return new Response(
          JSON.stringify({ success: false, error: 'Query not found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        );
      }
      return { success: true, message: 'Query deleted' };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['BigQuery'],
      summary: 'Delete query',
      description: 'Delete a saved query'
    }
  })

  // Execute a query (test/preview)
  .post('/execute', async ({ body }) => {
    try {
      const { sql, params, useCache } = body;

      if (!sql) {
        return new Response(
          JSON.stringify({ success: false, error: 'SQL query required' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      const rows = await bigQueryDataSource.executeQuery(
        sql,
        params || {},
        useCache !== false
      );

      return {
        success: true,
        rows,
        rowCount: rows.length
      };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['BigQuery'],
      summary: 'Execute query',
      description: 'Execute a BigQuery SQL query (for testing/preview)'
    },
    body: t.Object({
      sql: t.String(),
      params: t.Optional(t.Any()),
      useCache: t.Optional(t.Boolean())
    })
  })

  // Validate query syntax
  .post('/validate', async ({ body }) => {
    try {
      const { sql } = body;

      if (!sql) {
        return new Response(
          JSON.stringify({ success: false, error: 'SQL query required' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      const validation = await bigQueryDataSource.validateQuery(sql);

      return {
        success: true,
        ...validation
      };
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  }, {
    detail: {
      tags: ['BigQuery'],
      summary: 'Validate query',
      description: 'Validate SQL syntax and estimate query cost'
    },
    body: t.Object({
      sql: t.String()
    })
  })

  // List datasets
  .get('/datasets', async () => {
    try {
      const datasets = await bigQueryDataSource.listDatasets();
      return { success: true, datasets };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    detail: {
      tags: ['BigQuery'],
      summary: 'List datasets',
      description: 'List all BigQuery datasets in the project'
    }
  })

  // List tables in a dataset
  .get('/datasets/:datasetId/tables', async ({ params }) => {
    try {
      const tables = await bigQueryDataSource.listTables(params.datasetId);
      return { success: true, tables };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    detail: {
      tags: ['BigQuery'],
      summary: 'List tables',
      description: 'List all tables in a dataset'
    }
  })

  // Get table schema
  .get('/datasets/:datasetId/tables/:tableId/schema', async ({ params }) => {
    try {
      const schema = await bigQueryDataSource.getTableSchema(
        params.datasetId,
        params.tableId
      );

      if (!schema) {
        return new Response(
          JSON.stringify({ success: false, error: 'Table not found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        );
      }

      return { success: true, schema };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    detail: {
      tags: ['BigQuery'],
      summary: 'Get table schema',
      description: 'Get schema for a specific table'
    }
  })

  // Test connection
  .get('/test-connection', async () => {
    try {
      const connected = await bigQueryDataSource.testConnection();
      return {
        success: true,
        connected,
        projectId: bigQueryDataSource.projectId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    detail: {
      tags: ['BigQuery'],
      summary: 'Test connection',
      description: 'Test BigQuery connection'
    }
  });
