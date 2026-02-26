# Data Sources Configuration Guide

Complete guide for configuring data sources, metrics, and visualization in the TV Dashboards system.

## Table of Contents
1. [Overview](#overview)
2. [Configuring Data Sources](#configuring-data-sources)
3. [GCP Metrics Configuration](#gcp-metrics-configuration)
4. [Transforming Data](#transforming-data)
5. [Editor Configuration](#editor-configuration)
6. [Adding New Metrics](#adding-new-metrics)

---

## Overview

The dashboard system supports 9 data sources:
- **GCP** - Google Cloud Platform monitoring
- **AWS** - AWS CloudWatch
- **DataDog** - DataDog APM
- **Elasticsearch** - Elasticsearch queries
- **Salesforce** - Salesforce API
- **HotJar** - HotJar analytics
- **FullStory** - FullStory analytics
- **Zendesk** - Zendesk support metrics
- **VulnTrack** - Security vulnerability tracking

Each data source is implemented as a plugin in `server/data-sources/`.

---

## Configuring Data Sources

### 1. Environment Variables

Configure data source credentials in `.env`:

```bash
# GCP Cloud Monitoring — uses application default credentials
GCP_PROJECTS=mad-master,mad-data,mad-audit,mad-looker-enterprise

# VulnTrack API
VULNTRACK_API_URL=https://vulntrack.madhive.dev
VULNTRACK_API_KEY=your-api-key

# Datadog API
DD_API_KEY=your-datadog-api-key
DD_APP_KEY=your-datadog-app-key
DD_SITE=datadoghq.com

# AWS CloudWatch
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Elasticsearch
ELASTICSEARCH_URL=https://your-es-cluster.com
ELASTICSEARCH_API_KEY=your-es-key
```

### 2. Dashboard Configuration

Configure widgets in `config/dashboards.yaml`:

```yaml
dashboards:
  - id: platform-overview
    name: "Platform Overview"
    widgets:
      - id: cpu-usage
        type: gauge
        title: "CPU Usage"
        source: gcp          # Data source name
        metric: cpu_usage    # Metric to fetch
        project: mad-master  # Source-specific config
        position: { col: 1, row: 1 }
```

**Widget Fields:**
- `source` - Which data source to use (gcp, vulntrack, datadog, etc.)
- `metric` - Which metric to fetch from that source
- Additional fields depend on the data source (project, region, etc.)

---

## GCP Metrics Configuration

### Current Architecture

GCP metrics are configured **per-dashboard** in `server/gcp-metrics.js`. Each dashboard has a dedicated function that queries specific metrics.

**Example:** The `platform-overview` dashboard queries Cloud Run CPU, memory, and request metrics.

### How It Works

1. **Dashboard Config** (`config/dashboards.yaml`) defines which dashboard to load
2. **Server** (`server/index.js`) calls `getMetrics(dashboardId)`
3. **GCP Module** (`server/gcp-metrics.js`) executes the dashboard-specific query function
4. **Data Returned** to widgets for rendering

### Configuring New GCP Metrics

To add/modify GCP metrics, edit the dashboard function in `server/gcp-metrics.js`:

```javascript
async function platformOverview() {
  const [cpuData, memoryData, requestsData] = await Promise.all([
    // Query 1: CPU utilization
    queryGCP({
      project: 'mad-master',
      metric: 'run.googleapis.com/container/cpu/utilizations',
      aggregation: 'ALIGN_MEAN',
      period: 3600  // 1 hour
    }),

    // Query 2: Memory utilization
    queryGCP({
      project: 'mad-master',
      metric: 'run.googleapis.com/container/memory/utilizations',
      aggregation: 'ALIGN_MEAN',
      period: 3600
    }),

    // Query 3: Request count
    queryGCP({
      project: 'mad-master',
      metric: 'run.googleapis.com/request_count',
      aggregation: 'ALIGN_RATE',
      period: 3600
    })
  ]);

  return {
    'cpu-widget': {
      value: cpuData.latest,
      history: cpuData.timeseries,
      unit: '%'
    },
    'memory-widget': {
      value: memoryData.latest,
      history: memoryData.timeseries,
      unit: '%'
    },
    'requests-widget': {
      value: requestsData.latest,
      history: requestsData.timeseries,
      unit: 'req/s'
    }
  };
}
```

### Available GCP Metrics

Common Cloud Run metrics:
- `run.googleapis.com/container/cpu/utilizations` - CPU usage %
- `run.googleapis.com/container/memory/utilizations` - Memory usage %
- `run.googleapis.com/request_count` - HTTP requests
- `run.googleapis.com/request_latencies` - Response times
- `run.googleapis.com/container/instance_count` - Instance count

Full list: https://cloud.google.com/monitoring/api/metrics_gcp

### Metric Query Parameters

- `project` - GCP project ID
- `metric` - Full metric type path
- `aggregation` - How to aggregate data points:
  - `ALIGN_MEAN` - Average values
  - `ALIGN_MAX` - Maximum values
  - `ALIGN_MIN` - Minimum values
  - `ALIGN_SUM` - Sum values
  - `ALIGN_RATE` - Rate of change
- `period` - Time window in seconds (300 = 5min, 3600 = 1hr, 86400 = 1day)
- `filters` - Additional filters (service name, region, etc.)

---

## Transforming Data

### Data Source Plugin Architecture

Each data source implements a `transformData(raw, widgetType)` method that converts raw API responses into widget-compatible format.

**Example: VulnTrack Transform**

```javascript
transformData(raw, widgetType) {
  const { dash, stats } = raw;
  const s = dash.stats || {};

  switch (widgetType) {
    case 'security-scorecard':
      // Transform API response to scorecard format
      return {
        score: calculateScore(s),
        total: s.openFindings,
        critical: s.criticalOpen,
        high: s.highOpen,
        medium: s.mediumOpen,
        low: s.lowOpen,
        history: dash.history.map(h => h.total)
      };

    case 'big-number':
      return {
        value: s.openFindings,
        trend: calculateTrend(dash.history)
      };

    case 'bar-chart':
      return {
        values: [
          { label: 'Critical', value: s.criticalOpen, color: '#EF4444' },
          { label: 'High', value: s.highOpen, color: '#F59E0B' },
          { label: 'Medium', value: s.mediumOpen, color: '#FBBF24' },
          { label: 'Low', value: s.lowOpen, color: '#10B981' }
        ]
      };
  }
}
```

### Widget Data Formats

Different widget types expect different data structures:

**Big Number:**
```javascript
{
  value: 1234,
  trend: 'up' | 'down' | 'stable',
  unit: '%' | 'ms' | 'req/s' | etc.
}
```

**Gauge:**
```javascript
{
  value: 75,
  min: 0,
  max: 100,
  unit: '%',
  thresholds: {
    warning: 80,
    critical: 95
  }
}
```

**Line Chart:**
```javascript
{
  series: [
    { label: 'CPU', data: [10, 20, 30, 40], color: '#3B82F6' },
    { label: 'Memory', data: [15, 25, 35, 45], color: '#10B981' }
  ],
  timestamps: ['10:00', '10:15', '10:30', '10:45']
}
```

**Bar Chart:**
```javascript
{
  values: [
    { label: 'Service A', value: 100, color: '#3B82F6' },
    { label: 'Service B', value: 200, color: '#10B981' }
  ]
}
```

---

## Editor Configuration

### Current Capabilities

The WYSIWYG editor currently allows you to:

✅ **Layout Control:**
- Drag & drop widgets to reposition
- Resize widgets
- Change grid layout (columns, rows, gaps)

✅ **Widget Properties:**
- Change widget title
- Change widget type (gauge, chart, number, etc.)
- Set position and size
- Configure display options (unit, min, max, thresholds)

❌ **NOT Yet Available:**
- Select which metric to fetch from a data source
- Configure metric query parameters (project, region, filters)
- Create custom metric transformations
- Configure data refresh intervals

### Using the Editor

1. **Open Dashboard:**
   ```bash
   # Start server
   bun run start

   # Open browser
   http://tv.madhive.local
   ```

2. **Enter Edit Mode:**
   - Click "Edit Mode" button (top-right)
   - Or press `Ctrl+E`

3. **Configure Widget:**
   - Click widget to select
   - Edit properties in right panel:
     - Title
     - Type
     - Position
     - Size
   - Click "Save Changes"

4. **Add New Widget:**
   - Drag widget from left palette
   - Drop onto grid
   - Configure in property panel
   - Save

### Property Panel Fields

**Basic:**
- Widget ID (read-only)
- Title
- Type (dropdown)
- Data Source (dropdown)

**Layout:**
- Column position
- Row position
- Column span
- Row span

**Display:**
- Unit (%, ms, req/s, etc.)
- Min value
- Max value
- Thresholds (warning, critical)

---

## Adding New Metrics

### Step 1: Create Data Source Plugin

Create `server/data-sources/myservice.js`:

```javascript
import { DataSource } from './base.js';

export class MyServiceDataSource extends DataSource {
  constructor(config = {}) {
    super('myservice', config);
    this.apiUrl = process.env.MYSERVICE_API_URL;
    this.apiKey = process.env.MYSERVICE_API_KEY;
  }

  async fetchMetrics(widgetConfig) {
    // Fetch data from your service API
    const response = await fetch(`${this.apiUrl}/metrics`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    const rawData = await response.json();

    // Transform for widget
    const transformed = this.transformData(rawData, widgetConfig.type);

    return {
      timestamp: new Date().toISOString(),
      source: 'myservice',
      data: transformed,
      widgetId: widgetConfig.id
    };
  }

  transformData(raw, widgetType) {
    switch (widgetType) {
      case 'big-number':
        return { value: raw.currentValue, trend: raw.trend };

      case 'gauge':
        return {
          value: raw.currentValue,
          min: 0,
          max: 100,
          unit: '%'
        };

      default:
        return raw;
    }
  }

  getAvailableMetrics() {
    return [
      {
        id: 'response_time',
        name: 'Response Time',
        description: 'API response time in milliseconds',
        type: 'number',
        widgets: ['big-number', 'gauge', 'line-chart']
      },
      {
        id: 'error_rate',
        name: 'Error Rate',
        description: 'Percentage of failed requests',
        type: 'percentage',
        widgets: ['big-number', 'gauge']
      }
    ];
  }
}

export const myServiceDataSource = new MyServiceDataSource();
```

### Step 2: Register Data Source

Edit `server/data-source-registry.js`:

```javascript
import { myServiceDataSource } from './data-sources/myservice.js';

export class DataSourceRegistry {
  constructor() {
    this.sources = new Map([
      ['gcp', gcpDataSource],
      ['aws', awsDataSource],
      ['vulntrack', vulnTrackDataSource],
      ['myservice', myServiceDataSource],  // Add here
      // ...
    ]);
  }
}
```

### Step 3: Add Environment Variables

Edit `.env`:

```bash
# MyService API
MYSERVICE_API_URL=https://api.myservice.com
MYSERVICE_API_KEY=your-api-key
```

### Step 4: Configure Widget

Edit `config/dashboards.yaml`:

```yaml
widgets:
  - id: my-metric-widget
    type: big-number
    title: "Response Time"
    source: myservice      # Use new source
    metric: response_time  # Metric ID from getAvailableMetrics()
    position: { col: 1, row: 1 }
```

### Step 5: Restart Server

```bash
# Restart to load new data source
bun run start
```

---

## Advanced: Custom Transformations

For complex data transformations, create a transformation function:

```javascript
// server/transformations/my-transform.js
export function transformSalesforceData(raw) {
  return {
    totalLeads: raw.records.filter(r => r.Type === 'Lead').length,
    totalOpportunities: raw.records.filter(r => r.Type === 'Opportunity').length,
    conversionRate: calculateConversionRate(raw.records),
    topAccounts: raw.records
      .sort((a, b) => b.Amount - a.Amount)
      .slice(0, 10)
      .map(r => ({
        name: r.Name,
        amount: r.Amount,
        stage: r.Stage
      }))
  };
}
```

Use in data source:

```javascript
import { transformSalesforceData } from '../transformations/my-transform.js';

transformData(raw, widgetType) {
  const transformed = transformSalesforceData(raw);

  switch (widgetType) {
    case 'big-number':
      return { value: transformed.totalLeads };

    case 'bar-chart':
      return {
        values: transformed.topAccounts.map(a => ({
          label: a.name,
          value: a.amount
        }))
      };
  }
}
```

---

## Troubleshooting

### Metrics Not Showing

1. **Check Environment Variables:**
   ```bash
   env | grep VULNTRACK
   env | grep GCP
   ```

2. **Test Data Source Connection:**
   ```bash
   curl -H "X-API-Key: $VULNTRACK_API_KEY" \
     "$VULNTRACK_API_URL/api/reports/dashboard?teamIds=global"
   ```

3. **Check Server Logs:**
   ```bash
   # Look for errors in console
   bun run start
   # Check for "[datasource] Error" messages
   ```

4. **Verify Widget Configuration:**
   - Check `config/dashboards.yaml` has correct `source` field
   - Verify metric ID exists in data source's `getAvailableMetrics()`

### GCP Authentication Issues

1. **Set Application Default Credentials:**
   ```bash
   gcloud auth application-default login
   ```

2. **Or use Service Account:**
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```

### Transform Errors

1. **Check field names match API response:**
   ```javascript
   console.log('Raw API response:', JSON.stringify(raw, null, 2));
   ```

2. **Handle missing data:**
   ```javascript
   const value = raw?.stats?.total || 0;  // Fallback to 0
   ```

3. **Add error handling:**
   ```javascript
   transformData(raw, widgetType) {
     try {
       // transformation logic
     } catch (error) {
       console.error('[myservice] Transform error:', error);
       return this.getEmptyData(widgetType);
     }
   }
   ```

---

## Next Steps

### Planned Features

1. **Metric Configuration UI** - Select metrics from editor (not just code)
2. **Query Builder** - Visual query builder for GCP/CloudWatch
3. **Custom Aggregations** - Configure aggregation functions in editor
4. **Data Refresh Control** - Set refresh intervals per widget
5. **Metric Mappings** - Map multiple data sources to single widget

### Contributing

To add support for a new data source or metric:

1. Create plugin in `server/data-sources/`
2. Register in `server/data-source-registry.js`
3. Add environment variables to `.env.example`
4. Update this documentation
5. Create PR with examples

---

**Questions?** Contact #platform-engineering in Slack
