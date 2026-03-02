# Zendesk Data Source

Integration for Zendesk customer support and ticketing system.

## Overview

The Zendesk data source provides access to customer support metrics including:
- Ticket counts by status (new, open, pending, solved)
- Customer satisfaction ratings
- Agent performance metrics
- Support ticket trends
- Resolution times

## Configuration

### Environment Variables

Set the following environment variables to enable Zendesk integration:

```bash
# Required
ZENDESK_SUBDOMAIN=your_company_subdomain
ZENDESK_EMAIL=admin@yourcompany.com
ZENDESK_API_TOKEN=your_api_token_here
```

### Obtaining API Credentials

1. Log in to your Zendesk account at `https://your-subdomain.zendesk.com`
2. Navigate to **Admin** > **Channels** > **API**
3. Enable **Token Access** if not already enabled
4. Click **Add API Token** to generate a new token
5. Copy the generated token (you won't be able to see it again)
6. Note your subdomain from your Zendesk URL (e.g., "mycompany" from mycompany.zendesk.com)

## Authentication

Zendesk uses API token authentication:

1. The data source authenticates using email + API token
2. All API requests include the token in the Authorization header
3. Token format: `{email}/token:{api_token}`

### API Base URL

```
https://{subdomain}.zendesk.com/api/v2
```

## Available Metrics

### Open Tickets
- **ID**: `open_tickets`
- **Type**: Number
- **Description**: Number of open support tickets
- **Widgets**: big-number, stat-card, line-chart

### New Tickets
- **ID**: `new_tickets`
- **Type**: Number
- **Description**: Number of new unassigned tickets
- **Widgets**: big-number, stat-card, line-chart

### Pending Tickets
- **ID**: `pending_tickets`
- **Type**: Number
- **Description**: Number of pending tickets
- **Widgets**: big-number, stat-card, line-chart

### Solved Tickets
- **ID**: `solved_tickets`
- **Type**: Number
- **Description**: Number of solved tickets
- **Widgets**: big-number, stat-card, line-chart

### Customer Satisfaction Score
- **ID**: `customer_satisfaction`
- **Type**: Percentage
- **Description**: Customer satisfaction rating percentage (good + great ratings)
- **Widgets**: gauge, gauge-row, big-number

### Tickets by Status
- **ID**: `tickets_by_status`
- **Type**: Distribution
- **Description**: Breakdown of tickets by status
- **Widgets**: bar-chart, pie-chart

### Average Resolution Time
- **ID**: `average_resolution_time`
- **Type**: Duration
- **Description**: Average time to resolve tickets
- **Widgets**: big-number, gauge

### Agent Performance
- **ID**: `agent_performance`
- **Type**: Distribution
- **Description**: Tickets solved per agent
- **Widgets**: bar-chart, status-grid

## API Endpoints Used

### Ticket Count
```
GET /api/v2/tickets/count
```
Retrieves ticket counts grouped by status.

### Satisfaction Ratings
```
GET /api/v2/satisfaction_ratings
```
Lists customer satisfaction ratings.

## Widget Configuration

### Basic Usage

```yaml
widgets:
  - id: zendesk-open-tickets
    type: big-number
    title: "Open Tickets"
    dataSource: zendesk
```

### Example: Ticket Status Distribution

```yaml
widgets:
  - id: zendesk-status
    type: bar-chart
    title: "Tickets by Status"
    dataSource: zendesk
```

### Example: Customer Satisfaction

```yaml
widgets:
  - id: zendesk-satisfaction
    type: gauge
    title: "Customer Satisfaction"
    dataSource: zendesk
```

## Caching

- **Cache TTL**: 5 minutes
- API responses are cached to reduce API calls and improve performance
- Cache is automatically invalidated after the TTL expires
- Stale cache is used if API requests fail

## Rate Limiting

Zendesk API has rate limits:
- **Standard**: 200 requests per minute per account
- **Higher tiers**: 400-700 requests per minute

The data source implements:
- Request rate tracking per minute
- Automatic rate limit enforcement
- Error response when limit exceeded
- Response caching to minimize API calls

Recommended:
- Use appropriate cache TTL values (5 minutes default)
- Avoid excessive widget refresh rates
- Monitor API usage in Zendesk dashboard
- Consider higher API tier for heavy usage

## Error Handling

### Missing Credentials
If credentials are not configured, the data source will:
- Log a warning message
- Use mock data for development/testing
- Mark `isConnected` as false

### API Errors
Common error scenarios and handling:
- **401 Unauthorized**: Invalid credentials or API token
- **404 Not Found**: Invalid endpoint or resource
- **429 Too Many Requests**: Rate limit exceeded (wait time provided)
- **500 Server Error**: Zendesk API issues

All errors result in fallback to mock data or cached data to maintain dashboard stability.

## Testing

### Running Tests

```bash
# Run Zendesk data source tests
bun test tests/unit/data-sources/zendesk.test.js
```

### Test Coverage

The test suite covers:
- Client initialization
- API rate limiting
- Ticket count transformation
- Satisfaction score calculation
- Data transformation for all widget types
- Mock data generation
- Error handling
- Cache functionality
- Configuration validation

**Test Results**: 53 tests passing, covering:
- Constructor and configuration
- Rate limit enforcement
- Mock data for all widget types
- Data transformation logic
- Available metrics catalog
- Configuration schema
- Widget validation
- Connection testing

## Development Mode

When credentials are not configured, the data source automatically uses realistic mock data:

```javascript
// Big Number widget
{
  value: 42,
  trend: 'down',
  unit: 'tickets'
}

// Bar Chart widget
{
  values: [
    { label: 'New', value: 15, color: '#3B82F6' },
    { label: 'Open', value: 42, color: '#F59E0B' },
    { label: 'Pending', value: 8, color: '#EF4444' },
    { label: 'Solved', value: 125, color: '#10B981' }
  ]
}

// Gauge widget (satisfaction)
{
  value: 87,
  min: 0,
  max: 100,
  unit: '%',
  label: 'Customer Satisfaction'
}
```

This allows development and testing without requiring actual Zendesk credentials.

## Troubleshooting

### Connection Test Fails

1. Verify environment variables are set correctly
2. Check that API token is valid and not expired
3. Ensure email address matches the token owner
4. Verify subdomain is correct (no .zendesk.com suffix needed)
5. Verify network connectivity to zendesk.com

### No Data Returned

1. Check that tickets exist in your Zendesk account
2. Verify the API token has correct permissions
3. Check Zendesk admin for API access settings
4. Review server logs for error messages

### Rate Limit Errors

1. Reduce widget refresh frequency
2. Increase cache TTL (default is 5 minutes)
3. Review concurrent dashboard users
4. Consider upgrading Zendesk API tier
5. Check server logs for rate limit warnings

### Authentication Errors

1. Regenerate API token in Zendesk admin
2. Update ZENDESK_API_TOKEN environment variable
3. Verify email address is correct
4. Restart the application to reload configuration
5. Check API token permissions in Zendesk

## Satisfaction Score Calculation

Customer satisfaction score is calculated as:

```javascript
satisfied = count(ratings where score === 'good' || score === 'great')
total = count(all ratings)
score = Math.round((satisfied / total) * 100)
```

Zendesk rating options:
- **great**: Highly satisfied
- **good**: Satisfied
- **okay**: Neutral
- **bad**: Dissatisfied

Only "great" and "good" ratings count as satisfied.

## API Documentation

For complete Zendesk API documentation, visit:
- [Zendesk API Documentation](https://developer.zendesk.com/api-reference/)
- [Zendesk Support API](https://developer.zendesk.com/api-reference/ticketing/introduction/)
- [API Rate Limits](https://developer.zendesk.com/api-reference/introduction/rate-limits/)

## SDK Documentation

This integration uses the `node-zendesk` package:
- [node-zendesk on npm](https://www.npmjs.com/package/node-zendesk)
- [GitHub Repository](https://github.com/blakmatrix/node-zendesk)

## Security Best Practices

1. **Never commit API tokens** to version control
2. Use environment variables for all credentials
3. Rotate API tokens periodically
4. Use least-privilege API token permissions
5. Monitor API token usage in Zendesk audit logs
6. Consider using OAuth for production (future enhancement)

## Support

For Zendesk-specific issues:
- Contact Zendesk support at https://support.zendesk.com
- Check API status at https://status.zendesk.com

For integration issues:
- Review server logs for error messages
- Check the troubleshooting section above
- Verify all environment variables are set
- Test connection using the test endpoint

## Future Enhancements

Potential improvements for future versions:

1. **OAuth Authentication**: Support OAuth 2.0 flow for enhanced security
2. **Historical Data**: Track ticket trends over time
3. **Agent Metrics**: Individual agent performance tracking
4. **SLA Monitoring**: Track service level agreement compliance
5. **Custom Fields**: Support for custom ticket fields
6. **Webhook Integration**: Real-time ticket updates
7. **Advanced Search**: Support for Zendesk search API
8. **Multi-brand Support**: Support for multiple Zendesk brands
