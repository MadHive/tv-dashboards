# Rootly Data Source

**Integration for incident management and response tracking**

The Rootly data source provides real-time incident metrics from your Rootly incident management platform. Track active incidents, calculate MTTR, monitor severity distribution, and display recent incident activity across your dashboards.

## Overview

- **API Version:** v1
- **Base URL:** `https://api.rootly.com/v1`
- **Authentication:** Bearer token (API Key)
- **Rate Limit:** 3,000 requests/minute
- **Cache TTL:** 5 minutes
- **Data Format:** JSON:API (application/vnd.api+json)

## Configuration

### Environment Variables

```bash
# Required
ROOTLY_API_KEY=your_api_key_here

# Optional (defaults to https://api.rootly.com/v1)
ROOTLY_API_URL=https://api.rootly.com/v1
```

### Obtaining API Credentials

1. Log in to your Rootly account
2. Navigate to **Organization Settings** → **API Keys**
3. Create a new API key (Global, Team, or Personal)
4. Copy the API key and set it as `ROOTLY_API_KEY`

**Note:** Global keys have organization-wide access, Team keys are scoped to specific teams, and Personal keys have user-level permissions.

## Available Metrics

The Rootly data source provides 10 incident management metrics:

### 1. Active Incidents
- **ID:** `active_incidents`
- **Type:** Number
- **Description:** Number of currently active incidents
- **Widgets:** big-number, stat-card

### 2. Resolved Incidents
- **ID:** `resolved_incidents`
- **Type:** Number
- **Description:** Total number of resolved incidents
- **Widgets:** big-number, stat-card

### 3. Incidents by Severity
- **ID:** `incidents_by_severity`
- **Type:** Distribution
- **Description:** Breakdown of incidents by severity level (SEV-1 through SEV-5)
- **Widgets:** bar-chart, status-grid

### 4. Mean Time to Resolution (MTTR)
- **ID:** `mttr`
- **Type:** Duration
- **Description:** Average time to resolve incidents (in minutes)
- **Widgets:** gauge, gauge-row, big-number

### 5. Incidents by Service
- **ID:** `incidents_by_service`
- **Type:** Distribution
- **Description:** Incidents grouped by affected service
- **Widgets:** bar-chart, status-grid

### 6. Incident Timeline
- **ID:** `incident_timeline`
- **Type:** Timeseries
- **Description:** Recent incident activity over time
- **Widgets:** line-chart, alert-list

### 7. Incidents (Last 24h)
- **ID:** `incidents_last_24h`
- **Type:** Number
- **Description:** Number of incidents created in the last 24 hours
- **Widgets:** big-number, stat-card

### 8. Incidents (Last 7 days)
- **ID:** `incidents_last_7d`
- **Type:** Number
- **Description:** Number of incidents created in the last 7 days
- **Widgets:** big-number, stat-card

### 9. Incident Status Overview
- **ID:** `incident_status`
- **Type:** Distribution
- **Description:** Count of incidents by current status (active, mitigated, resolved)
- **Widgets:** status-grid, bar-chart

### 10. On-Call Status
- **ID:** `on_call_status`
- **Type:** Status
- **Description:** Current on-call team status and availability
- **Widgets:** status-grid, alert-list

## Widget Configuration Examples

### Active Incidents (Big Number)
```yaml
- id: active-incidents
  type: big-number
  dataSource: rootly
  title: Active Incidents
  metric: active_incidents
```

### MTTR Gauge
```yaml
- id: mttr-gauge
  type: gauge
  dataSource: rootly
  title: Mean Time to Resolution
  metric: mttr
```

### Severity Distribution (Bar Chart)
```yaml
- id: severity-chart
  type: bar-chart
  dataSource: rootly
  title: Incidents by Severity
  metric: incidents_by_severity
```

### Recent Incidents (Alert List)
```yaml
- id: recent-incidents
  type: alert-list
  dataSource: rootly
  title: Recent Incidents
  metric: incident_timeline
```

### Status Overview (Status Grid)
```yaml
- id: incident-status
  type: status-grid
  dataSource: rootly
  title: Incident Status
  metric: incident_status
```

## Supported Widget Types

- **big-number** - Display single metric values (active incidents, resolved count, MTTR)
- **stat-card** - Enhanced single metrics with trend indicators
- **gauge** / **gauge-row** - MTTR visualization with configurable thresholds
- **bar-chart** - Severity distribution, status breakdown
- **alert-list** - Recent incident activity with details
- **status-grid** - Status overview with color-coded states

## Data Transformation

The Rootly data source automatically transforms API responses into widget-compatible formats:

### Severity Levels
- **SEV-1** - Critical (Red: #DC2626)
- **SEV-2** - High (Orange: #EA580C)
- **SEV-3** - Medium (Yellow: #F59E0B)
- **SEV-4** - Low (Green: #84CC16)
- **SEV-5** - Informational (Green: #10B981)

### Status Values
- **Active** - Incident is ongoing
- **Mitigated** - Impact reduced but not resolved
- **Resolved** - Incident fully resolved

### MTTR Calculation
Mean Time to Resolution is calculated by:
1. Finding all resolved incidents
2. Computing resolution time: `resolved_at - created_at`
3. Averaging all resolution times
4. Rounding to nearest minute

## Rate Limiting

The Rootly API enforces a rate limit of **3,000 requests per minute** per API key. The data source:

- Tracks request count within a 1-minute rolling window
- Throws an error if the limit is exceeded
- Automatically resets the counter after each window expires

**Best Practices:**
- Use caching (enabled by default with 5-minute TTL)
- Avoid creating too many Rootly widgets on a single dashboard
- Consider using multiple API keys for high-traffic dashboards

## Caching Behavior

To minimize API calls and respect rate limits, the data source caches responses:

- **Cache Duration:** 5 minutes
- **Cache Strategy:** Time-based (shared across all widgets)
- **Cache Invalidation:** Automatic after TTL expires

When cache is hit, the response includes `cached: true` in the metadata.

## Error Handling

The data source gracefully handles errors:

1. **Missing API Key:** Falls back to mock data with warning
2. **Network Errors:** Returns cached data if available, otherwise mock data
3. **Rate Limit Exceeded:** Throws error with clear message
4. **API Errors:** Logs error and returns cached/mock data

## Mock Data

When the API key is not configured or API calls fail, the data source returns realistic mock data for testing and development:

- **Active Incidents:** 3
- **Resolved Incidents:** 45
- **MTTR:** 45 minutes
- **Severity Distribution:** Realistic spread across all levels
- **Sample Incidents:** 3 example incidents with different severities

## API Endpoints Used

The Rootly data source makes requests to the following endpoints:

- `GET /v1/incidents` - List incidents with filtering
- `GET /v1/services` - List services (optional)

**Headers:**
```
Authorization: Bearer {API_KEY}
Content-Type: application/vnd.api+json
Accept: application/vnd.api+json
```

## Troubleshooting

### API Key Not Working
- Verify the key is correct and not expired
- Check key permissions (Global, Team, or Personal)
- Ensure key has read access to incidents

### Rate Limit Errors
- Reduce dashboard refresh frequency
- Minimize number of Rootly widgets
- Consider caching at dashboard level

### Missing Data
- Verify your organization has incidents in Rootly
- Check date ranges for recent incidents
- Ensure services are properly configured

### Connection Timeout
- Check network connectivity to api.rootly.com
- Verify firewall/proxy settings
- Try increasing timeout in fetch configuration

## Resources

- **Official Documentation:** https://docs.rootly.com/api-reference
- **API Reference:** https://docs.rootly.com/api-reference/overview
- **OpenAPI Spec:** Available for download from Rootly docs
- **Rate Limits:** https://docs.rootly.com/api-reference/overview
- **Rootly Dashboard:** https://app.rootly.com

## Example Dashboard

Here's a complete example dashboard using Rootly metrics:

```yaml
dashboards:
  - id: incident-overview
    title: Incident Management Overview
    layout: grid
    refreshInterval: 300000  # 5 minutes (matches cache TTL)
    widgets:
      - id: active-count
        type: big-number
        dataSource: rootly
        title: Active Incidents
        metric: active_incidents
        position: { x: 0, y: 0, w: 3, h: 2 }

      - id: mttr-gauge
        type: gauge
        dataSource: rootly
        title: MTTR
        metric: mttr
        position: { x: 3, y: 0, w: 3, h: 2 }

      - id: severity-breakdown
        type: bar-chart
        dataSource: rootly
        title: By Severity
        metric: incidents_by_severity
        position: { x: 6, y: 0, w: 6, h: 4 }

      - id: recent-incidents
        type: alert-list
        dataSource: rootly
        title: Recent Incidents
        metric: incident_timeline
        position: { x: 0, y: 2, w: 6, h: 4 }

      - id: status-overview
        type: status-grid
        dataSource: rootly
        title: Status Overview
        metric: incident_status
        position: { x: 0, y: 6, w: 12, h: 2 }
```

## Security Considerations

- **API Keys:** Store in environment variables, never commit to version control
- **Key Rotation:** Rotate API keys periodically
- **Minimum Permissions:** Use Team or Personal keys when possible (instead of Global)
- **HTTPS Only:** All API communication uses HTTPS
- **Bearer Token:** Authentication via industry-standard Bearer token pattern

## Version History

- **v1.0.0** (2026-03-02) - Initial implementation
  - Incident metrics (active, resolved, MTTR)
  - Severity and status distribution
  - Alert list and status grid support
  - Rate limiting and caching
  - Mock data fallback
