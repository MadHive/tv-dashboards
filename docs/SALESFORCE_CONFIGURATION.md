# Salesforce Data Source Configuration

The Salesforce data source provides CRM analytics and sales metrics for your dashboards.

## Features

- OAuth 2.0 authentication (username/password flow)
- Direct access token authentication
- SOQL query support
- Automatic query building for common metrics
- 5-minute caching (configurable)
- Support for both production and sandbox environments
- Handles rate limiting gracefully

## Authentication Methods

### Method 1: Access Token (Recommended)

This is the simplest method if you have a valid access token:

```bash
export SALESFORCE_INSTANCE_URL="https://yourinstance.my.salesforce.com"
export SALESFORCE_ACCESS_TOKEN="your_access_token_here"
```

### Method 2: OAuth Username/Password Flow

For OAuth authentication with username and password:

```bash
export SALESFORCE_INSTANCE_URL="https://yourinstance.my.salesforce.com"
export SALESFORCE_CLIENT_ID="your_connected_app_client_id"
export SALESFORCE_CLIENT_SECRET="your_connected_app_client_secret"
export SALESFORCE_USERNAME="user@example.com"
export SALESFORCE_PASSWORD="your_password"
export SALESFORCE_SECURITY_TOKEN="your_security_token"  # Optional but recommended
```

**Note:** The security token is appended to the password automatically. Get your security token from Salesforce under Setup > My Personal Information > Reset My Security Token.

### Sandbox Environment

To use a Salesforce sandbox:

```bash
export SALESFORCE_SANDBOX="true"
```

## Available Metrics

The Salesforce data source provides 12 pre-configured metrics:

| ID | Name | Description | Type |
|----|------|-------------|------|
| `open_opportunities_value` | Open Opportunities Value | Total value of open opportunities | currency |
| `leads_created_this_month` | Leads Created This Month | Number of leads created in last 30 days | number |
| `cases_by_status` | Cases by Status | Count of cases grouped by status | number |
| `win_rate` | Opportunity Win Rate | Percentage of closed won opportunities | percentage |
| `average_deal_size` | Average Deal Size | Average value of closed won opportunities | currency |
| `open_cases` | Open Cases | Total number of open support cases | number |
| `leads_by_source` | Leads by Source | Lead distribution by source | number |
| `opportunities_by_stage` | Opportunities by Stage | Pipeline breakdown by stage | number |
| `account_count` | Total Accounts | Total number of accounts | number |
| `contact_count` | Total Contacts | Total number of contacts | number |
| `case_age_avg` | Average Case Age | Average age of open cases in days | number |
| `custom_query` | Custom SOQL Query | User-defined SOQL query | number |

## Widget Configuration

### Basic Configuration

```yaml
widgets:
  - id: open-opps
    type: big-number
    title: "Open Opportunities"
    dataSource: salesforce
    object: Opportunity
    aggregation: sum
    field: Amount
    where: "IsClosed = false"
```

### Custom SOQL Query

```yaml
widgets:
  - id: custom-metric
    type: bar-chart
    title: "Leads by Status"
    dataSource: salesforce
    soql: "SELECT Status, COUNT(Id) FROM Lead WHERE CreatedDate = THIS_MONTH GROUP BY Status"
```

### Grouped Metrics

```yaml
widgets:
  - id: opportunities-by-stage
    type: bar-chart
    title: "Pipeline by Stage"
    dataSource: salesforce
    object: Opportunity
    aggregation: count
    groupBy: StageName
    where: "IsClosed = false"
```

### Time-Range Queries

```yaml
widgets:
  - id: recent-leads
    type: line-chart
    title: "Leads Last 90 Days"
    dataSource: salesforce
    object: Lead
    aggregation: count
    timeField: CreatedDate
    timeRange: 90
```

## Widget Config Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `soql` | string | No | Custom SOQL query (overrides other parameters) |
| `object` | string | No | Salesforce object name (default: 'Lead') |
| `aggregation` | string | No | Aggregation type: count, sum, avg (default: 'count') |
| `field` | string | No | Field to aggregate (required for sum/avg) |
| `where` | string | No | WHERE clause filter |
| `groupBy` | string | No | GROUP BY field for grouped metrics |
| `timeField` | string | No | Date field for time-based queries (default: 'CreatedDate') |
| `timeRange` | number | No | Time range in days (default: 30) |

## Supported Salesforce Objects

- Lead
- Opportunity
- Case
- Account
- Contact
- Custom objects (via custom SOQL queries)

## Supported Widget Types

- `big-number` - Single metric display
- `stat-card` - Metric with trend indicator
- `gauge` - Gauge chart
- `gauge-row` - Row of gauges
- `bar-chart` - Bar chart
- `line-chart` - Time series chart
- `sparkline` - Compact line chart
- `table` - Data table

## Examples

### Sales Dashboard

```yaml
widgets:
  - id: total-opps
    type: big-number
    title: "Open Opportunities"
    dataSource: salesforce
    object: Opportunity
    aggregation: sum
    field: Amount
    where: "IsClosed = false"

  - id: win-rate
    type: gauge
    title: "Win Rate"
    dataSource: salesforce
    object: Opportunity
    aggregation: count
    where: "IsWon = true AND IsClosed = true"

  - id: pipeline
    type: bar-chart
    title: "Pipeline by Stage"
    dataSource: salesforce
    object: Opportunity
    aggregation: sum
    field: Amount
    groupBy: StageName
    where: "IsClosed = false"
```

### Support Dashboard

```yaml
widgets:
  - id: open-cases
    type: stat-card
    title: "Open Cases"
    dataSource: salesforce
    object: Case
    aggregation: count
    where: "IsClosed = false"

  - id: cases-by-priority
    type: bar-chart
    title: "Cases by Priority"
    dataSource: salesforce
    object: Case
    aggregation: count
    groupBy: Priority
    where: "IsClosed = false"

  - id: avg-case-age
    type: gauge
    title: "Average Case Age (days)"
    dataSource: salesforce
    object: Case
    aggregation: avg
    field: Age__c
    where: "IsClosed = false"
```

## Caching

The Salesforce data source caches query results for 5 minutes by default. This helps:

- Reduce API calls to Salesforce
- Improve dashboard performance
- Stay within Salesforce API rate limits

Cache is invalidated automatically after 5 minutes or when the query parameters change.

## Rate Limiting

Salesforce has API rate limits based on your license type. The data source handles rate limiting gracefully:

- Failed requests return cached data if available
- Errors are logged but don't crash the dashboard
- Mock data is used as fallback when Salesforce is unavailable

## Troubleshooting

### Connection Failures

If you see "No Salesforce credentials found":
- Verify environment variables are set correctly
- Check that SALESFORCE_INSTANCE_URL is a valid URL
- Ensure your access token hasn't expired

### Authentication Errors

If you see "Failed to initialize":
- Verify your credentials are correct
- Check if your IP is whitelisted in Salesforce
- Ensure your Connected App has the correct permissions
- Verify security token is correct (if using username/password)

### Query Errors

If queries fail:
- Verify the object name is correct (case-sensitive)
- Check field names in your WHERE clause
- Ensure you have proper permissions on the object
- Validate your SOQL syntax

### Mock Data Mode

The data source will automatically use mock data when:
- No credentials are configured
- Connection fails
- Salesforce is unavailable

This ensures dashboards remain functional even without Salesforce access.

## Security Best Practices

1. **Use environment variables** - Never hardcode credentials
2. **Use access tokens** - Preferred over username/password
3. **Rotate tokens regularly** - Update access tokens periodically
4. **Limit permissions** - Use a dedicated integration user with minimal permissions
5. **Enable IP restrictions** - Whitelist your dashboard server IP in Salesforce
6. **Use Connected Apps** - For OAuth, create a dedicated Connected App

## Additional Resources

- [Salesforce API Documentation](https://developer.salesforce.com/docs/apis)
- [SOQL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/)
- [jsforce Library](https://jsforce.github.io/)
