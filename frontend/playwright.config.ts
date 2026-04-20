import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const isCi = !!process.env.CI && process.env.CI !== 'false' && process.env.CI !== '0'

/**
 * E2E：默认对 http://localhost:5173
 * - 本地：若 5173 已有 dev，会复用（避免双开 Vite）
 * - CI：自动 `npm run dev`
 * - 若 webServer 总超时：先手动 `npm run dev`，再设 PW_NO_WEB_SERVER=1 仅跑测试
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 1 : undefined,
  reporter: isCi ? 'github' : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'zh-CN',
    viewport: { width: 1440, height: 900 },
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(process.env.PW_NO_WEB_SERVER === '1'
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: !isCi,
          timeout: 180_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      }),
})
