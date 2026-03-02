# Metrics Endpoint API Documentation

## Overview

The `/api/metrics` endpoint provides real-time performance monitoring and observability data for the TV Dashboards application. This endpoint collects and exposes metrics about request performance, data source queries, cache efficiency, and error rates.

## Endpoint

```
GET /api/metrics
```

### Authentication

No authentication required (public endpoint for monitoring).

### Response Format

```json
{
  "success": true,
  "metrics": {
    "timestamp": "2026-03-02T13:45:30.123Z",
    "uptime": {
      "seconds": 3600,
      "formatted": "1h 0m 0s"
    },
    "requests": {
      "total": 1250,
      "errors": 15,
      "errorRate": "1.20%",
      "requestsPerSecond": 0.35
    },
    "endpoints": {
      "/api/config": {
        "requests": 150,
        "errors": 0,
        "avgResponseTime": 45,
        "p95": 120,
        "p99": 250
      },
      "/api/metrics/:id": {
        "requests": 500,
        "errors": 5,
        "avgResponseTime": 180,
        "p95": 450,
        "p99": 800
      }
    },
    "dataSources": {
      "bigquery": {
        "queries": 250,
        "errors": 2,
        "avgQueryTime": 1200,
        "p95": 2500,
        "p99": 4500
      },
      "gcp": {
        "queries": 180,
        "errors": 0,
        "avgQueryTime": 350,
        "p95": 800,
        "p99": 1200
      }
    },
    "cache": {
      "hits": 450,
      "misses": 200,
      "sets": 200,
      "evictions": 0,
      "hitRatio": "69.23%",
      "totalRequests": 650
    },
    "errors": {
      "datasource:bigquery": 2,
      "datasource:gcp": 1
    }
  }
}
```

## Metrics Description

### Timestamp
- **Field**: `timestamp`
- **Type**: ISO 8601 datetime string
- **Description**: Current server time when metrics were collected

### Uptime
- **Field**: `uptime.seconds`
- **Type**: Number
- **Description**: Server uptime in seconds since last restart

- **Field**: `uptime.formatted`
- **Type**: String
- **Description**: Human-readable uptime (e.g., "2h 15m 30s")

### Request Statistics

#### Total Requests
- **Field**: `requests.total`
- **Type**: Number
- **Description**: Total number of HTTP requests served since server start

#### Error Count
- **Field**: `requests.errors`
- **Type**: Number
- **Description**: Total number of requests that returned 4xx or 5xx status codes

#### Error Rate
- **Field**: `requests.errorRate`
- **Type**: String (percentage)
- **Description**: Percentage of requests that resulted in errors

#### Requests Per Second
- **Field**: `requests.requestsPerSecond`
- **Type**: Number
- **Description**: Average request throughput (total requests / uptime)

### Endpoint Metrics

Metrics are grouped by normalized endpoint path (IDs replaced with `:id`).

#### Request Count
- **Field**: `endpoints[path].requests`
- **Type**: Number
- **Description**: Number of requests to this endpoint

#### Error Count
- **Field**: `endpoints[path].errors`
- **Type**: Number
- **Description**: Number of failed requests (4xx/5xx) to this endpoint

#### Average Response Time
- **Field**: `endpoints[path].avgResponseTime`
- **Type**: Number (milliseconds)
- **Description**: Average response time for this endpoint

#### P95 Response Time
- **Field**: `endpoints[path].p95`
- **Type**: Number (milliseconds)
- **Description**: 95th percentile response time (95% of requests faster than this)

#### P99 Response Time
- **Field**: `endpoints[path].p99`
- **Type**: Number (milliseconds)
- **Description**: 99th percentile response time (99% of requests faster than this)

### Data Source Metrics

Performance metrics for each data source (BigQuery, GCP, AWS, etc.).

#### Query Count
- **Field**: `dataSources[source].queries`
- **Type**: Number
- **Description**: Number of queries executed against this data source

#### Query Errors
- **Field**: `dataSources[source].errors`
- **Type**: Number
- **Description**: Number of failed queries

#### Average Query Time
- **Field**: `dataSources[source].avgQueryTime`
- **Type**: Number (milliseconds)
- **Description**: Average query execution time

#### P95 Query Time
- **Field**: `dataSources[source].p95`
- **Type**: Number (milliseconds)
- **Description**: 95th percentile query execution time

#### P99 Query Time
- **Field**: `dataSources[source].p99`
- **Type**: Number (milliseconds)
- **Description**: 99th percentile query execution time

### Cache Statistics

#### Cache Hits
- **Field**: `cache.hits`
- **Type**: Number
- **Description**: Number of successful cache retrievals

#### Cache Misses
- **Field**: `cache.misses`
- **Type**: Number
- **Description**: Number of cache lookups that failed (data not in cache)

#### Cache Sets
- **Field**: `cache.sets`
- **Type**: Number
- **Description**: Number of items stored in cache

#### Cache Evictions
- **Field**: `cache.evictions`
- **Type**: Number
- **Description**: Number of items removed from cache

#### Cache Hit Ratio
- **Field**: `cache.hitRatio`
- **Type**: String (percentage)
- **Description**: Percentage of cache lookups that were successful

#### Total Cache Requests
- **Field**: `cache.totalRequests`
- **Type**: Number
- **Description**: Total cache operations (hits + misses)

### Error Breakdown

- **Field**: `errors[source]`
- **Type**: Number
- **Description**: Error count by source (e.g., `datasource:bigquery`, `api`, etc.)

## Usage Examples

### cURL

```bash
curl http://tv.madhive.dev/api/metrics
```

### JavaScript (fetch)

```javascript
const response = await fetch('http://tv.madhive.dev/api/metrics');
const { metrics } = await response.json();

console.log(`Server uptime: ${metrics.uptime.formatted}`);
console.log(`Total requests: ${metrics.requests.total}`);
console.log(`Error rate: ${metrics.requests.errorRate}`);
console.log(`Cache hit ratio: ${metrics.cache.hitRatio}`);
```

### Monitoring Script

```bash
#!/bin/bash
# Simple monitoring script

METRICS=$(curl -s http://tv.madhive.dev/api/metrics)

ERROR_RATE=$(echo $METRICS | jq -r '.metrics.requests.errorRate' | sed 's/%//')
CACHE_HIT=$(echo $METRICS | jq -r '.metrics.cache.hitRatio' | sed 's/%//')

if (( $(echo "$ERROR_RATE > 5.0" | bc -l) )); then
  echo "⚠️  High error rate: $ERROR_RATE%"
fi

if (( $(echo "$CACHE_HIT < 50.0" | bc -l) )); then
  echo "⚠️  Low cache hit ratio: $CACHE_HIT%"
fi
```

## Performance Considerations

### Lightweight Design

The metrics collection system is designed to be lightweight and not impact request performance:

- **In-memory storage**: All metrics stored in memory (no database writes)
- **Minimal overhead**: < 1ms per request
- **Bounded memory**: Response time arrays limited to last 1000 values per endpoint
- **No persistence**: Metrics reset on server restart

### Endpoint Normalization

To prevent memory exhaustion from tracking unlimited unique endpoints, paths are normalized:

- `/api/dashboards/dashboard-1` → `/api/dashboards/:id`
- `/api/data/widget-123` → `/api/data/:id`
- `/api/queries/bigquery/my-query` → `/api/queries/:source/:id`

### Response Time

The `/api/metrics` endpoint itself is fast:
- Typical response time: < 10ms
- No external API calls
- Pure in-memory data aggregation

## Integration with Monitoring Tools

### Prometheus

The metrics endpoint returns JSON which can be scraped and converted to Prometheus format:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'tv-dashboards'
    metrics_path: '/api/metrics'
    static_configs:
      - targets: ['tv.madhive.dev']
```

### Grafana

Create dashboards using the metrics data:

1. Add Prometheus data source
2. Create panels with queries like:
   - `rate(http_requests_total[5m])`
   - `histogram_quantile(0.95, http_request_duration_seconds)`
   - `cache_hit_ratio`

### Custom Monitoring

Build custom monitoring dashboards by polling the endpoint:

```javascript
// Poll every 30 seconds
setInterval(async () => {
  const { metrics } = await fetch('/api/metrics').then(r => r.json());

  // Update dashboard
  updateMetric('uptime', metrics.uptime.formatted);
  updateMetric('requests', metrics.requests.total);
  updateMetric('errors', metrics.requests.errorRate);
  updateMetric('cache', metrics.cache.hitRatio);
}, 30000);
```

## Troubleshooting

### High Error Rate

If `requests.errorRate` > 5%:
1. Check `endpoints` to identify which endpoints are failing
2. Check `errors` breakdown to identify error sources
3. Review application logs for error details

### Slow Response Times

If `p95` or `p99` values are high:
1. Check `dataSources` to identify slow queries
2. Review query efficiency in BigQuery console
3. Consider adding indexes or optimizing queries

### Low Cache Hit Ratio

If `cache.hitRatio` < 50%:
1. Verify cache TTL settings
2. Check if widgets are requesting unique data each time
3. Consider increasing cache duration for static data

### Memory Concerns

Metrics are bounded to prevent memory issues:
- Max 1000 response times per endpoint
- Max 1000 response times per data source
- Total memory usage typically < 10MB

## Related Documentation

- [Performance Optimization Guide](../performance/optimization.md)
- [Caching Strategy](../architecture/caching.md)
- [Data Source Integration](../data-sources/README.md)
- [API Reference](./README.md)

## Support

For questions or issues with the metrics endpoint:
- File an issue: https://github.com/MadHive/tv-dashboards/issues
- Check logs: `journalctl -u tv-dashboards -f`
- Contact: DevOps team
