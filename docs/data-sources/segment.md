# Segment Data Source

Integration with Segment's Public API for customer data platform (CDP) analytics and event tracking metrics.

## Overview

The Segment data source provides access to:
- Workspace information and configuration
- Sources (data collection points)
- Destinations (data routing endpoints)
- Event volume metrics
- Monthly Tracked Users (MTU)
- Tracking plans
- Source-specific statistics

## Authentication

Segment uses Bearer token authentication with workspace-level access tokens.

### Required Environment Variables

```bash
# Required
SEGMENT_ACCESS_TOKEN=your_workspace_access_token

# Optional (auto-detected if not provided)
SEGMENT_WORKSPACE_ID=your_workspace_id
```

### Creating an Access Token

1. Navigate to **Settings** > **Workspace settings** > **Access Management** > **Tokens**
2. Click **+ Create Token**
3. Create a description for the token
4. Assign it either **Workspace Owner** or **Workspace Member** access
5. Copy your workspace token to a secure location

**Note:** Only users with a Workspace Owner role can create Public API Tokens.

## Available Metrics

### 1. Total Sources (`sources_count`)

Number of data sources sending events to Segment.

**Configuration:**
```javascript
{
  metric: 'sources',
  type: 'big-number' // or 'stat-card', 'bar-chart', 'status-grid'
}
```

**Supported Widgets:** big-number, stat-card, bar-chart, status-grid

### 2. Total Destinations (`destinations_count`)

Number of destinations receiving data from Segment.

**Configuration:**
```javascript
{
  metric: 'destinations',
  type: 'big-number' // or 'stat-card', 'bar-chart', 'status-grid'
}
```

**Supported Widgets:** big-number, stat-card, bar-chart, status-grid

### 3. Total Event Volume (`event_volume_total`)

Total number of events tracked over a specified period.

**Configuration:**
```javascript
{
  metric: 'event_volume',
  type: 'line-chart', // or 'big-number', 'stat-card', 'sparkline'
  period: '24h' // '1h', '24h', '7d', '30d'
}
```

**Supported Widgets:** big-number, stat-card, line-chart, sparkline

### 4. Monthly Tracked Users (`monthly_tracked_users`)

Number of unique users tracked per month.

**Configuration:**
```javascript
{
  metric: 'mtu',
  type: 'gauge', // or 'big-number', 'stat-card', 'line-chart'
  period: '30d'
}
```

**Supported Widgets:** big-number, stat-card, gauge, line-chart

### 5. Tracking Plans (`tracking_plans_count`)

Number of configured tracking plans in the workspace.

**Configuration:**
```javascript
{
  metric: 'tracking_plans',
  type: 'big-number' // or 'stat-card'
}
```

**Supported Widgets:** big-number, stat-card

### 6. Source Health (`source_health`)

Status and health of all configured sources.

**Configuration:**
```javascript
{
  metric: 'sources',
  type: 'status-grid' // or 'bar-chart'
}
```

**Supported Widgets:** status-grid, bar-chart

### 7. Destination Health (`destination_health`)

Status and health of all configured destinations.

**Configuration:**
```javascript
{
  metric: 'destinations',
  type: 'status-grid' // or 'bar-chart'
}
```

**Supported Widgets:** status-grid, bar-chart

### 8. Event Volume Trend (`event_volume_trend`)

Event volume over time as a time series.

**Configuration:**
```javascript
{
  metric: 'event_volume',
  type: 'line-chart', // or 'sparkline'
  period: '24h'
}
```

**Supported Widgets:** line-chart, sparkline

### 9. MTU Usage Percentage (`mtu_usage`)

Monthly tracked users as a percentage of plan limit.

**Configuration:**
```javascript
{
  metric: 'mtu',
  type: 'gauge', // or 'gauge-row'
  period: '30d'
}
```

**Supported Widgets:** gauge, gauge-row

### 10. Source Event Count (`source_events`)

Number of events from a specific source.

**Configuration:**
```javascript
{
  metric: 'source_stats',
  sourceId: 'your_source_id', // Required
  type: 'big-number', // or 'line-chart', 'sparkline'
  period: '24h'
}
```

**Supported Widgets:** big-number, line-chart, sparkline

## Configuration Example

### Dashboard Configuration (dashboards.yaml)

```yaml
widgets:
  - id: segment-event-volume
    type: big-number
    title: "Event Volume (24h)"
    dataSource: segment
    metric: event_volume
    period: 24h
    position: { x: 0, y: 0, w: 3, h: 2 }

  - id: segment-sources
    type: status-grid
    title: "Data Sources"
    dataSource: segment
    metric: sources
    position: { x: 3, y: 0, w: 3, h: 2 }

  - id: segment-mtu
    type: gauge
    title: "MTU Usage"
    dataSource: segment
    metric: mtu
    period: 30d
    position: { x: 6, y: 0, w: 3, h: 2 }

  - id: segment-destinations
    type: bar-chart
    title: "Destinations Status"
    dataSource: segment
    metric: destinations
    position: { x: 9, y: 0, w: 3, h: 2 }
```

## API Endpoints Used

The Segment data source uses the following Segment Public API endpoints:

- `GET /workspaces` - List workspaces
- `GET /workspaces/{workspaceId}` - Get workspace details
- `GET /sources` - List sources
- `GET /sources/{sourceId}` - Get source details
- `GET /destinations` - List destinations
- `GET /tracking-plans` - List tracking plans

## Regional API Endpoints

Segment has region-specific API endpoints:

- **US Workspaces:** `https://api.segmentapis.com`
- **EU Workspaces:** `https://eu1.api.segmentapis.com`

The default is set to US. To use EU endpoints, configure:

```javascript
const segmentDataSource = new SegmentDataSource({
  baseUrl: 'https://eu1.api.segmentapis.com',
  accessToken: process.env.SEGMENT_ACCESS_TOKEN
});
```

## Rate Limits

The Segment Public API has rate limits:
- **50 requests per second** per workspace

The data source automatically:
- Enforces rate limiting
- Caches responses for 5 minutes
- Returns cached data when rate limit is exceeded

## Error Handling

The data source handles various error scenarios:

1. **Missing credentials:** Falls back to mock data
2. **API errors:** Returns error state with fallback data
3. **Rate limit exceeded:** Uses cached data or returns error
4. **Network failures:** Falls back to mock data

## Mock Data

When Segment credentials are not configured, the data source provides realistic mock data for development and testing:

- Event volume: ~10,000-60,000 events
- Sources: 5 sample sources (JavaScript, iOS, Android, Server, Cloud)
- Destinations: 3 sample destinations
- MTU: ~15,000-30,000 users
- Status indicators for source/destination health

## Testing

Run the Segment data source tests:

```bash
bun test tests/unit/data-sources/segment.test.js
```

The test suite covers:
- Constructor and initialization
- Authentication with Bearer tokens
- Rate limiting enforcement
- Metric fetching for all metric types
- Data transformation for all widget types
- Caching behavior
- Error handling
- Mock data generation

## Limitations

1. **Event volume and MTU metrics** are simulated based on source counts in this implementation. In production, these would use:
   - Segment Analytics API for actual event metrics
   - Segment Data Export API for detailed analytics
   - Usage API for billing and MTU data

2. **Historical data** is generated programmatically. For production use, integrate with Segment's Analytics or Data Export APIs for actual historical metrics.

3. **Source-specific event counts** are simulated. Production implementation should use Segment's event tracking or analytics APIs.

## Best Practices

1. **Token Security:** Never commit access tokens to version control
2. **Caching:** Leverage the built-in 5-minute cache to reduce API calls
3. **Rate Limiting:** Monitor rate limit errors and adjust polling intervals
4. **Workspace ID:** Provide `SEGMENT_WORKSPACE_ID` for faster initialization
5. **Regional Endpoints:** Use the correct regional endpoint for your workspace

## Resources

- [Segment Public API Documentation](https://segment.com/docs/api/public-api/)
- [Segment API Reference](https://docs.segmentapis.com/)
- [Authentication Guide](https://docs.segmentapis.com/tag/Authentication/)
- [Workspaces API](https://docs.segmentapis.com/tag/Workspaces/)
- [Sources API](https://docs.segmentapis.com/tag/Sources/)
- [Destinations API](https://docs.segmentapis.com/tag/Destinations/)

## Support

For issues or questions:
1. Check the [Segment API documentation](https://docs.segmentapis.com/)
2. Verify your access token has the correct permissions
3. Ensure you're using the correct regional endpoint
4. Review the test suite for implementation examples
