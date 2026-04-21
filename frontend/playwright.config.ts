import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'

/** 加载 frontend/.env.e2e（不新增 dotenv 依赖） */
function loadEnvE2e() {
  const p = join(process.cwd(), '.env.e2e')
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvE2e()

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const isCi = !!process.env.CI && process.env.CI !== 'false' && process.env.CI !== '0'
const hasE2eCreds = !!(process.env.E2E_USERNAME && process.env.E2E_PASSWORD)

/** 仅当测本机 Vite 时自动起 dev；测 VPS 等远程地址时不启 webServer */
const shouldStartVite =
  process.env.PW_NO_WEB_SERVER !== '1' &&
  (baseURL.includes('localhost') || baseURL.includes('127.0.0.1'))

const authDir = join(process.cwd(), 'e2e', '.auth')
if (hasE2eCreds && !existsSync(authDir)) {
  mkdirSync(authDir, { recursive: true })
}

/**
 * E2E：
 * - 无 E2E_USERNAME/E2E_PASSWORD：只跑 smoke（登录壳）
 * - 有凭据：setup 登录 → orders.spec.ts 带 storageState
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
  projects: hasE2eCreds
    ? [
        { name: 'setup', testMatch: /auth\.setup\.ts$/ },
        {
          name: 'chromium',
          testMatch: /smoke\.spec\.ts$/,
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'chromium-authed',
          testMatch: /orders\.spec\.ts$/,
          dependencies: ['setup'],
          use: {
            ...devices['Desktop Chrome'],
            storageState: 'e2e/.auth/user.json',
          },
        },
      ]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(shouldStartVite
    ? {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: !isCi,
          timeout: 180_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      }
    : {}),
})
