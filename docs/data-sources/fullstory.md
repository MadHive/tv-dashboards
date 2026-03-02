# FullStory Data Source

Integration for FullStory digital experience analytics and session replay platform.

## Overview

The FullStory data source provides access to digital experience analytics including:
- User sessions and session counts
- Rage clicks (frustration signals)
- Errors encountered during sessions
- Conversion events
- Page views by URL
- Session duration metrics

## Configuration

### Environment Variables

Set the following environment variable to enable FullStory integration:

```bash
# Required
FULLSTORY_API_KEY=your_api_key_here
```

### Obtaining API Credentials

1. Log in to your FullStory account at https://app.fullstory.com
2. Navigate to **Settings** > **API Keys**
3. Click **Create API Key** to generate a new key
4. Copy your API key

**Note**: The API key must have Admin or Architect level permissions to access session and event data.

## Authentication

FullStory uses HTTP Basic authentication with the API key:

1. The API key is included in the Authorization header as `Basic YOUR_API_KEY`
2. All API requests use HTTPS
3. Authentication is automatically handled by the data source

### API Base URL

```
https://api.fullstory.com
```

The API automatically routes requests to the correct data center based on your account configuration.

## Available Metrics

### Total Sessions
- **ID**: `sessions_total`
- **Metric**: `sessions`
- **Type**: Number
- **Description**: Total number of user sessions
- **Widgets**: big-number, stat-card, line-chart, bar-chart

### Rage Clicks
- **ID**: `rage_clicks`
- **Metric**: `rage_clicks`
- **Type**: Number
- **Description**: Rapid repeated clicks indicating user frustration
- **Widgets**: big-number, stat-card, gauge, line-chart

### Errors Encountered
- **ID**: `errors_encountered`
- **Metric**: `errors`
- **Type**: Number
- **Description**: Number of errors encountered during sessions
- **Widgets**: big-number, stat-card, gauge, line-chart

### Conversion Events
- **ID**: `conversion_events`
- **Metric**: `conversions`
- **Type**: Number
- **Description**: Number of successful conversion events
- **Widgets**: big-number, stat-card, line-chart, bar-chart

### Page Views
- **ID**: `page_views`
- **Metric**: `page_views`
- **Type**: Number
- **Description**: Total page views across all sessions
- **Widgets**: big-number, line-chart, bar-chart

### Average Session Duration
- **ID**: `session_duration_avg`
- **Metric**: `sessions`
- **Type**: Duration
- **Description**: Average duration of user sessions
- **Widgets**: gauge, big-number

### User Sessions
- **ID**: `user_sessions`
- **Metric**: `sessions`
- **Type**: Number
- **Description**: Sessions for a specific user (by email or uid)
- **Widgets**: big-number, line-chart

## API Endpoints Used

### List Sessions (v2)
```
GET /sessions/v2?email={email}&uid={uid}&limit={limit}
```
Retrieves a list of session URLs for a given user queried by email address and/or uid.

**Parameters**:
- `email` (optional): User email address
- `uid` (optional): User ID
- `limit` (optional): Number of sessions to return (default: 20)

**Note**: For event-level metrics like rage clicks and errors, the implementation uses session data aggregation. For production use with full event-level detail, consider using the FullStory Data Export API or Segment Export API.

## Widget Configuration

### Basic Usage

```yaml
widgets:
  - id: fs-sessions
    type: big-number
    title: "Total Sessions"
    dataSource: fullstory
    metric: sessions
    limit: 100
```

### Metric Configuration

Specify the `metric` parameter in widget configuration to control which metric is retrieved:

- `sessions` - Total user sessions
- `rage_clicks` - Frustration signals (rage clicks)
- `errors` - Errors encountered
- `conversions` - Conversion events
- `page_views` - Page views

### Example: Rage Clicks Tracking

```yaml
widgets:
  - id: fs-rage-clicks
    type: gauge
    title: "Rage Clicks"
    dataSource: fullstory
    metric: rage_clicks
    limit: 200
    timeRange: "24h"
```

### Example: User-Specific Sessions

```yaml
widgets:
  - id: fs-user-sessions
    type: line-chart
    title: "User Sessions"
    dataSource: fullstory
    metric: sessions
    email: "user@example.com"
    limit: 50
```

### Example: Conversion Tracking

```yaml
widgets:
  - id: fs-conversions
    type: bar-chart
    title: "Conversions"
    dataSource: fullstory
    metric: conversions
    timeRange: "7d"
```

## Caching

- **Cache TTL**: 5 minutes
- API responses are cached to reduce API calls and improve performance
- Cache is automatically invalidated after the TTL expires
- Cache key includes metric type, email, uid, limit, and time range

## Rate Limiting

FullStory API has rate limits. The data source implements:
- Response caching to minimize API calls
- Request timeout (10 seconds)
- Error handling for rate limit responses

Recommended practices:
- Use appropriate cache TTL values (5 minutes default)
- Avoid excessive widget refresh rates
- Set reasonable limit values for session queries
- Monitor API usage in FullStory dashboard

## Error Handling

### Missing Credentials
If the API key is not configured, the data source will:
- Log a warning message
- Use mock data for development/testing
- Mark `isConnected` as false

### API Errors
Common error scenarios and handling:
- **401 Unauthorized**: Invalid API key or insufficient permissions
- **404 Not Found**: Invalid endpoint or resource
- **429 Too Many Requests**: Rate limit exceeded
- **500 Server Error**: FullStory API issues

All errors result in fallback to mock data to maintain dashboard stability.

## Testing

### Running Tests

```bash
# Run FullStory data source tests
bun test tests/unit/data-sources/fullstory.test.js
```

### Test Coverage

The test suite covers:
- API authentication and request construction
- Session fetching with parameters
- Metric aggregation (sessions, rage clicks, errors, conversions, page views)
- Data transformation for all widget types
- Mock data generation
- Error handling
- Cache functionality
- Configuration validation
- Helper methods (labels, units, history generation)

**Test Results**: 45 tests, 186 assertions, all passing

## Development Mode

When the API key is not configured, the data source automatically uses realistic mock data:

```javascript
{
  value: 1250,
  previous: 1100,
  trend: 'up',
  label: 'Total Sessions',
  unit: 'sessions'
}
```

This allows development and testing without requiring actual FullStory credentials.

## Troubleshooting

### Connection Test Fails

1. Verify the `FULLSTORY_API_KEY` environment variable is set correctly
2. Check that the API key has Admin or Architect permissions
3. Verify network connectivity to api.fullstory.com
4. Check server logs for detailed error messages

### No Data Returned

1. Verify sessions exist for the specified time range
2. Check email or uid parameters are correct
3. Ensure the site is actively tracking sessions
4. Increase the limit parameter if needed
5. Check FullStory dashboard for data availability

### Authentication Errors

1. Regenerate API key in FullStory dashboard
2. Verify API key permissions (Admin or Architect required)
3. Update `FULLSTORY_API_KEY` environment variable
4. Restart the application to reload configuration

### Metric Values Seem Low

Note: For metrics like rage clicks, errors, conversions, and page views, the current implementation uses session-based aggregation with estimated ratios. For production use requiring precise event-level metrics:

1. Consider implementing the Data Export API for raw event data
2. Use the Segment Export API for detailed event breakdowns
3. Adjust the estimation ratios in `fetchSessionMetrics()` based on your actual data

## API Documentation

For complete FullStory API documentation, visit:
- [FullStory Developer Guide](https://developer.fullstory.com/)
- [Authentication Documentation](https://developer.fullstory.com/server/authentication/)
- [List Sessions API](https://help.fullstory.com/hc/en-us/articles/360020828893)
- [Managing API Keys](https://help.fullstory.com/hc/en-us/articles/360052021773)

## Advanced Features

### Data Export API

For advanced use cases requiring detailed event-level data, consider implementing:

- **Data Export API**: Access raw event data extracts
- **Segment Export API**: Create custom segment exports in CSV, JSON, or NDJSON
- **Events API**: Query specific event types
- **Funnels API**: Analyze conversion funnels

These APIs provide more granular data than the session-based implementation and are recommended for production deployments requiring precise metrics.

### Custom Event Tracking

FullStory supports custom events that can be tracked via:
- Browser SDK: `FS.event('eventName', properties)`
- Server API: Create custom events via REST API

Custom events can be used for:
- Conversion tracking
- Feature usage analytics
- Custom error tracking
- Business metrics

## Implementation Notes

### Current Implementation

The current implementation uses the Sessions API (v2) to retrieve session data and provides:
- Direct session counting
- Estimated metrics for rage clicks, errors, conversions, and page views
- Time-series data generation for visualizations
- Cache-friendly design with 5-minute TTL

### Production Enhancements

For production use, consider enhancing with:

1. **Data Export Integration**: Use the Data Export API for precise event metrics
2. **Segment Export**: Implement segment-based queries for complex analytics
3. **Real-time Events**: Use the Events API for real-time event tracking
4. **Custom Metrics**: Define custom event types specific to your application
5. **Funnel Analytics**: Implement the Funnels API for conversion analysis

## Support

For FullStory-specific issues:
- Visit the FullStory Help Center: https://help.fullstory.com
- Check API status and updates
- Contact FullStory support for API access issues

For integration issues:
- Review server logs for error messages
- Enable debug logging: Check console output for `[fullstory]` messages
- Verify widget configuration in dashboards.yaml
- Check the troubleshooting section above
