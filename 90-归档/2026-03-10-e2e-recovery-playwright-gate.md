# E2E Recovery and Playwright Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the missing frontend E2E assets, execute the Playwright gate end-to-end, and produce a verifiable final release decision alongside the already-passing Vitest and build checks.

**Architecture:** Recreate the Playwright test harness inside `frontend/e2e` using the mock-scenario injection model already wired through localStorage/sessionStorage in the frontend app. Keep the implementation aligned with the existing page contracts (`ProductListPage`, `OrderListPage`, auth routing, settings/distribution pages) and validate each flow incrementally with focused Playwright runs before the final full-gate execution.

**Tech Stack:** React 19, Vite 6, Vitest 3, Playwright, TypeScript, localStorage/sessionStorage-based mock service scenarios.

---

### Task 1: Restore Playwright project wiring

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/playwright.config.ts`
- Test: `frontend/package-lock.json`

**Step 1: Write the failing test expectation**

Expected missing behavior:
- `npm run test:e2e -- --list` fails because `package.json` has no E2E script and the frontend has no Playwright config.

**Step 2: Run test to verify it fails**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npm run test:e2e -- --list`
Expected: npm script missing or Playwright cannot discover tests.

**Step 3: Write minimal implementation**

Add scripts and dependency in `frontend/package.json`:

```json
{
  "scripts": {
    "test": "vitest --config vite.config.ts",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:install": "playwright install chromium"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2"
  }
}
```

Create `frontend/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  reporter: 'line',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

**Step 4: Run test to verify it passes**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npm install && npm run test:e2e -- --list`
Expected: Playwright starts and discovers `e2e/*.spec.ts` once later tasks create them.

**Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/playwright.config.ts
git commit -m "test: restore playwright project wiring"
```

### Task 2: Restore E2E helpers for auth, app navigation, and scenario injection

**Files:**
- Create: `frontend/e2e/helpers/auth.ts`
- Create: `frontend/e2e/helpers/app.ts`
- Create: `frontend/e2e/helpers/scenario.ts`
- Test: `frontend/e2e/helpers/*.ts`

**Step 1: Write the failing test**

Create helper-level smoke via spec usage expectation:
- calling `signIn(page)` should use the login form labels `账号`, `密码`, and `登录`
- calling `setScenario(page, ...)` should populate `vaultcare_e2e_scenarios`
- calling `clearSession(page)` should remove `vaultcare_mock_user`

**Step 2: Run test to verify it fails**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npm run test:e2e -- --list`
Expected: helper imports in specs fail until files exist.

**Step 3: Write minimal implementation**

`frontend/e2e/helpers/auth.ts`:

```ts
import type { Page } from '@playwright/test'

const SESSION_KEY = 'vaultcare_mock_user'

export async function clearSession(page: Page) {
  await page.addInitScript(([key]) => window.sessionStorage.removeItem(key), [SESSION_KEY])
}

export async function setSignedInSession(page: Page) {
  await page.addInitScript(([key]) => {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ id: 'qa-user', name: 'QA User', role: 'admin' }),
    )
  }, [SESSION_KEY])
}

export async function signIn(page: Page) {
  await page.getByLabel('账号').fill('admin')
  await page.getByLabel('密码').fill('123456')
  await page.getByRole('button', { name: '登录' }).click()
}
```

`frontend/e2e/helpers/scenario.ts`:

```ts
import type { Page } from '@playwright/test'

const KEY = 'vaultcare_e2e_scenarios'

export async function setScenario(page: Page, value: unknown) {
  await page.addInitScript(([key, payload]) => {
    window.localStorage.setItem(key, JSON.stringify(payload))
  }, [KEY, value])
}

export async function clearScenario(page: Page) {
  await page.addInitScript(([key]) => window.localStorage.removeItem(key), [KEY])
}
```

`frontend/e2e/helpers/app.ts`:

```ts
import type { Page } from '@playwright/test'

export async function visit(page: Page, path: string) {
  await page.goto(path)
}
```

**Step 4: Run test to verify it passes**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npm run test:e2e -- --list`
Expected: helper imports resolve cleanly.

**Step 5: Commit**

```bash
git add frontend/e2e/helpers/auth.ts frontend/e2e/helpers/app.ts frontend/e2e/helpers/scenario.ts
git commit -m "test: restore e2e helper utilities"
```

### Task 3: Restore auth-route E2E coverage

**Files:**
- Create: `frontend/e2e/auth-routes.spec.ts`
- Modify: `frontend/e2e/helpers/auth.ts`
- Test: `frontend/src/modules/auth/tests/protected-route.test.tsx`

**Step 1: Write the failing test**

Create `frontend/e2e/auth-routes.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { clearSession, signIn } from './helpers/auth'
import { visit } from './helpers/app'

test('login enters protected page', async ({ page }) => {
  await visit(page, '/login')
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('unauthenticated user is redirected to login', async ({ page }) => {
  await clearSession(page)
  await visit(page, '/products')
  await expect(page).toHaveURL(/\/login$/)
})
```

**Step 2: Run test to verify it fails**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npx playwright test e2e/auth-routes.spec.ts --reporter=line`
Expected: FAIL until helpers and routing behavior line up.

**Step 3: Write minimal implementation**

Only if needed after failure analysis:
- ensure login page labels remain `账号` / `密码`
- ensure protected route redirects unauthenticated users to `/login`

**Step 4: Run test to verify it passes**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npx playwright test e2e/auth-routes.spec.ts --reporter=line`
Expected: 2 passed.

**Step 5: Commit**

```bash
git add frontend/e2e/auth-routes.spec.ts frontend/e2e/helpers/auth.ts
git commit -m "test: restore auth route e2e coverage"
```

### Task 4: Restore product happy/error E2E coverage

**Files:**
- Create: `frontend/e2e/products.spec.ts`
- Modify: `frontend/e2e/helpers/scenario.ts`
- Modify: `frontend/src/pages/products/ProductListPage.tsx` (only if a focused failure proves UI contract drift)
- Test: `frontend/src/pages/products/__tests__/product-list-page.test.tsx`

**Step 1: Write the failing test**

Create `frontend/e2e/products.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { setSignedInSession } from './helpers/auth'
import { visit } from './helpers/app'
import { clearScenario, setScenario } from './helpers/scenario'

test.beforeEach(async ({ page }) => {
  await setSignedInSession(page)
})

test('opens product detail from product list', async ({ page }) => {
  await clearScenario(page)
  await visit(page, '/products')
  await page.getByRole('cell', { name: 'VC-001' }).click()
  await expect(page).toHaveURL(/\/products\//)
})

test('shows empty state for unmatched product filter', async ({ page }) => {
  await setScenario(page, { productList: 'empty' })
  await visit(page, '/products')
  await expect(page.getByText('暂无数据')).toBeVisible()
})

test('shows error state when product list fails', async ({ page }) => {
  await setScenario(page, { productList: 'error' })
  await visit(page, '/products')
  await expect(page.getByText('加载失败，请刷新重试。')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npx playwright test e2e/products.spec.ts --reporter=line`
Expected: FAIL until selectors and scenario wiring are restored.

**Step 3: Write minimal implementation**

Only if targeted failures prove drift:
- restore `aria-label="关键词"` if selectors require it
- keep row-click navigation on product rows
- keep empty/error UI visible strings stable

**Step 4: Run test to verify it passes**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npx playwright test e2e/products.spec.ts --reporter=line`
Expected: 3 passed.

**Step 5: Commit**

```bash
git add frontend/e2e/products.spec.ts frontend/e2e/helpers/scenario.ts frontend/src/pages/products/ProductListPage.tsx
git commit -m "test: restore product e2e coverage"
```

### Task 5: Restore order happy/error E2E coverage

**Files:**
- Create: `frontend/e2e/orders.spec.ts`
- Modify: `frontend/src/pages/orders/OrderListPage.tsx` (only if focused failures show routing/state drift)
- Test: `frontend/src/pages/orders/__tests__/order-list-page.test.tsx`

**Step 1: Write the failing test**

Create `frontend/e2e/orders.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { setSignedInSession } from './helpers/auth'
import { visit } from './helpers/app'
import { clearScenario, setScenario } from './helpers/scenario'

test.beforeEach(async ({ page }) => {
  await setSignedInSession(page)
})

test('opens order detail from order list', async ({ page }) => {
  await clearScenario(page)
  await visit(page, '/orders')
  await page.getByRole('cell', { name: 'SO-1001' }).click()
  await expect(page).toHaveURL(/\/orders\//)
})

test('shows not found for illegal order detail', async ({ page }) => {
  await setScenario(page, { orderDetail: 'not_found' })
  await visit(page, '/orders/ord-404')
  await expect(page.getByText('订单不存在')).toBeVisible()
})

test('shows empty state for empty order list', async ({ page }) => {
  await setScenario(page, { orderList: 'empty' })
  await visit(page, '/orders')
  await expect(page.getByText('暂无数据')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npx playwright test e2e/orders.spec.ts --reporter=line`
Expected: FAIL until order empty/error/not-found contracts are restored.

**Step 3: Write minimal implementation**

Only if needed after failure analysis:
- keep row-click navigation on order rows
- keep order detail not-found messaging stable
- keep loading/error/empty states rendering correctly

**Step 4: Run test to verify it passes**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npx playwright test e2e/orders.spec.ts --reporter=line`
Expected: 3 passed.

**Step 5: Commit**

```bash
git add frontend/e2e/orders.spec.ts frontend/src/pages/orders/OrderListPage.tsx
git commit -m "test: restore order e2e coverage"
```

### Task 6: Restore settings/distribution happy/error E2E coverage

**Files:**
- Create: `frontend/e2e/settings-distribution.spec.ts`
- Modify: `frontend/src/pages/distribution/DistributionListPage.tsx` (only if focused failures prove UI contract drift)
- Modify: `frontend/src/pages/settings/AiConfigPage.tsx` (only if focused failures prove UI contract drift)
- Test: `frontend/src/pages/distribution/__tests__/distribution-list-page.test.tsx`
- Test: `frontend/src/pages/settings/__tests__/ai-config-page.test.tsx`

**Step 1: Write the failing test**

Create `frontend/e2e/settings-distribution.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { setSignedInSession } from './helpers/auth'
import { visit } from './helpers/app'
import { setScenario } from './helpers/scenario'

test.beforeEach(async ({ page }) => {
  await setSignedInSession(page)
})

test('renders distribution list and opens drawer', async ({ page }) => {
  await visit(page, '/distribution')
  await page.getByRole('button', { name: '查看' }).first().click()
  await expect(page.getByRole('heading', { name: '发布关系详情', level: 2 })).toBeVisible()
})

test('renders distribution empty state', async ({ page }) => {
  await setScenario(page, { distributionList: 'empty' })
  await visit(page, '/distribution')
  await expect(page.getByText('暂无数据')).toBeVisible()
})

test('renders distribution error state', async ({ page }) => {
  await setScenario(page, { distributionList: 'error' })
  await visit(page, '/distribution')
  await expect(page.getByText('加载失败，请刷新重试。')).toBeVisible()
})

test('renders ai config summary', async ({ page }) => {
  await visit(page, '/settings/ai-config')
  await expect(page.getByText('OpenAI')).toBeVisible()
})

test('renders ai config empty state', async ({ page }) => {
  await setScenario(page, { aiConfig: 'empty' })
  await visit(page, '/settings/ai-config')
  await expect(page.getByText('暂无数据')).toBeVisible()
})

test('renders ai config error state', async ({ page }) => {
  await setScenario(page, { aiConfig: 'error' })
  await visit(page, '/settings/ai-config')
  await expect(page.getByText('加载失败，请刷新重试。')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npx playwright test e2e/settings-distribution.spec.ts --reporter=line`
Expected: FAIL until distribution/settings state contracts are restored.

**Step 3: Write minimal implementation**

Only if needed after failure analysis:
- ensure distribution list supports empty/error rendering and drawer interaction
- ensure AI config page supports empty/error rendering with stable text

**Step 4: Run test to verify it passes**

Run: `cd "D:/cursor/vault-os1.1/frontend" && npx playwright test e2e/settings-distribution.spec.ts --reporter=line`
Expected: 6 passed.

**Step 5: Commit**

```bash
git add frontend/e2e/settings-distribution.spec.ts frontend/src/pages/distribution/DistributionListPage.tsx frontend/src/pages/settings/AiConfigPage.tsx
git commit -m "test: restore settings and distribution e2e coverage"
```

### Task 7: Run the final gate and issue the release decision

**Files:**
- Verify: `frontend/vite.config.ts`
- Verify: `frontend/e2e/**/*.spec.ts`
- Verify: `frontend/src/test/setup.ts`
- Verify: `frontend/src/services/mock/index.ts`
- Report: session response to user

**Step 1: Write the failing test expectation**

The release gate is incomplete until all three commands succeed fresh in the same worktree:
- Vitest
- Playwright
- Build

**Step 2: Run test to verify current status**

Run, in order:

```bash
cd "D:/cursor/vault-os1.1/frontend" && npm run test -- --run
cd "D:/cursor/vault-os1.1/frontend" && npx playwright test --reporter=line
cd "D:/cursor/vault-os1.1/frontend" && npm run build
```

Expected before full restoration: one or more failures indicating what still needs work.

**Step 3: Write minimal implementation**

Fix only the specific failing contract from the focused test output. Do not widen scope. Preserve already-confirmed user changes.

**Step 4: Run test to verify it passes**

Run, in order:

```bash
cd "D:/cursor/vault-os1.1/frontend" && npm run test -- --run
cd "D:/cursor/vault-os1.1/frontend" && npx playwright test --reporter=line
cd "D:/cursor/vault-os1.1/frontend" && npm run build
```

Expected:
- Vitest: all green
- Playwright: all green
- Build: exit 0

**Step 5: Commit**

```bash
git add frontend
git commit -m "test: complete frontend release gate coverage"
```
