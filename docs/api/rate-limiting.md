# API Rate Limiting and Caching

This document describes the rate limiting and caching headers implementation for the TV Dashboards API.

## Overview

The dashboard server implements IP-based rate limiting to prevent abuse and ensure fair resource usage. Different rate limits are applied to different endpoint categories based on their expected usage patterns.

## Rate Limits

Rate limits are applied per IP address using a sliding window of 1 minute (60 seconds).

### Endpoint Categories

| Category | Path Pattern | Default Limit | Environment Variable |
|----------|-------------|---------------|---------------------|
| **Auth Endpoints** | `/auth/*` | 10 req/min | `RATE_LIMIT_AUTH` |
| **Data Endpoints** | `/api/data/*` | 60 req/min | `RATE_LIMIT_DATA` |
| **API Endpoints** | `/api/*` | 100 req/min | `RATE_LIMIT_API` |

### Exemptions

The following endpoints are exempt from rate limiting:

- `/health` - Health check endpoint
- `/app/assets/*` - Static frontend assets
- `/css/*` - Stylesheets
- `/js/*` - JavaScript files

## Configuration

Rate limits can be configured via environment variables:

```bash
# API endpoints (default: 100)
RATE_LIMIT_API=150

# Data endpoints (default: 60)
RATE_LIMIT_DATA=80

# Auth endpoints (default: 10)
RATE_LIMIT_AUTH=15
```

## Rate Limit Headers

All rate-limited responses include the following headers:

### X-RateLimit-Limit
The maximum number of requests allowed in the time window.

```
X-RateLimit-Limit: 100
```

### X-RateLimit-Remaining
The number of requests remaining in the current time window.

```
X-RateLimit-Remaining: 95
```

### X-RateLimit-Reset
The UTC timestamp (ISO 8601) when the rate limit resets.

```
X-RateLimit-Reset: 2026-03-02T14:00:00.000Z
```

## Rate Limit Exceeded (429)

When a client exceeds their rate limit, the server responds with HTTP 429 (Too Many Requests).

### Example Response

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-03-02T14:00:00.000Z

{
  "error": "Too many requests, please try again later."
}
```

### Custom Error Messages

Different endpoint categories return contextual error messages:

**Auth endpoints:**
```json
{
  "error": "Too many authentication attempts, please try again later."
}
```

**Data endpoints:**
```json
{
  "error": "Too many data requests, please try again later."
}
```

**General API endpoints:**
```json
{
  "error": "Too many requests, please try again later."
}
```

## IP Detection

The rate limiter extracts client IP addresses from the following sources (in order of priority):

1. `X-Forwarded-For` header (first IP in the list)
2. `X-Real-IP` header
3. Connection remote address

This ensures rate limiting works correctly behind proxies and load balancers.

## Cache Control Headers

The server applies appropriate caching headers based on content type and path.

### HTML Files

HTML pages are never cached to ensure users always get the latest version:

```http
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

Applies to: `/`, `/admin`, `/wizard-demo`, `*.html`

### Static Assets

Static assets (CSS, JavaScript, images) are cached for 1 hour and marked as immutable:

```http
Cache-Control: public, max-age=3600, immutable
```

Applies to: `/app/assets/*`, `/css/*`, `/js/*`

### Dashboard Configuration

Dashboard configuration can be cached for 1 minute but must revalidate:

```http
Cache-Control: max-age=60, must-revalidate
```

Applies to: `/api/config`

### API Responses

Most API responses are not cached to ensure fresh data:

```http
Cache-Control: no-cache
```

Applies to: `/api/*` (except `/api/config`)

## Implementation Details

### Rate Limiter Module

The rate limiting logic is implemented in `server/rate-limiter.js` using the `elysia-rate-limit` plugin.

```javascript
import { smartRateLimit } from './server/rate-limiter.js';

const app = new Elysia()
  .use(smartRateLimit)
  // ... other routes
```

### Smart Rate Limiter

The `smartRateLimit` plugin dynamically determines the appropriate rate limit based on the request path:

```javascript
export const smartRateLimit = rateLimit({
  duration: 60000, // 1 minute window
  max: (key, request) => {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/auth/')) return config.auth.max;
    if (url.pathname.startsWith('/api/data/')) return config.data.max;
    if (url.pathname.startsWith('/api/')) return config.api.max;

    return config.api.max;
  },
  // ... other options
});
```

### Cache Headers

Cache headers are applied in the `onAfterHandle` lifecycle hook:

```javascript
.onAfterHandle(({ request, response, store }) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (response instanceof Response) {
    // Apply cache headers based on path
    if (pathname.endsWith('.html') || pathname === '/') {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    else if (pathname.startsWith('/app/assets/')) {
      response.headers.set('Cache-Control', 'public, max-age=3600, immutable');
    }
    // ... other conditions
  }

  return response;
})
```

## Testing

### Unit Tests

Run the rate limiter unit tests:

```bash
bun test tests/unit/rate-limiter.test.js
```

### Manual Testing

Test rate limiting manually using curl:

```bash
# Make multiple requests to trigger rate limit
for i in {1..110}; do
  curl -H "X-Forwarded-For: 192.168.1.100" http://localhost:3000/api/config
done

# Should see 429 after 100 requests
```

Check rate limit headers:

```bash
curl -i http://localhost:3000/api/config | grep -i ratelimit
```

### Integration Testing

The rate limiter is tested as part of the integration test suite:

```bash
bun test tests/integration
```

## Best Practices

### For API Clients

1. **Monitor rate limit headers**: Check `X-RateLimit-Remaining` to avoid hitting limits
2. **Implement exponential backoff**: When you receive a 429, wait before retrying
3. **Cache responses locally**: Reduce API calls by caching data client-side
4. **Batch requests**: Combine multiple operations when possible

### For Server Operators

1. **Monitor rate limit metrics**: Track 429 responses to identify abusive clients
2. **Adjust limits as needed**: Use environment variables to tune limits
3. **Consider Redis for production**: The default in-memory store doesn't persist across restarts
4. **Set up alerts**: Alert on sustained high rates of 429 responses

## Troubleshooting

### Rate Limit Too Low

If legitimate users are hitting rate limits:

1. Check current limits: Review environment variables
2. Increase limits: Update `RATE_LIMIT_*` environment variables
3. Restart server: Rate limits are loaded at startup

### Rate Limiting Not Working

If rate limiting isn't being enforced:

1. Check middleware order: Rate limiter should be applied early
2. Verify headers: Ensure `X-Forwarded-For` is set correctly
3. Check exemptions: Verify the path isn't in the skip list

### Headers Not Appearing

If rate limit headers aren't in responses:

1. Check plugin configuration: Verify `headers: true` in rate limiter config
2. Verify response type: Headers only apply to Response objects
3. Check browser caching: Disable cache in DevTools

## Future Enhancements

Potential improvements for the rate limiting system:

- **Redis storage**: Persistent rate limit tracking across server restarts
- **Per-user limits**: Different limits for authenticated vs anonymous users
- **Dynamic limits**: Adjust limits based on server load
- **Rate limit analytics**: Dashboard showing rate limit usage patterns
- **Whitelist/blacklist**: Allow or block specific IP addresses

## References

- [elysia-rate-limit GitHub](https://github.com/rayriffy/elysia-rate-limit)
- [HTTP 429 Status Code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- [Cache-Control Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
- [Elysia.js Documentation](https://elysiajs.com)
