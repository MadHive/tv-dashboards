# Checkly Data Source

Integration with Checkly's synthetic monitoring and uptime tracking platform for monitoring API endpoints, browser flows, and infrastructure health.

## Overview

The Checkly data source provides real-time monitoring metrics from your Checkly checks, including:

- **Uptime tracking** - Monitor availability across all checks
- **Response time metrics** - Track performance and latency
- **Check health status** - View passing/failing checks
- **Synthetic monitoring** - API, browser, heartbeat, and TCP checks
- **Alert tracking** - Monitor active alerts from failing checks

## Configuration

### Environment Variables

```bash
# Required
CHECKLY_API_KEY=your_api_key_here
CHECKLY_ACCOUNT_ID=your_account_id_here
```

### Obtaining Credentials

1. **API Key**: Navigate to [Checkly Account Settings](https://app.checklyhq.com/settings/user/api-keys) and create a new API key
2. **Account ID**: Found in your Checkly account settings page

**Security Note**: Treat your API key like a password and keep it secure. Never commit credentials to version control.

## Available Metrics

### 1. Total Checks
**Metric ID**: `total_checks`
**Type**: `number`
**Widgets**: `big-number`, `stat-card`

Total number of configured checks in your Checkly account.

```yaml
- type: big-number
  title: "Total Checks"
  source: checkly
  metric: checks
```

### 2. Passing Checks
**Metric ID**: `passing_checks`
**Type**: `number`
**Widgets**: `big-number`, `stat-card`, `bar-chart`

Number of checks currently passing (activated and not degraded).

```yaml
- type: stat-card
  title: "Passing Checks"
  source: checkly
  metric: checks
```

### 3. Failing Checks
**Metric ID**: `failing_checks`
**Type**: `number`
**Widgets**: `big-number`, `stat-card`, `status-grid`

Number of checks currently failing or degraded.

```yaml
- type: big-number
  title: "Failing Checks"
  source: checkly
  metric: failing_checks
```

### 4. Uptime Percentage
**Metric ID**: `uptime_percentage`
**Type**: `percentage`
**Widgets**: `big-number`, `gauge`, `gauge-row`, `stat-card`

Overall uptime percentage across all active checks.

```yaml
- type: gauge
  title: "Uptime"
  source: checkly
  metric: uptime
  period: 24h
```

### 5. Average Response Time
**Metric ID**: `avg_response_time`
**Type**: `number` (milliseconds)
**Widgets**: `big-number`, `stat-card`, `line-chart`, `sparkline`

Average response time across all checks or for a specific check.

```yaml
- type: stat-card
  title: "Avg Response Time"
  source: checkly
  metric: response_time
  period: 24h
```

### 6. Response Time Trend
**Metric ID**: `response_time_trend`
**Type**: `timeseries`
**Widgets**: `line-chart`, `sparkline`

Response time over time showing performance trends.

```yaml
- type: line-chart
  title: "Response Time Trend"
  source: checkly
  metric: response_time
  checkId: check-abc123
  period: 7d
```

### 7. Checks by Type
**Metric ID**: `checks_by_type`
**Type**: `distribution`
**Widgets**: `bar-chart`, `status-grid`

Distribution of checks by type (API, Browser, TCP, Heartbeat).

```yaml
- type: bar-chart
  title: "Checks by Type"
  source: checkly
  metric: checks_by_type
```

### 8. Check Frequency
**Metric ID**: `check_frequency`
**Type**: `distribution`
**Widgets**: `bar-chart`

Distribution of check frequencies (how often checks run).

```yaml
- type: bar-chart
  title: "Check Frequency Distribution"
  source: checkly
  metric: check_frequency
```

### 9. Check Health Status
**Metric ID**: `check_health`
**Type**: `status`
**Widgets**: `status-grid`, `bar-chart`

Health status visualization for all checks.

```yaml
- type: status-grid
  title: "Check Health"
  source: checkly
  metric: checks
```

### 10. Active Alerts
**Metric ID**: `alerts_count`
**Type**: `number`
**Widgets**: `big-number`, `stat-card`

Number of active alerts from failing checks.

```yaml
- type: big-number
  title: "Active Alerts"
  source: checkly
  metric: failing_checks
```

## Widget Configuration Options

### Common Parameters

- **`metric`** (string): The metric type to fetch (required)
  - Options: `checks`, `check_results`, `uptime`, `response_time`, `failing_checks`, `check_frequency`, `checks_by_type`

- **`period`** (string): Time period for metrics (optional, default: `24h`)
  - Options: `1h`, `6h`, `24h`, `7d`, `30d`

- **`checkId`** (string): Specific check ID for check-specific metrics (optional)
  - Required for fetching individual check results and response times

- **`checkType`** (string): Filter checks by type (optional)
  - Options: `api`, `browser`, `heartbeat`, `tcp`

### Example Configurations

#### Uptime Gauge
```yaml
- id: checkly-uptime
  type: gauge
  title: "System Uptime"
  source: checkly
  metric: uptime
  period: 7d
  refresh: 60
```

#### Response Time Chart
```yaml
- id: checkly-response
  type: line-chart
  title: "API Response Time (24h)"
  source: checkly
  metric: response_time
  checkId: check-abc123
  period: 24h
  refresh: 120
```

#### Check Status Grid
```yaml
- id: checkly-status
  type: status-grid
  title: "Check Health Status"
  source: checkly
  metric: checks
  refresh: 60
```

#### Failing Checks Alert
```yaml
- id: checkly-alerts
  type: stat-card
  title: "Failing Checks"
  source: checkly
  metric: failing_checks
  refresh: 30
```

#### Checks by Type Distribution
```yaml
- id: checkly-types
  type: bar-chart
  title: "Checks by Type"
  source: checkly
  metric: checks_by_type
  refresh: 300
```

## API Details

### Authentication

The Checkly API uses Bearer token authentication with an additional account ID header:

```bash
Authorization: Bearer [apiKey]
X-Checkly-Account: [accountId]
```

### Rate Limits

- **600 requests per 60 seconds** (10 requests per second average)
- The data source enforces rate limiting automatically
- Consider setting appropriate `refresh` intervals on widgets (60-300 seconds recommended)

### Caching

- **Cache TTL**: 5 minutes
- Reduces API calls for frequently accessed metrics
- Cache is automatic and transparent

### Base URL

```
https://api.checklyhq.com/v1
```

## Error Handling

The data source gracefully handles errors and provides fallback behavior:

1. **Missing credentials**: Falls back to mock data with warning
2. **API errors**: Returns cached data if available, otherwise mock data
3. **Rate limit exceeded**: Throws descriptive error with wait time
4. **Network errors**: Logs error and returns fallback data

All errors are logged to the console for debugging.

## Data Transformations

The data source automatically transforms Checkly API responses to match widget expectations:

### Big Number / Stat Card
```javascript
{
  value: 25,           // Current metric value
  trend: 'up',         // Trend indicator (up/down/stable)
  label: 'Total Checks',
  unit: 'checks'
}
```

### Gauge
```javascript
{
  value: 99,           // Percentage value (0-100)
  min: 0,
  max: 100,
  unit: '%',
  label: 'Uptime'
}
```

### Line Chart / Sparkline
```javascript
{
  labels: ['2026-03-02T10:00:00Z', ...], // ISO timestamps
  values: [120, 135, 142, ...],          // Response times in ms
  series: 'Response Time'
}
```

### Bar Chart
```javascript
{
  values: [
    { label: 'API Checks', value: 15, color: '#3B82F6' },
    { label: 'Browser Checks', value: 8, color: '#8B5CF6' },
    ...
  ]
}
```

### Status Grid
```javascript
{
  items: [
    { label: 'API Homepage', status: 'healthy', value: 'api' },
    { label: 'Auth Service', status: 'critical', value: 'api' },
    ...
  ]
}
```

## Best Practices

1. **Set Appropriate Refresh Intervals**
   - Critical alerts: 30-60 seconds
   - Uptime metrics: 60-120 seconds
   - Historical trends: 300-600 seconds

2. **Use Specific Check IDs**
   - For detailed response time metrics, specify `checkId`
   - Aggregate metrics work well without `checkId`

3. **Monitor Rate Limits**
   - Don't set refresh intervals too low
   - Use caching to your advantage (5-minute TTL)

4. **Filter by Check Type**
   - Use `checkType` parameter to focus on specific monitoring types
   - Reduces data volume and improves clarity

5. **Choose Appropriate Periods**
   - Real-time monitoring: 1h or 6h
   - Daily reports: 24h
   - Weekly trends: 7d
   - Monthly overview: 30d

## Troubleshooting

### No Data Displayed

1. Verify environment variables are set:
   ```bash
   echo $CHECKLY_API_KEY
   echo $CHECKLY_ACCOUNT_ID
   ```

2. Test connection:
   ```bash
   curl -H "Authorization: Bearer $CHECKLY_API_KEY" \
        -H "X-Checkly-Account: $CHECKLY_ACCOUNT_ID" \
        https://api.checklyhq.com/v1/checks?limit=1
   ```

3. Check server logs for error messages

### Rate Limit Errors

- Reduce refresh frequency on widgets
- Consolidate similar metrics into single widgets
- Increase cache TTL if needed

### Incorrect Metrics

- Verify `metric` parameter matches available options
- Check `checkId` is valid if specified
- Ensure `period` is a valid time range

## API Reference

### Endpoints Used

- `GET /v1/checks` - List all checks
- `GET /v1/check-results/{checkId}` - Get check results for specific check

### Response Structures

#### Check Object
```json
{
  "id": "check-abc123",
  "name": "API Homepage",
  "activated": true,
  "degraded": false,
  "checkType": "api",
  "frequency": 60
}
```

#### Check Result Object
```json
{
  "hasErrors": false,
  "hasFailures": false,
  "responseTime": 125,
  "isDegraded": false,
  "runLocation": "us-east-1",
  "startedAt": "2026-03-02T10:00:00Z"
}
```

## References

- [Checkly API Documentation](https://developers.checklyhq.com/reference/)
- [Checkly Authentication Guide](https://developers.checklyhq.com/reference/authentication)
- [API Checks Documentation](https://developers.checklyhq.com/reference/getv1checks)
- [Checkly Dashboard](https://app.checklyhq.com/)

## Support

For issues specific to this integration, check the server logs. For Checkly API issues, consult the [Checkly documentation](https://www.checklyhq.com/docs/) or contact Checkly support.
