# Chromatic Data Source

Visual regression testing and UI review platform integration for the TV Dashboards system.

## Overview

The Chromatic data source provides real-time metrics and insights from your visual testing builds, including:

- Build status tracking
- Visual change detection
- Snapshot analysis
- Review progress
- Test coverage metrics
- Error monitoring

## Configuration

### Environment Variables

Set the following environment variable to enable the Chromatic data source:

```bash
export CHROMATIC_PROJECT_TOKEN="your-project-token-here"
```

### Finding Your Project Token

1. Log in to [Chromatic](https://www.chromatic.com)
2. Navigate to your project
3. Go to **Manage → Configure**
4. Copy your project token

### Optional Configuration

```javascript
{
  "projectToken": "your-token",           // Required: Chromatic project token
  "apiUrl": "https://www.chromatic.com/api/v1",  // Optional: API base URL
  "graphqlUrl": "https://index.chromatic.com/graphql"  // Optional: GraphQL endpoint
}
```

## Available Metrics

The Chromatic data source provides 10 comprehensive metrics:

### 1. Total Builds
- **ID**: `total_builds`
- **Type**: Number
- **Description**: Total number of visual testing builds
- **Widgets**: big-number, stat-card

### 2. Passing Builds
- **ID**: `passing_builds`
- **Type**: Number
- **Description**: Number of builds with no visual changes
- **Widgets**: big-number, stat-card, gauge

### 3. Builds with Changes
- **ID**: `builds_with_changes`
- **Type**: Number
- **Description**: Number of builds with visual changes detected
- **Widgets**: big-number, stat-card, bar-chart

### 4. Snapshots Captured
- **ID**: `snapshots_captured`
- **Type**: Number
- **Description**: Total number of UI snapshots captured
- **Widgets**: big-number, stat-card

### 5. Visual Changes Detected
- **ID**: `changes_detected`
- **Type**: Number
- **Description**: Number of visual changes detected across builds
- **Widgets**: big-number, line-chart, bar-chart

### 6. Unreviewed Changes
- **ID**: `unreviewed_changes`
- **Type**: Number
- **Description**: Number of visual changes pending review
- **Widgets**: big-number, alert-list, progress-bar

### 7. Build Duration
- **ID**: `build_duration`
- **Type**: Duration
- **Description**: Average time to complete visual testing builds
- **Widgets**: gauge, line-chart

### 8. Test Coverage
- **ID**: `test_coverage`
- **Type**: Percentage
- **Description**: Percentage of components with visual tests
- **Widgets**: gauge, gauge-row, progress-bar

### 9. Pass Rate
- **ID**: `pass_rate`
- **Type**: Percentage
- **Description**: Percentage of builds passing without changes
- **Widgets**: gauge, gauge-row, stat-card

### 10. Snapshot Errors
- **ID**: `snapshot_errors`
- **Type**: Number
- **Description**: Number of snapshot capture errors
- **Widgets**: big-number, alert-list

## Widget Support

The Chromatic data source supports all widget types:

### Big Number / Stat Card
Displays total builds, changes, or snapshots with trend indicators.

```yaml
widgets:
  - id: chromatic-builds
    type: big-number
    title: "Total Builds"
    dataSource: chromatic
```

### Gauge / Gauge Row
Shows pass rate or test coverage as a percentage.

```yaml
widgets:
  - id: chromatic-pass-rate
    type: gauge
    title: "Pass Rate"
    dataSource: chromatic
```

### Bar Chart
Visualizes builds by status (PASSED, FAILED, PENDING, etc.).

```yaml
widgets:
  - id: chromatic-status
    type: bar-chart
    title: "Builds by Status"
    dataSource: chromatic
```

### Line Chart / Sparkline
Tracks visual changes over time across recent builds.

```yaml
widgets:
  - id: chromatic-changes
    type: line-chart
    title: "Visual Changes Trend"
    dataSource: chromatic
```

### Progress Bar
Shows review progress for detected visual changes.

```yaml
widgets:
  - id: chromatic-review
    type: progress-bar
    title: "Review Progress"
    dataSource: chromatic
```

### Status Grid
Displays recent builds with their status and change counts.

```yaml
widgets:
  - id: chromatic-grid
    type: status-grid
    title: "Recent Builds"
    dataSource: chromatic
```

### Alert List
Shows builds with visual changes or errors requiring attention.

```yaml
widgets:
  - id: chromatic-alerts
    type: alert-list
    title: "Builds Requiring Review"
    dataSource: chromatic
```

## Data Caching

The Chromatic data source implements intelligent caching:

- **Cache Duration**: 5 minutes
- **Automatic Refresh**: Data is fetched on first request and cached
- **Stale Data Handling**: Cached data is served while fresh data is fetched in background

This reduces API calls and improves dashboard performance.

## API Details

### GraphQL Endpoint

The data source uses Chromatic's GraphQL API:

```
https://index.chromatic.com/graphql
```

### Authentication

Authentication is handled via Bearer token:

```
Authorization: Bearer YOUR_PROJECT_TOKEN
```

### Rate Limiting

Chromatic's API implements rate limiting. The data source handles this gracefully by:

1. Caching responses for 5 minutes
2. Returning cached data if API is unavailable
3. Logging rate limit errors for monitoring

## Build Status Mapping

Chromatic build statuses are mapped to dashboard status indicators:

| Chromatic Status | Dashboard Status | Color |
|-----------------|------------------|-------|
| PASSED | success | Green |
| FAILED | error | Red |
| BROKEN | error | Red |
| PENDING | warning | Orange |
| IN_PROGRESS | warning | Orange |
| DENIED | critical | Dark Red |
| Other | unknown | Gray |

## Error Handling

The Chromatic data source handles errors gracefully:

1. **Missing Token**: Falls back to realistic mock data
2. **API Errors**: Returns cached data or mock data
3. **Network Failures**: Uses cached data if available
4. **Invalid Responses**: Logs errors and returns fallback data

All errors are logged for debugging while maintaining dashboard stability.

## Example Dashboard Configuration

```yaml
dashboards:
  - id: visual-testing
    name: Visual Testing Dashboard
    layout: grid
    refreshInterval: 300000  # 5 minutes
    widgets:
      - id: total-builds
        type: big-number
        title: "Total Builds"
        dataSource: chromatic
        position: { x: 0, y: 0, w: 3, h: 2 }

      - id: pass-rate
        type: gauge
        title: "Pass Rate"
        dataSource: chromatic
        position: { x: 3, y: 0, w: 3, h: 2 }

      - id: changes-trend
        type: line-chart
        title: "Visual Changes Trend"
        dataSource: chromatic
        position: { x: 6, y: 0, w: 6, h: 4 }

      - id: build-status
        type: bar-chart
        title: "Builds by Status"
        dataSource: chromatic
        position: { x: 0, y: 2, w: 6, h: 3 }

      - id: review-progress
        type: progress-bar
        title: "Review Progress"
        dataSource: chromatic
        position: { x: 0, y: 5, w: 6, h: 2 }

      - id: recent-builds
        type: status-grid
        title: "Recent Builds"
        dataSource: chromatic
        position: { x: 6, y: 4, w: 6, h: 4 }

      - id: alerts
        type: alert-list
        title: "Builds Requiring Attention"
        dataSource: chromatic
        position: { x: 0, y: 7, w: 12, h: 4 }
```

## Testing

### Unit Tests

Run the Chromatic data source tests:

```bash
bun test tests/unit/data-sources/chromatic.test.js
```

### Connection Test

Test your Chromatic connection:

```bash
# Set your project token
export CHROMATIC_PROJECT_TOKEN="your-token"

# Run connection test
bun test tests/unit/data-sources/chromatic.test.js -t "testConnection"
```

### Mock Data

When no project token is configured, the data source automatically provides realistic mock data for development and testing:

- 156 total builds
- 92% pass rate
- Various build statuses
- Sample visual changes trend
- Review progress indicators

## Troubleshooting

### "Project token not configured"

**Cause**: `CHROMATIC_PROJECT_TOKEN` environment variable is not set.

**Solution**:
```bash
export CHROMATIC_PROJECT_TOKEN="your-token-here"
```

### "Connection test failed"

**Cause**: Invalid project token or network issues.

**Solutions**:
1. Verify your project token in Chromatic dashboard
2. Check network connectivity
3. Ensure firewall allows HTTPS to `index.chromatic.com`

### "GraphQL errors"

**Cause**: Invalid query or authentication issues.

**Solutions**:
1. Verify project token is valid
2. Check Chromatic API status
3. Review application logs for detailed error messages

### Data Not Refreshing

**Cause**: Cached data is being served.

**Solution**: Data is cached for 5 minutes. Wait for cache expiration or restart the server to clear cache.

## API Reference

### fetchMetrics(widgetConfig)

Fetches Chromatic metrics for a specific widget.

**Parameters**:
- `widgetConfig.id` (string): Widget identifier
- `widgetConfig.type` (string): Widget type

**Returns**: Promise resolving to metric data

### testConnection()

Tests connection to Chromatic API.

**Returns**: Promise resolving to boolean (true if connected)

### getAvailableMetrics()

Gets list of available Chromatic metrics.

**Returns**: Array of metric definitions

## Best Practices

1. **Use Caching**: Respect the 5-minute cache to avoid rate limiting
2. **Monitor Alerts**: Use alert-list widgets to track builds requiring review
3. **Track Trends**: Use line-chart widgets to identify patterns in visual changes
4. **Review Progress**: Monitor unreviewed changes with progress-bar widgets
5. **Status Overview**: Use status-grid for quick visual scan of recent builds

## Related Resources

- [Chromatic Documentation](https://www.chromatic.com/docs/)
- [Chromatic API Documentation](https://www.chromatic.com/docs/api/)
- [Visual Testing Guide](https://www.chromatic.com/docs/test/)
- [Project Token FAQ](https://www.chromatic.com/docs/faq/find-project-token/)

## Support

For issues with the Chromatic data source:

1. Check application logs for detailed error messages
2. Verify your project token is valid
3. Review this documentation
4. Contact support with error logs and configuration details
