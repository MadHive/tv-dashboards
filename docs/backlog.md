# Backlog

Items parked for later — not currently prioritized.

## Query Explorer — Phase 2

Design doc: `docs/plans/2026-03-04-query-explorer-design.md`

Source slots are already present as disabled options in the Explorer source selector, ready to wire up when needed.

### New data sources
- **Cloud Logging** — filter string + time range + log name + project → log line results table
- **Cloud Trace** — service + operation + latency threshold → trace list with span details
- **OTel Collector** — Prometheus endpoint URL + PromQL expression → metrics from running collector

### Assertion / health-check system
Saved conditions on query results, stored in `config/assertions.yaml`:
```yaml
assertions:
  - id: bidder-winner-candidates-healthy
    queryId: bidder-winner-candidates
    condition: value > 0
    severity: critical
    message: "Bidder winner candidates dropped to zero"
```
APIs: `GET/POST /api/assertions`, `POST /api/assertions/:id/run`, `POST /api/assertions/run-all`
UI: new "Health" tab in Studio sidebar showing pass/fail/warning per assertion.
