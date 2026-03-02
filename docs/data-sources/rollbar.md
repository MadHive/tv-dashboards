# Rollbar Data Source

Error tracking and application monitoring integration for MadHive TV Dashboards.

## Overview

The Rollbar data source provides real-time error tracking and monitoring capabilities, allowing you to visualize application errors, track error trends, and monitor error resolution metrics on your dashboards.

## Features

- Real-time error occurrence tracking
- Error severity level filtering (critical, error, warning, info, debug)
- Top active errors identification
- Error trend analysis over time
- Environment-based filtering (production, staging, etc.)
- Automatic 5-minute caching to optimize API usage
- Rate limit handling (5000 requests/hour)

## Configuration

### Environment Variables

Set the following environment variables to configure the Rollbar integration:

```bash
ROLLBAR_ACCESS_TOKEN=your_rollbar_access_token
ROLLBAR_PROJECT_ID=your_project_id  # Optional
```

### Access Token

You can use either a **project access token** or an **account access token** with `read` scope:

- **Project Access Token**: For project-level error data
- **Account Access Token**: For account-level error data across multiple projects

Get your access token from:
1. Go to Rollbar dashboard
2. Navigate to Settings → Project/Account Access Tokens
3. Create a new token with `read` scope
4. Copy the token value

### Widget Configuration

When configuring a widget to use Rollbar data, you can specify:

```yaml
source: rollbar
metricType: items          # items, top_active, or occurrence_counts
level: error               # Optional: critical, error, warning, info, debug
environment: production    # Optional: filter by environment
timeRange: 86400          # Optional: time range in seconds (default: 24 hours)
```

## Available Metrics

### 1. Total Occurrences
- **ID**: `total_occurrences`
- **Description**: Total number of error occurrences
- **Type**: Number
- **Widgets**: big-number, stat-card

### 2. Active Items
- **ID**: `active_items`
- **Description**: Number of active error items
- **Type**: Number
- **Widgets**: big-number, stat-card, alert-list

### 3. Errors by Level
- **ID**: `errors_by_level`
- **Description**: Error count breakdown by severity level
- **Type**: Distribution
- **Widgets**: bar-chart

### 4. Critical Errors
- **ID**: `critical_errors`
- **Description**: Number of critical severity errors
- **Type**: Number
- **Widgets**: big-number, gauge

### 5. Error Rate
- **ID**: `error_rate`
- **Description**: Percentage of critical errors out of total
- **Type**: Percentage
- **Widgets**: gauge, gauge-row

### 6. Top Errors
- **ID**: `top_errors`
- **Description**: Most frequent errors in last 24 hours
- **Type**: List
- **Widgets**: alert-list, bar-chart

### 7. Occurrence Trends
- **ID**: `occurrence_trends`
- **Description**: Error occurrence counts over time
- **Type**: Timeseries
- **Widgets**: line-chart, sparkline

### 8. New Items
- **ID**: `new_items`
- **Description**: Recently created error items
- **Type**: Number
- **Widgets**: big-number, stat-card

### 9. Resolved Items
- **ID**: `resolved_items`
- **Description**: Recently resolved error items
- **Type**: Number
- **Widgets**: big-number, stat-card

### 10. Mean Time to Resolution (MTTR)
- **ID**: `mttr`
- **Description**: Average time to resolve errors
- **Type**: Duration
- **Widgets**: big-number, gauge

## Widget Examples

### Example 1: Critical Errors Count

```yaml
- id: critical-errors
  type: big-number
  title: "Critical Errors"
  source: rollbar
  metricType: items
  level: critical
  environment: production
```

### Example 2: Error Severity Distribution

```yaml
- id: error-distribution
  type: bar-chart
  title: "Errors by Severity"
  source: rollbar
  metricType: items
  environment: production
```

### Example 3: Error Trends Over Time

```yaml
- id: error-trends
  type: line-chart
  title: "Error Occurrences (24h)"
  source: rollbar
  metricType: occurrence_counts
  level: error
  timeRange: 86400
```

### Example 4: Top Active Errors

```yaml
- id: top-errors
  type: alert-list
  title: "Top 10 Errors"
  source: rollbar
  metricType: top_active
  environment: production
```

### Example 5: Error Rate Gauge

```yaml
- id: error-rate
  type: gauge
  title: "Critical Error Rate"
  source: rollbar
  metricType: items
  environment: production
```

## API Endpoints Used

The Rollbar data source uses the following Rollbar API endpoints:

### 1. List Items
- **Endpoint**: `GET /api/1/items/`
- **Purpose**: Fetch active error items
- **Filters**: status, level, environment
- **Documentation**: https://docs.rollbar.com/reference/list-all-items

### 2. Top Active Items
- **Endpoint**: `GET /api/1/reports/top_active_items`
- **Purpose**: Get most frequent errors in specified time period
- **Parameters**: hours, environment
- **Documentation**: https://docs.rollbar.com/reference/get-top-active-items

### 3. Occurrence Counts
- **Endpoint**: `GET /api/1/reports/occurrence_counts`
- **Purpose**: Get error occurrence trends over time
- **Parameters**: bucket_size, start_time, end_time, level, environment
- **Documentation**: https://docs.rollbar.com/reference/get-occurrence-counts

### 4. Status Ping
- **Endpoint**: `GET /api/1/status/ping`
- **Purpose**: Test API connectivity
- **Returns**: "pong" if successful

## Rate Limiting

Rollbar API has a rate limit of **5000 requests per hour** per access token. The data source implements:

- **5-minute caching**: All metric requests are cached for 5 minutes to reduce API calls
- **Rate limit detection**: Automatically handles 429 status codes
- **Error handling**: Gracefully falls back to cached or mock data when rate limited

## Error Severity Levels

Rollbar uses the following severity levels (from highest to lowest):

1. **critical**: System is unusable, requires immediate attention
2. **error**: Error conditions that should be addressed
3. **warning**: Warning conditions that may require attention
4. **info**: Informational messages
5. **debug**: Debug-level messages

## Data Transformation

The data source automatically transforms Rollbar API responses to match widget expectations:

- **big-number/stat-card**: Shows total error count with critical/error breakdown
- **gauge**: Displays critical error rate as percentage
- **bar-chart**: Groups errors by severity level with color coding
- **alert-list**: Shows top errors with occurrence counts and timestamps
- **line-chart/sparkline**: Plots error occurrences over time

## Testing

Run the test suite:

```bash
bun test tests/unit/data-sources/rollbar.test.js
```

The test suite includes:
- Constructor and initialization tests
- API request handling and error scenarios
- Data transformation for all widget types
- Mock data generation
- Configuration validation
- Rate limit handling
- Cache behavior verification

## Troubleshooting

### No data appearing in widgets

1. **Check access token**: Verify `ROLLBAR_ACCESS_TOKEN` is set correctly
2. **Verify token scope**: Ensure token has `read` scope enabled
3. **Check project ID**: If filtering by project, verify `ROLLBAR_PROJECT_ID` is correct
4. **Review environment filter**: Make sure the environment name matches your Rollbar configuration

### Rate limit errors

If you're seeing rate limit errors:

1. **Reduce widget count**: Each widget makes API calls; reduce the number of Rollbar widgets
2. **Increase cache TTL**: Modify `CACHE_TTL` in the source code (default: 5 minutes)
3. **Use different tokens**: Distribute widgets across multiple access tokens if available

### Connection test failing

1. **Verify network access**: Ensure your server can reach `api.rollbar.com`
2. **Check firewall rules**: Verify outbound HTTPS connections are allowed
3. **Test API manually**: Use curl to test the API:

```bash
curl -H "X-Rollbar-Access-Token: YOUR_TOKEN" \
  https://api.rollbar.com/api/1/status/ping
```

## Mock Data Mode

When `ROLLBAR_ACCESS_TOKEN` is not configured, the data source automatically uses mock data for all widgets. This allows you to:

- Test dashboard layouts without API credentials
- Preview widget designs during development
- Demonstrate functionality in non-production environments

Mock data includes realistic error counts, severity distributions, and trends that match production patterns.

## Security Considerations

- **Secure token storage**: Never commit access tokens to version control
- **Use environment variables**: Always configure tokens via environment variables
- **Least privilege**: Use tokens with minimal required scopes (read-only)
- **Rotate tokens regularly**: Update access tokens periodically for security
- **Monitor token usage**: Review Rollbar's token usage logs for suspicious activity

## Additional Resources

- [Rollbar API Documentation](https://docs.rollbar.com/reference/)
- [Rollbar Access Tokens Guide](https://docs.rollbar.com/docs/access-tokens)
- [Rollbar Query Examples](https://docs.rollbar.com/docs/metrics-api-query-examples)
- [Rate Limiting Information](https://docs.rollbar.com/docs/rate-limits)

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review Rollbar API documentation
3. Contact the MadHive dashboard team
4. File an issue in the GitHub repository
