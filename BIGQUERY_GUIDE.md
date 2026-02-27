# BigQuery Integration & Query Editor Guide

Complete guide for using BigQuery as a data source and the visual query editor.

## Table of Contents
1. [Setup & Configuration](#setup--configuration)
2. [Query Editor UI](#query-editor-ui)
3. [Creating Custom Queries](#creating-custom-queries)
4. [Using Saved Queries in Widgets](#using-saved-queries-in-widgets)
5. [Query Patterns & Examples](#query-patterns--examples)
6. [Authentication](#authentication)

---

## Setup & Configuration

### 1. Enable BigQuery API

```bash
gcloud services enable bigquery.googleapis.com
```

### 2. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create dashboard-bigquery \
  --display-name="TV Dashboards BigQuery"

# Grant BigQuery roles
gcloud projects add-iam-policy-binding mad-master \
  --member="serviceAccount:dashboard-bigquery@mad-master.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding mad-master \
  --member="serviceAccount:dashboard-bigquery@mad-master.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# Create key file
gcloud iam service-accounts keys create bigquery-key.json \
  --iam-account=dashboard-bigquery@mad-master.iam.gserviceaccount.com
```

### 3. Configure Environment

Add to `.env`:

```bash
# BigQuery Configuration
GOOGLE_APPLICATION_CREDENTIALS=/path/to/bigquery-key.json
GCP_PROJECT_ID=mad-master
```

### 4. Verify Connection

```bash
# Start server
bun run start

# Test connection
curl http://localhost:3000/api/bigquery/test-connection
```

Expected response:
```json
{
  "success": true,
  "connected": true,
  "projectId": "mad-master"
}
```

---

## Query Editor UI

### Opening the Query Editor

**Option 1:** Click the "Query Editor" button (green button, top-right)
**Option 2:** Navigate to: `http://localhost:3000` and click the button

### Editor Layout

```
┌──────────────────────────────────────────────────────┐
│  BigQuery Editor                                [X]  │
├───────────┬──────────────────────────────────────────┤
│           │  [Editor] [Schema Browser] [Results]     │
│  Saved    │                                           │
│  Queries  │  Query ID: my-query                      │
│           │  Query Name: My Query                    │
│  + New    │  Description: ...                        │
│           │                                           │
│  query-1  │  SQL:                                    │
│  query-2  │  ┌────────────────────────────────────┐ │
│           │  │ SELECT * FROM ...                  │ │
│           │  └────────────────────────────────────┘ │
│           │                                           │
│           │  [Validate] [Run Query] [Save Query]     │
└───────────┴──────────────────────────────────────────┘
```

### Three Main Tabs

**1. Editor Tab:**
- Query ID & Name
- Description
- SQL editor
- Widget type selection
- Validate/Run/Save buttons

**2. Schema Browser Tab:**
- Dataset selector
- Table selector
- Schema viewer with field types

**3. Results Tab:**
- Query results table
- Row count
- Data preview (first 100 rows)

---

## Creating Custom Queries

### Step 1: Open Query Editor

Click "Query Editor" button

### Step 2: Create New Query

Click "+ New Query" in left sidebar

### Step 3: Fill in Details

```
Query ID:        campaign-metrics
Query Name:      Campaign Performance
Description:     Daily campaign metrics from BigQuery
```

### Step 4: Write SQL Query

```sql
SELECT
  campaign_id,
  campaign_name,
  SUM(impressions) as value,
  DATE(timestamp) as date
FROM
  `mad-master.analytics.campaign_performance`
WHERE
  DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY
  campaign_id, campaign_name, date
ORDER BY
  value DESC
LIMIT 10
```

### Step 5: Validate Query

Click **"Validate"** to check:
- ✓ SQL syntax is correct
- ✓ Tables exist
- ✓ Estimated bytes to process
- ✓ Estimated cost

Example validation result:
```
✓ Query is valid
Bytes to process: 45.2 MB
Estimated cost: $0.0002
```

### Step 6: Run Query

Click **"Run Query"** to test

Results appear in the "Results" tab showing actual data

### Step 7: Select Widget Types

Choose which widget types can use this query:
- Big Number
- Stat Card
- Gauge
- Bar Chart
- Line Chart

### Step 8: Save Query

Click **"Save Query"**

Query is now available for use in dashboards!

---

## Using Saved Queries in Widgets

### Option 1: Via YAML Config

Edit `config/dashboards.yaml`:

```yaml
widgets:
  - id: campaign-performance
    type: bar-chart
    title: "Campaign Performance"
    source: bigquery
    queryId: campaign-metrics        # Reference saved query
    position: { col: 1, row: 1 }
```

### Option 2: Via Editor UI

1. Enter edit mode (`Ctrl+E`)
2. Click widget to select
3. In property panel:
   - Change **Source** to "BigQuery"
   - Set **Query ID** to saved query name
4. Save changes

### Query Data Format

BigQuery results are automatically transformed for each widget type:

**Big Number / Stat Card:**
```sql
-- Query should return:
SELECT value, label, trend, unit
```

**Gauge:**
```sql
-- Query should return:
SELECT value, min, max, unit, warning, critical
```

**Bar Chart:**
```sql
-- Query should return:
SELECT label, value, color
```

**Line Chart:**
```sql
-- Query should return:
SELECT timestamp, series, value, color
```

---

## Query Patterns & Examples

### Example 1: Simple Metric

**Use Case:** Show total requests today

```sql
SELECT
  COUNT(*) as value,
  'Requests' as label,
  'up' as trend
FROM
  `mad-master.logs.requests`
WHERE
  DATE(timestamp) = CURRENT_DATE()
```

**Widget:** Big Number

---

### Example 2: Gauge Metric

**Use Case:** Show error rate percentage

```sql
SELECT
  ROUND(
    100.0 * COUNTIF(status_code >= 500) / COUNT(*),
    2
  ) as value,
  0 as min,
  100 as max,
  '%' as unit,
  5 as warning,
  10 as critical
FROM
  `mad-master.logs.requests`
WHERE
  timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
```

**Widget:** Gauge

---

### Example 3: Bar Chart

**Use Case:** Top services by request count

```sql
SELECT
  service_name as label,
  COUNT(*) as value
FROM
  `mad-master.logs.requests`
WHERE
  timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY
  service_name
ORDER BY
  value DESC
LIMIT 10
```

**Widget:** Bar Chart

---

### Example 4: Time Series

**Use Case:** Request rate over time

```sql
SELECT
  TIMESTAMP_TRUNC(timestamp, HOUR) as timestamp,
  'Requests' as series,
  COUNT(*) as value
FROM
  `mad-master.logs.requests`
WHERE
  timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY
  timestamp
ORDER BY
  timestamp
```

**Widget:** Line Chart

---

### Example 5: Multiple Series

**Use Case:** Compare success vs error rates

```sql
SELECT
  TIMESTAMP_TRUNC(timestamp, HOUR) as timestamp,
  CASE
    WHEN status_code < 400 THEN 'Success'
    ELSE 'Errors'
  END as series,
  COUNT(*) as value,
  CASE
    WHEN status_code < 400 THEN '#10b981'
    ELSE '#ef4444'
  END as color
FROM
  `mad-master.logs.requests`
WHERE
  timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY
  timestamp, series, color
ORDER BY
  timestamp
```

**Widget:** Line Chart

---

## Advanced Features

### Query Parameters

Support for parameterized queries:

```sql
SELECT *
FROM `mad-master.analytics.campaigns`
WHERE campaign_id = @campaign_id
  AND date >= @start_date
```

Save query with parameters:
```json
{
  "params": {
    "campaign_id": "123",
    "start_date": "2026-01-01"
  }
}
```

### Custom Transformations

Add custom JavaScript transformations:

```javascript
// In query definition
transform: (rows) => {
  return rows.map(row => ({
    label: row.campaign_name,
    value: row.impressions / 1000, // Convert to thousands
    formatted: `${row.impressions.toLocaleString()}K`
  }));
}
```

### Schema Browser

1. Go to "Schema Browser" tab
2. Select dataset (e.g., `analytics`)
3. Select table (e.g., `campaign_performance`)
4. View schema:
   - Field names
   - Data types
   - Descriptions
   - Row count

---

## Authentication

### Google OAuth Setup

The query editor and dashboard editor support Google OAuth for authentication.

**1. Create OAuth Credentials:**

Go to: https://console.cloud.google.com/apis/credentials

- Create OAuth 2.0 Client ID
- Application type: Web application
- Authorized redirect URIs: `http://localhost:3000/auth/google/callback`

**2. Configure Environment:**

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
ALLOWED_DOMAIN=madhive.com
```

**3. Sign In:**

- Click "Sign In" button (top-right)
- Authenticate with Google
- Only @madhive.com emails allowed (configurable)

**4. Protected Routes:**

After authentication, you can:
- Access Query Editor
- Save queries
- Edit dashboards
- Manage configurations

---

## API Reference

### List Saved Queries
```
GET /api/bigquery/queries
```

### Get Saved Query
```
GET /api/bigquery/queries/:id
```

### Save Query
```
POST /api/bigquery/queries
Body: { id, name, description, sql, params, widgetTypes }
```

### Update Query
```
PUT /api/bigquery/queries/:id
Body: { name, description, sql, ... }
```

### Delete Query
```
DELETE /api/bigquery/queries/:id
```

### Execute Query
```
POST /api/bigquery/execute
Body: { sql, params, useCache }
```

### Validate Query
```
POST /api/bigquery/validate
Body: { sql }
```

### List Datasets
```
GET /api/bigquery/datasets
```

### List Tables
```
GET /api/bigquery/datasets/:datasetId/tables
```

### Get Table Schema
```
GET /api/bigquery/datasets/:datasetId/tables/:tableId/schema
```

### Test Connection
```
GET /api/bigquery/test-connection
```

---

## Troubleshooting

### Query Validation Fails

**Error:** `Table not found`

**Fix:** Check table name format:
- Use backticks: \`project.dataset.table\`
- Verify dataset exists
- Check service account permissions

---

### High Query Costs

**Error:** Estimated cost is high

**Optimization Tips:**
1. Add WHERE clauses to filter data
2. Use partitioned tables
3. Select only needed columns
4. Use clustering
5. Add LIMIT clause

Example optimization:
```sql
-- Bad: Full table scan
SELECT * FROM `mad-master.logs.requests`

-- Good: Filtered and limited
SELECT
  timestamp, status_code, duration
FROM
  `mad-master.logs.requests`
WHERE
  DATE(timestamp) = CURRENT_DATE()
LIMIT 1000
```

---

### Results Not Showing in Widget

**Problem:** Query runs but widget shows no data

**Checklist:**
1. Query returns data in expected format?
2. Column names match widget expectations?
3. Widget type compatible with query?
4. Check browser console for errors

**Debug:**
```javascript
// In browser console:
fetch('/api/bigquery/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql: 'YOUR_QUERY' })
})
.then(r => r.json())
.then(console.log)
```

---

## Best Practices

### 1. Use Descriptive Names

✅ Good:
```
ID: campaign-performance-daily
Name: Daily Campaign Performance Metrics
```

❌ Bad:
```
ID: query1
Name: Query
```

### 2. Add Comments to SQL

```sql
-- Calculate campaign ROI for the last 7 days
-- Used by: campaign-metrics widget
SELECT
  campaign_id,
  campaign_name,
  -- ROI = (revenue - cost) / cost * 100
  ROUND((revenue - cost) / NULLIF(cost, 0) * 100, 2) as roi
FROM
  `mad-master.analytics.campaigns`
WHERE
  date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
```

### 3. Cache Expensive Queries

For queries that take >5 seconds:
1. Create a materialized view in BigQuery
2. Query the view instead of raw tables
3. Refresh view on schedule

### 4. Test with LIMIT First

```sql
-- Test query structure first
SELECT * FROM `mad-master.huge_table` LIMIT 10

-- Then remove LIMIT for production
SELECT * FROM `mad-master.huge_table`
WHERE date = CURRENT_DATE()
```

### 5. Version Control Queries

Save queries in both:
1. Query Editor (for UI access)
2. Git repository (for version control)

Create `/queries/` directory:
```
queries/
├── campaign-metrics.sql
├── error-rates.sql
└── user-activity.sql
```

---

## Next Steps

1. ✅ Set up BigQuery service account
2. ✅ Configure OAuth credentials
3. ✅ Create your first query
4. ✅ Test in Query Editor
5. ✅ Add to dashboard widget
6. ✅ Monitor query costs
7. ✅ Optimize slow queries

**Questions?** See `DATASOURCES.md` for more data source options.
