import { test as setup, expect } from '@playwright/test'

/** 登录并写入 storageState，供 orders 等用例复用 */
setup('authenticate', async ({ page }) => {
  const user = process.env.E2E_USERNAME
  const pass = process.env.E2E_PASSWORD
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
  if (!user || !pass) {
    throw new Error('缺少 E2E_USERNAME / E2E_PASSWORD（请配置 frontend/.env.e2e）')
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').fill(user)
  await page.locator('#password').fill(pass)
  await page.getByRole('button', { name: '登录' }).click()

  const outcome = await Promise.race([
    page.waitForURL(/\/orders/, { timeout: 28_000 }).then(() => 'ok' as const),
    page.locator('.bg-red-50').waitFor({ state: 'visible', timeout: 28_000 }).then(() => 'err' as const),
  ]).catch(() => 'timeout' as const)

  if (outcome === 'err') {
    const txt = (await page.locator('.bg-red-50').innerText()).trim()
    throw new Error(
      `登录失败: ${txt}。请确认 ${base} 上已存在该账号（操作员或分销商）；若为新环境可先 POST /api/v1/auth/init-admin 创建首个操作员。当前 E2E_USERNAME=${user}`,
    )
  }
  if (outcome === 'timeout') {
    throw new Error(`登录后未跳转 /orders，也未出现错误提示。请检查 ${base} 网络与接口。`)
  }

  await expect(page).toHaveURL(/\/orders/)
  await page.context().storageState({ path: 'e2e/.auth/user.json' })
})
