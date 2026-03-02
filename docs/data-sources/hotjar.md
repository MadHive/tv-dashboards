# HotJar Data Source

Integration for HotJar user behavior analytics and website analytics.

## Overview

The HotJar data source provides access to user behavior analytics including:
- Page views and sessions
- Survey data and responses
- Heatmap information
- Poll data and responses
- User engagement metrics

## Configuration

### Environment Variables

Set the following environment variables to enable HotJar integration:

```bash
# Required
HOTJAR_CLIENT_ID=your_client_id_here
HOTJAR_CLIENT_SECRET=your_client_secret_here
HOTJAR_SITE_ID=your_site_id_here
```

### Obtaining API Credentials

1. Log in to your HotJar account at https://www.hotjar.com
2. Navigate to **Account Settings** > **API & Integrations**
3. Click **Create API Key** to generate new credentials
4. Copy your **Client ID** and **Client Secret**
5. Find your **Site ID** in the Sites & Organizations page

## Authentication

HotJar uses OAuth 2.0 client credentials flow for API authentication:

1. The data source automatically requests an access token using your client credentials
2. Access tokens are cached and automatically refreshed when they expire
3. All API requests include the bearer token in the Authorization header

### API Base URL

```
https://api.hotjar.io/v1
```

## Available Metrics

### Page Views
- **ID**: `page_views`
- **Type**: Number
- **Description**: Total page views tracked by HotJar
- **Widgets**: big-number, stat-card

### Sessions
- **ID**: `sessions`
- **Type**: Number
- **Description**: Total user sessions
- **Widgets**: big-number, stat-card

### Total Surveys
- **ID**: `surveys_total`
- **Type**: Number
- **Description**: Number of active surveys
- **Widgets**: big-number, stat-card, bar-chart

### Survey Responses
- **ID**: `survey_responses`
- **Type**: Number
- **Description**: Total survey responses
- **Widgets**: big-number, bar-chart, status-grid

### Active Heatmaps
- **ID**: `heatmaps_total`
- **Type**: Number
- **Description**: Number of active heatmaps
- **Widgets**: big-number, stat-card

### Active Polls
- **ID**: `polls_total`
- **Type**: Number
- **Description**: Number of active polls
- **Widgets**: big-number, stat-card

### Poll Responses
- **ID**: `poll_responses`
- **Type**: Number
- **Description**: Total poll responses
- **Widgets**: big-number, bar-chart, status-grid

### Engagement Rate
- **ID**: `engagement_rate`
- **Type**: Percentage
- **Description**: User engagement rate percentage (sessions/page_views)
- **Widgets**: gauge, gauge-row

## API Endpoints Used

### OAuth Token
```
POST /v1/oauth/token
```
Obtains access token using client credentials grant type.

### Sites
```
GET /v1/sites/{site_id}
```
Retrieves site information including page views and sessions.

### Surveys
```
GET /v1/sites/{site_id}/surveys
```
Lists all surveys for the specified site.

### Heatmaps
```
GET /v1/sites/{site_id}/heatmaps
```
Lists all heatmaps for the specified site.

### Polls
```
GET /v1/sites/{site_id}/polls
```
Lists all polls for the specified site.

## Widget Configuration

### Basic Usage

```yaml
widgets:
  - id: hotjar-pageviews
    type: big-number
    title: "Page Views"
    dataSource: hotjar
    metricType: sites
```

### Metric Types

Specify the `metricType` in widget configuration to control which API endpoint is used:

- `sites` - Site-level metrics (page views, sessions)
- `surveys` - Survey data and responses
- `heatmaps` - Heatmap information
- `polls` - Poll data and responses

### Example: Survey Responses

```yaml
widgets:
  - id: hotjar-surveys
    type: bar-chart
    title: "Survey Responses"
    dataSource: hotjar
    metricType: surveys
```

### Example: Engagement Rate

```yaml
widgets:
  - id: hotjar-engagement
    type: gauge
    title: "Engagement Rate"
    dataSource: hotjar
    metricType: sites
```

## Caching

- **Cache TTL**: 5 minutes
- API responses are cached to reduce API calls and improve performance
- Cache is automatically invalidated after the TTL expires

## Rate Limiting

HotJar API has rate limits. The data source implements:
- Response caching to minimize API calls
- Automatic token refresh
- Error handling for rate limit responses

Recommended:
- Use appropriate cache TTL values
- Avoid excessive widget refresh rates
- Monitor API usage in HotJar dashboard

## Error Handling

### Missing Credentials
If credentials are not configured, the data source will:
- Log a warning message
- Use mock data for development/testing
- Mark `isConnected` as false

### API Errors
Common error scenarios and handling:
- **401 Unauthorized**: Invalid credentials or expired token
- **404 Not Found**: Invalid site ID or resource
- **429 Too Many Requests**: Rate limit exceeded
- **500 Server Error**: HotJar API issues

All errors result in fallback to mock data to maintain dashboard stability.

## Testing

### Running Tests

```bash
# Run HotJar data source tests
bun test tests/unit/data-sources/hotjar.test.js
```

### Test Coverage

The test suite covers:
- OAuth authentication flow
- Token refresh logic
- API request methods
- Data transformation for all widget types
- Mock data generation
- Error handling
- Cache functionality
- Configuration validation

## Development Mode

When credentials are not configured, the data source automatically uses realistic mock data:

```javascript
{
  value: 12458,
  label: 'Page Views',
  trend: 'up',
  change: '+12%'
}
```

This allows development and testing without requiring actual HotJar credentials.

## Troubleshooting

### Connection Test Fails

1. Verify environment variables are set correctly
2. Check that Client ID and Client Secret are valid
3. Ensure Site ID matches your HotJar site
4. Verify network connectivity to api.hotjar.io

### No Data Returned

1. Check that your site is actively tracking data
2. Verify the site ID is correct
3. Ensure surveys/polls/heatmaps exist if querying those endpoints
4. Check HotJar dashboard for data availability

### Authentication Errors

1. Regenerate API credentials in HotJar dashboard
2. Update environment variables with new credentials
3. Restart the application to reload configuration

## API Documentation

For complete HotJar API documentation, visit:
- [HotJar API Reference](https://help.hotjar.com/hc/en-us/articles/36820005914001-Hotjar-API-Reference)
- [HotJar API & Webhooks](https://help.hotjar.com/hc/en-us/sections/35766945336081-Hotjar-API-Webhooks)

## Integration Guide

For step-by-step integration instructions, see:
- [Building a HotJar API Integration](https://rollout.com/integration-guides/hotjar/sdk/step-by-step-guide-to-building-a-hotjar-api-integration-in-python)

## Support

For HotJar-specific issues:
- Contact HotJar support at https://help.hotjar.com
- Check API status at https://status.hotjar.com

For integration issues:
- Review server logs for error messages
- Enable debug logging for detailed request/response information
- Check the troubleshooting section above
