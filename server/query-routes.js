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
    try {
      // TODO: Implement test execution for each data source
      // For now, just validate the query structure
      return {
        success: true,
        message: 'Query test endpoint - implementation pending',
        source: params.source,
        query: body
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
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
