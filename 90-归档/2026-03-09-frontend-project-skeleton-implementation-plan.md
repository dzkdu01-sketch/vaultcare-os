# Frontend Project Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Status:** Completed
> **Execution progress:** 18 / 18 tasks completed (100%)
> **Last updated:** 2026-03-10

**Goal:** Build a high-fidelity Vaultcare frontend project skeleton with login, protected routing, mock-driven core pages, shared layout, and reusable UI foundations aligned to the approved design system.

**Architecture:** The repository is currently documentation-only, so implementation starts by creating a standalone frontend application under `frontend/`. The app should be a single-page React application using route-level pages, shared app/layout infrastructure, module-oriented business organization, and a service boundary that allows mock services to be swapped for real APIs later without rewriting page composition.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, React Router, Vitest, React Testing Library

---

## Progress Snapshot

### Completed batches

#### Batch 1 completed
- Task 1: Bootstrap the frontend application
- Task 2: Add app providers, router shell, and route smoke test
- Task 3: Implement auth store and protected route guard

Associated commits:
- `5d3120f` `chore: bootstrap frontend app`
- `a61d477` `feat: add app router shell`
- `40afec9` `feat: add auth guard and login flow`

#### Batch 2 completed
- Task 4: Create the shared AppShell and sidebar navigation
- Task 5: Add design tokens, status mappings, and StatusBadge tests
- Task 6: Create shared page primitives for cards, headers, filters, and table shell

Current implementation notes:
- `frontend/node_modules/` has been added to ignore rules to avoid polluting later commits.
- The router currently wires `/dashboard` through `ProtectedRoute` and `AppShell`.
- Shared foundations now exist for navigation, status rendering, page sections, stat cards, empty states, and table rendering.

#### Batch 3 completed
- Task 7: Add mock data and service boundary for auth, dashboard, products, orders, distribution, and settings
- Task 8: Implement the dashboard page with mock KPIs and pending work cards
- Task 9: Implement the product list page with filters and centralized status rendering

Current implementation notes:
- Service boundary lives in `frontend/src/services/` with `app-services.ts`, `types.ts`, and `mock/index.ts`.
- All mock functions return deep copies to prevent shared-reference mutation across callers.
- Dashboard page uses `useEffect + isMounted` pattern; data loaded from `appServices.dashboard`.
- Product list page supports keyword/market/status filters with debounce; status column uses `StatusBadge`.
- `DataTable` updated to render `ReactNode` values (not `String()`), enabling rich cell content.
- `/products` route wired through `ProtectedRoute + AppShell`.
- 13 tests passing across 9 test files.

#### Batch 4 completed
- Task 10: Implement the product detail and product create pages
- Task 11: Implement the distribution list page and publish relation drawer shell
- Task 12: Implement the order list page with source/status filters

Current implementation notes:
- `ProductDetailPage` uses `useParams` + `appServices.products.getById(id)` with `useEffect + isMounted` pattern.
- `ProductCreatePage` renders a minimal form with SKU field and save button.
- `DistributionListPage` renders distribution rows with `StatusBadge` (domain="publish") and a drawer shell triggered by row action buttons.
- `OrderListPage` supports client-side source/status filtering with `StatusBadge` (domain="order").
- `/products/:id`, `/products/new`, `/distribution`, and `/orders` routes wired through `ProtectedRoute + AppShell`.
- 18 tests passing across 13 test files.

#### Batch 5 completed
- Task 13: Implement the order detail page with timeline and action area
- Task 14: Implement exception task and rejection task pages
- Task 15: Add settings index page and S1 AI configuration page shell

Current implementation notes:
- `OrderDetailPage` uses `useParams` + `appServices.orders.getById(id)` with sections 基本信息, 时间线, 操作区.
- `ExceptionTasksPage` and `RejectionTasksPage` filter orders client-side by status.
- `SettingsPage` is a simple index with a link to `/settings/ai-config`.
- `AiConfigPage` shows provider cards (Zone A) and routes table (Zone B) from mock data; Zone C is a placeholder.
- `/orders/exceptions`, `/orders/rejections`, `/orders/:id`, `/settings/ai-config`, `/settings` routes wired.
- 23 tests passing across 17 test files.

#### Batch 6 completed
- Task 16: Add loading, empty, and page-level error states across core pages
- Task 17: Add app-level smoke tests for the main journeys
- Task 18: Run full verification and document the skeleton handoff

Current implementation notes:
- `LoadingState` and `ErrorState` shared components created for consistent loading/error UX.
- `DashboardPage`, `ProductDetailPage`, `OrderDetailPage` updated with loading/error state handling.
- `ProductDetailPage` and `OrderDetailPage` now use `EmptyState` for not-found cases.
- 5 app-level smoke tests added covering auth redirect, products, orders, distribution, and AI config journeys.
- 33 tests passing across 19 test files.

### All batches completed

---

## 0. Reference Documents

Read these before implementing:

- `docs/plans/2026-03-09-frontend-project-skeleton-design.md`
- `20-方案设计/12-一期需求说明书.md`
- `20-方案设计/08-技术选型与回滚方案.md`
- `20-方案设计/design-system/MASTER.md`
- `docs/plans/2026-03-09-page-s1-ai-config-design.md`

Important constraints from the approved design:

- Create a single frontend app in `frontend/`
- Include login page, protected routes, and app shell
- Use mock data for the initial user journeys
- First-class modules: dashboard, products, distribution, orders, settings
- Key pages required in skeleton: dashboard, product list/detail/create, distribution list, order list/detail, exception tasks, rejection tasks, S1 AI config page
- Keep page layer thin and move business concerns into `modules/`
- Centralize status/market/role visual mappings

---

## Task Status Board

### Task 1: Bootstrap the frontend application
**Status:** Completed

### Task 2: Add app providers, router shell, and route smoke test
**Status:** Completed

### Task 3: Implement auth store and protected route guard
**Status:** Completed

### Task 4: Create the shared AppShell and sidebar navigation
**Status:** Completed

### Task 5: Add design tokens, status mappings, and StatusBadge tests
**Status:** Completed

### Task 6: Create shared page primitives for cards, headers, filters, and table shell
**Status:** Completed

### Task 7: Add mock data and service boundary for auth, dashboard, products, orders, distribution, and settings
**Status:** Completed

### Task 8: Implement the dashboard page with mock KPIs and pending work cards
**Status:** Completed

### Task 9: Implement the product list page with filters and centralized status rendering
**Status:** Completed

### Task 10: Implement the product detail and product create pages
**Status:** Completed

### Task 11: Implement the distribution list page and publish relation drawer shell
**Status:** Completed

### Task 12: Implement the order list page with source/status filters
**Status:** Completed

### Task 13: Implement the order detail page with timeline and action area
**Status:** Completed

### Task 14: Implement exception task and rejection task pages
**Status:** Completed

### Task 15: Add settings index page and S1 AI configuration page shell
**Status:** Completed

### Task 16: Add loading, empty, and page-level error states across core pages
**Status:** Completed

### Task 17: Add app-level smoke tests for the main journeys
**Status:** Completed

### Task 18: Run full verification and document the skeleton handoff
**Status:** Completed

---

## Notes for Implementation

- Do not create backend code as part of this frontend skeleton plan.
- Keep mock data and adapters simple; do not add generic API frameworks before the first real endpoint exists.
- Prefer composition over abstraction. If only one page uses a component, keep it inside that module.
- When adding shadcn/ui wrappers, only add the components actually used by pages in this plan.
- Use Chinese labels in the UI where the approved design and existing docs are Chinese.
- Use exact status labels and colors from `20-方案设计/design-system/MASTER.md:77`, `20-方案设计/design-system/MASTER.md:89`, and `20-方案设计/design-system/MASTER.md:105`.
- Keep the system settings S1 page aligned with `docs/plans/2026-03-09-page-s1-ai-config-design.md:17`.

## Next Step

All 18 tasks completed. The frontend skeleton is ready for handoff.
