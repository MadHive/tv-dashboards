# Query Test Endpoint

## Overview

The `POST /api/queries/:source/test` endpoint allows you to test query execution against data sources without saving the query. This is useful for validating query syntax, checking results, and debugging before committing to a saved query.

## Endpoint

```
POST /api/queries/:source/test
```

## Supported Data Sources

- `bigquery` - Google BigQuery SQL queries
- `gcp` - Google Cloud Platform monitoring metrics
- `aws` - AWS CloudWatch metrics
- `mock` - Mock data source (always returns sample data)
- Other sources return validation message (not yet implemented)

## Request Format

### BigQuery

```json
{
  "sql": "SELECT 1 as test_value",
  "params": {}
}
```

**Required Fields:**
- `sql` - SQL query string

**Optional Fields:**
- `params` - Query parameters object

**Notes:**
- LIMIT clause is automatically added if not present (default LIMIT 10)
- Results are capped at 50 rows maximum
- Query is executed without cache

### GCP Monitoring

```json
{
  "metricType": "run.googleapis.com/request_count",
  "project": "mad-master",
  "timeWindow": 10,
  "aggregation": {
    "alignmentPeriod": { "seconds": 60 },
    "perSeriesAligner": "ALIGN_RATE",
    "crossSeriesReducer": "REDUCE_SUM"
  },
  "filters": {
    "resource.type": "cloud_run_revision"
  }
}
```

**Required Fields:**
- `metricType` - GCP metric type (e.g., `run.googleapis.com/request_count`)

**Optional Fields:**
- `project` - GCP project ID (default: `mad-master`)
- `timeWindow` - Time window in minutes (default: 10)
- `aggregation` - Aggregation configuration object
- `filters` - Filter object or string

**Notes:**
- Results are limited to 10 time series maximum
- Filters can be an object (converted to string) or a filter string

### AWS CloudWatch

```json
{
  "metricName": "CPUUtilization",
  "namespace": "AWS/EC2",
  "dimensions": [
    { "Name": "InstanceId", "Value": "i-1234567890abcdef0" }
  ],
  "statistic": "Average",
  "period": 300
}
```

**Required Fields:**
- `metricName` - CloudWatch metric name
- `namespace` - CloudWatch namespace

**Optional Fields:**
- `dimensions` - Array of dimension objects
- `statistic` - Statistic type (default: `Average`)
- `period` - Period in seconds (default: 300)

## Response Format

### Success Response

```json
{
  "success": true,
  "source": "bigquery",
  "results": [...],
  "rowCount": 3,
  "executionTime": 1234,
  "message": "Query executed successfully in 1234ms"
}
```

### Error Response

```json
{
  "success": false,
  "source": "bigquery",
  "error": "Table not found: dataset.table",
  "executionTime": 234
}
```

### Validation Error (400)

```json
{
  "success": false,
  "error": "BigQuery test queries require sql field"
}
```

## Example Usage

### cURL

```bash
# Test BigQuery query
curl -X POST http://tv.madhive.dev/api/queries/bigquery/test \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT COUNT(*) as total FROM `mad-data.dataset.table`"
  }'

# Test GCP monitoring query
curl -X POST http://tv.madhive.dev/api/queries/gcp/test \
  -H "Content-Type: application/json" \
  -d '{
    "metricType": "run.googleapis.com/request_count",
    "project": "mad-master",
    "timeWindow": 5
  }'
```

### JavaScript

```javascript
// Test BigQuery query
const response = await fetch('/api/queries/bigquery/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sql: 'SELECT COUNT(*) as total FROM `project.dataset.table`'
  })
});

const result = await response.json();
if (result.success) {
  console.log(`Query returned ${result.rowCount} rows in ${result.executionTime}ms`);
  console.log('Results:', result.results);
} else {
  console.error('Query failed:', result.error);
}
```

## Safety Features

1. **Row Limiting**
   - BigQuery: Automatic LIMIT 10 if not specified, max 50 rows returned
   - GCP: Max 10 time series returned

2. **No Caching**
   - Test queries bypass cache to ensure fresh results

3. **Error Handling**
   - SQL errors are caught and returned in response
   - Validation errors return 400 status
   - All errors include execution time for debugging

4. **Validation**
   - Required fields are validated before execution
   - Source-specific field requirements enforced

## Use Cases

1. **Query Development**
   - Test SQL syntax before saving
   - Verify query returns expected results
   - Check execution time

2. **Debugging**
   - Troubleshoot saved queries
   - Test filter combinations
   - Validate data transformations

3. **Data Exploration**
   - Explore tables and schemas
   - Test different aggregations
   - Preview metric data

## Notes

- Test queries do NOT save to `queries.yaml`
- Results are for preview only, not cached
- Consider execution costs for BigQuery queries
- GCP monitoring queries are subject to API quotas
