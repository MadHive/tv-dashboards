# Astro Migration Plan - TDD Approach

## Overview
Migrating TV Dashboards from vanilla JS to Astro + React with **Test-Driven Development**.

## Architecture

### Backend (Keep as-is)
- ✅ Bun + Elysia.js (port 3000)
- ✅ YAML config storage
- ✅ All existing API routes
- ✅ Query persistence system

### Frontend (New)
- **Framework:** Astro 5 + React 19
- **Styling:** Tailwind CSS 4
- **State:** Nanostores
- **Drag & Drop:** @dnd-kit/core
- **Testing:** Vitest + React Testing Library
- **Build:** Static files served by Elysia

## Development Flow

```
1. Astro dev (port 4321) → for frontend development
2. Build: bun run build → outputs to /public-astro
3. Elysia serves /public-astro → single server on port 3000
```

## TDD Approach (Following Elysia Patterns)

### Testing Stack
```bash
- Vitest (unit tests)
- React Testing Library (component tests)
- Playwright (E2E tests)
```

### Test Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── Widget.tsx
│   │   └── Widget.test.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── api.test.ts
│   └── stores/
│       ├── dashboard.ts
│       └── dashboard.test.ts
└── vitest.config.ts
```

## Implementation Phases

### Phase 1: Setup & Testing Infrastructure (30 min)
- [x] Create Astro project
- [x] Install dependencies
- [ ] Set up Vitest
- [ ] Configure React Testing Library
- [ ] Write first test (smoke test)

### Phase 2: Core Components with TDD (2-3 hours)
**For each component:**
1. Write test first
2. Implement component
3. Test passes
4. Refactor if needed

Components:
- [ ] TopBar component
- [ ] BottomNav component
- [ ] DashboardGrid component
- [ ] Widget base component

### Phase 3: Widget Types with TDD (2-3 hours)
Test each widget type:
- [ ] BigNumber widget
- [ ] StatCard widget
- [ ] Gauge widget
- [ ] Chart widgets
- [ ] Map widget

### Phase 4: Editor with TDD (3-4 hours)
- [ ] WidgetPalette component
- [ ] PropertyPanel component
- [ ] Drag & drop functionality
- [ ] Save/discard logic

### Phase 5: Integration (1-2 hours)
- [ ] API integration tests
- [ ] E2E tests with Playwright
- [ ] Build and serve from Elysia
- [ ] Performance testing

## API Client (TypeScript)

```typescript
// src/lib/api.ts
export interface DashboardConfig {
  dashboards: Dashboard[];
  global: GlobalConfig;
}

export interface Dashboard {
  id: string;
  name: string;
  grid: { columns: number; rows: number; gap: number };
  widgets: Widget[];
}

export const fetchDashboardConfig = async (): Promise<DashboardConfig> => {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
};

export const updateDashboard = async (
  id: string,
  dashboard: Dashboard
): Promise<void> => {
  const res = await fetch(`/api/dashboards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dashboard),
  });
  if (!res.ok) throw new Error('Failed to update dashboard');
};
```

## State Management (Nanostores)

```typescript
// src/stores/dashboard.ts
import { atom, computed } from 'nanostores';
import type { DashboardConfig } from '../lib/api';

export const $config = atom<DashboardConfig | null>(null);
export const $currentPage = atom<number>(0);
export const $isEditMode = atom<boolean>(false);

export const $currentDashboard = computed(
  [$config, $currentPage],
  (config, page) => config?.dashboards[page] ?? null
);
```

## Build & Deploy

```bash
# Development
cd frontend
bun run dev  # Port 4321

# Build for production
cd frontend
bun run build  # Outputs to ../public-astro

# Update Elysia to serve Astro build
# server/index.js - change static file directory to public-astro
```

## Testing Commands

```bash
# Run unit tests
bun test

# Run tests in watch mode
bun test:watch

# Run E2E tests
bun test:e2e

# Coverage
bun test:coverage
```

## Migration Checklist

- [ ] Phase 1: Setup complete
- [ ] Phase 2: Core components tested & working
- [ ] Phase 3: All widget types tested & working
- [ ] Phase 4: Editor tested & working
- [ ] Phase 5: Integration tests passing
- [ ] Update Elysia to serve Astro build
- [ ] Deploy and verify
- [ ] Archive old vanilla JS code

## Rollback Plan

If issues arise:
1. Keep old /public directory intact
2. Serve from /public-astro vs /public via env variable
3. Easy switch back if needed
