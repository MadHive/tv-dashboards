# Looker Data Source

Integration with Looker API 4.0 for business intelligence dashboards, reports, and analytics metrics.

## Overview

The Looker data source provides access to:
- Dashboards and dashboard tiles
- Saved Looks (saved queries)
- Running queries and query performance
- Scheduled delivery plans
- Active users and user analytics
- LookML models and metadata
- Query cache statistics

## Authentication

Looker uses OAuth 2.0 Resource Owner Password Credentials Grant with API client credentials.

### Required Environment Variables

```bash
# Required
LOOKER_BASE_URL=https://yourinstance.looker.com:19999
LOOKER_CLIENT_ID=your_api_client_id
LOOKER_CLIENT_SECRET=your_api_client_secret
```

### Creating API Credentials

1. Navigate to **Admin** > **Users** in your Looker instance
2. Click on your user account
3. Click **Edit Keys** in the API Keys section
4. Click **New API Key** or **Edit** on an existing key
5. Copy the **Client ID** and **Client Secret** to a secure location

**Note:** API credentials are tied to user accounts and inherit that user's permissions. Use a service account for production deployments.

## Authentication Flow

The data source automatically handles:
- Initial authentication via POST /api/4.0/login
- Access token storage and management
- Token refresh when expired (tokens expire after 1 hour)
- Authorization header formatting: `Authorization: token {access_token}`

## Available Metrics

### 1. Total Dashboards (`dashboard_count`)

Number of Looker dashboards in the instance.

**Configuration:**
```javascript
{
  metric: 'dashboards',
  type: 'big-number' // or 'stat-card', 'gauge'
}
```

**Supported Widgets:** big-number, stat-card, gauge

### 2. Total Looks (`look_count`)

Number of saved Looks (saved queries) in the instance.

**Configuration:**
```javascript
{
  metric: 'looks',
  type: 'big-number' // or 'stat-card', 'gauge'
}
```

**Supported Widgets:** big-number, stat-card, gauge

### 3. Active Queries (`running_queries_count`)

Number of currently executing queries.

**Configuration:**
```javascript
{
  metric: 'running_queries',
  type: 'gauge' // or 'big-number', 'stat-card', 'gauge-row'
}
```

**Supported Widgets:** big-number, stat-card, gauge, gauge-row

### 4. Scheduled Reports (`scheduled_plans_count`)

Number of scheduled delivery plans.

**Configuration:**
```javascript
{
  metric: 'scheduled_plans',
  type: 'big-number' // or 'stat-card'
}
```

**Supported Widgets:** big-number, stat-card

### 5. Active Users (`active_users`)

Number of active Looker users.

**Configuration:**
```javascript
{
  metric: 'users',
  type: 'big-number' // or 'stat-card', 'gauge'
}
```

**Supported Widgets:** big-number, stat-card, gauge

### 6. LookML Models (`model_count`)

Number of LookML models defined in the instance.

**Configuration:**
```javascript
{
  metric: 'models',
  type: 'big-number' // or 'stat-card', 'bar-chart'
}
```

**Supported Widgets:** big-number, stat-card, bar-chart

### 7. Dashboard Usage (`dashboard_usage`)

Dashboard usage statistics grouped by folder.

**Configuration:**
```javascript
{
  metric: 'dashboards',
  type: 'bar-chart' // or 'status-grid'
}
```

**Supported Widgets:** bar-chart, status-grid

### 8. Look Usage (`look_usage`)

Saved Look usage statistics.

**Configuration:**
```javascript
{
  metric: 'looks',
  type: 'bar-chart' // or 'status-grid'
}
```

**Supported Widgets:** bar-chart, status-grid

### 9. Query Performance (`query_performance`)

Active query performance metrics.

**Configuration:**
```javascript
{
  metric: 'running_queries',
  type: 'gauge' // or 'line-chart', 'status-grid'
}
```

**Supported Widgets:** gauge, line-chart, status-grid

### 10. Cache Statistics (`cache_stats`)

Query cache hit/miss statistics.

**Configuration:**
```javascript
{
  metric: 'query_stats',
  type: 'gauge' // or 'gauge-row', 'big-number'
}
```

**Supported Widgets:** gauge, gauge-row, big-number

## Running Queries

Execute saved queries and display results in widgets.

**Configuration:**
```javascript
{
  metric: 'queries',
  queryId: '123', // Required: Query ID to execute
  resultFormat: 'json', // Optional: 'json', 'csv', 'txt', etc.
  type: 'bar-chart' // or 'line-chart', 'table', 'big-number'
}
```

**Supported Result Formats:** json, csv, txt, html, md, sql

## Fetching Specific Resources

### Get Specific Dashboard

```javascript
{
  metric: 'dashboards',
  dashboardId: '456', // Dashboard ID
  type: 'big-number'
}
```

### Get Specific Look

```javascript
{
  metric: 'looks',
  lookId: '789', // Look ID
  type: 'big-number'
}
```

## Configuration Example

### Dashboard Configuration (dashboards.yaml)

```yaml
widgets:
  - id: looker-dashboards
    type: big-number
    title: "Total Dashboards"
    dataSource: looker
    metric: dashboards
    position: { x: 0, y: 0, w: 3, h: 2 }

  - id: looker-active-queries
    type: gauge
    title: "Active Queries"
    dataSource: looker
    metric: running_queries
    position: { x: 3, y: 0, w: 3, h: 2 }

  - id: looker-dashboard-usage
    type: bar-chart
    title: "Dashboard Usage by Folder"
    dataSource: looker
    metric: dashboards
    position: { x: 6, y: 0, w: 6, h: 4 }

  - id: looker-looks
    type: status-grid
    title: "Saved Looks"
    dataSource: looker
    metric: looks
    position: { x: 0, y: 2, w: 6, h: 4 }

  - id: looker-query-results
    type: table
    title: "Sales by Region"
    dataSource: looker
    metric: queries
    queryId: "123"
    resultFormat: json
    position: { x: 0, y: 6, w: 12, h: 4 }
```

## API Endpoints Used

The Looker data source uses the following Looker API 4.0 endpoints:

- `POST /api/4.0/login` - Authentication
- `GET /api/4.0/user` - Current user info (connection test)
- `GET /api/4.0/dashboards` - List dashboards
- `GET /api/4.0/dashboards/{id}` - Get specific dashboard
- `GET /api/4.0/looks` - List saved Looks
- `GET /api/4.0/looks/{id}` - Get specific Look
- `GET /api/4.0/queries` - List queries
- `GET /api/4.0/queries/{id}/run/{format}` - Execute query
- `GET /api/4.0/running_queries` - List active queries
- `GET /api/4.0/query_tasks` - List query tasks
- `GET /api/4.0/scheduled_plans` - List scheduled plans
- `GET /api/4.0/users` - List users
- `GET /api/4.0/lookml_models` - List LookML models

## API Version

This integration uses **Looker API 4.0**, which became generally available in Looker 22.4.

The base URL includes the version number:
```
https://yourinstance.looker.com:19999/api/4.0/
```

## Caching

The data source automatically:
- Caches API responses for 5 minutes
- Reduces API load and improves performance
- Uses cache key based on metric type and parameters
- Returns `cached: true` flag in response when serving from cache

## Token Management

Access tokens:
- Expire after 1 hour (3600 seconds)
- Are automatically refreshed when expired or within 60 seconds of expiry
- Are managed transparently by the data source
- Do not require manual intervention

## Error Handling

The data source handles various error scenarios:

1. **Missing credentials:** Falls back to mock data
2. **Authentication errors:** Logs error and retries on next request
3. **API errors:** Returns error state with fallback data
4. **Network failures:** Falls back to mock data
5. **Token expiry:** Automatically re-authenticates

## Mock Data

When Looker credentials are not configured, the data source provides realistic mock data for development and testing:

- Dashboards: ~10-60 dashboards across departments
- Looks: ~10-60 saved queries
- Active queries: ~5-25 running queries
- Scheduled plans: Sample scheduled reports
- Users: Sample active user count
- Status indicators for dashboard health

## Testing

Run the Looker data source tests:

```bash
bun test tests/unit/data-sources/looker.test.js
```

The test suite covers:
- Constructor and initialization
- OAuth 2.0 authentication flow
- Token refresh and expiry handling
- API request formatting with Bearer token
- Metric fetching for all metric types
- Query execution
- Data transformation for all widget types
- Caching behavior
- Error handling and fallbacks
- Mock data generation

## Permissions

API credentials inherit permissions from the associated user account. Ensure the API user has:

- **View** access to dashboards, Looks, and models you want to monitor
- **See User Details** permission for user metrics
- **See Queries** permission for query monitoring
- **See Schedules** permission for scheduled plan metrics
- **See LookML** permission for model metrics

## Security Best Practices

1. **Credential Storage:** Never commit API credentials to version control
2. **Service Account:** Use a dedicated service account for API access
3. **Least Privilege:** Grant only necessary permissions to the API user
4. **Token Security:** Access tokens are stored in memory only, never persisted
5. **HTTPS Only:** Always use HTTPS for the Looker base URL
6. **Credential Rotation:** Regularly rotate API keys

## Port Configuration

Looker API typically runs on port **19999** (default API port).

If your instance uses a different port, update the base URL:
```bash
LOOKER_BASE_URL=https://yourinstance.looker.com:custom_port
```

## Limitations

1. **API Rate Limits:** Looker has API rate limits that vary by instance type and configuration. The 5-minute cache helps mitigate this.

2. **Query Execution Time:** Long-running queries may timeout. Consider using async query execution for complex queries.

3. **Data Freshness:** Cached data is up to 5 minutes old. Adjust cache TTL if needed.

4. **Historical Metrics:** This implementation provides current state metrics. For historical analytics, consider using Looker's System Activity explores.

5. **Permissions:** Metrics are limited to what the API user can access based on their permissions.

## Advanced Usage

### Custom Query Execution

Execute custom Looker queries and display results:

```javascript
// Create a query via API or UI, get the query ID
{
  metric: 'queries',
  queryId: 'abc123',
  resultFormat: 'json',
  type: 'table'
}
```

### Dashboard Metadata

Fetch detailed dashboard information:

```javascript
{
  metric: 'dashboards',
  dashboardId: 'dashboard_id',
  type: 'big-number'
}
```

### Running Query Monitoring

Monitor active queries for performance analysis:

```javascript
{
  metric: 'running_queries',
  type: 'status-grid' // Shows query status, runtime, and user
}
```

## Troubleshooting

### Authentication Failures

**Symptom:** "Looker authentication failed: 401 Unauthorized"

**Solutions:**
- Verify LOOKER_CLIENT_ID and LOOKER_CLIENT_SECRET are correct
- Ensure API key is not disabled or expired
- Check user account has necessary permissions
- Confirm base URL is correct (including port 19999)

### Connection Timeouts

**Symptom:** Requests timeout or fail intermittently

**Solutions:**
- Verify Looker instance is accessible from the server
- Check firewall rules allow outbound connections to port 19999
- Ensure LOOKER_BASE_URL uses HTTPS
- Verify network connectivity

### Empty or Missing Data

**Symptom:** Widgets show no data or empty values

**Solutions:**
- Check API user has View permissions for the resources
- Verify the resource (dashboard, look, etc.) exists
- Review Looker logs for access denied errors
- Ensure metric type matches available data

### Token Expiry Issues

**Symptom:** "Token expired" errors

**Solutions:**
- The data source should auto-refresh - check logs for authentication errors
- Verify LOOKER_CLIENT_SECRET is correct
- Ensure system clock is synchronized (NTP)

## Resources

- [Looker API Documentation](https://cloud.google.com/looker/docs/reference/looker-api/latest)
- [Looker API 4.0 Overview](https://cloud.google.com/looker/docs/api-overview)
- [Authentication Guide](https://cloud.google.com/looker/docs/api-auth)
- [Login Endpoint](https://cloud.google.com/looker/docs/reference/looker-api/4.0/25.20/methods/ApiAuth/login)
- [Run Query Endpoint](https://cloud.google.com/looker/docs/reference/looker-api/latest/methods/Query/run_query)
- [Dashboards API](https://cloud.google.com/looker/docs/reference/looker-api/latest/methods/Dashboard/dashboard)

## Support

For issues or questions:
1. Check the [Looker API documentation](https://cloud.google.com/looker/docs/reference/looker-api/latest)
2. Verify your API credentials have the correct permissions
3. Ensure you're using API 4.0 (Looker 22.4+)
4. Review the test suite for implementation examples
5. Check Looker's System Activity explores for API usage insights
