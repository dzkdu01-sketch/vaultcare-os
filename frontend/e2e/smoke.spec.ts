import { test, expect } from '@playwright/test'

test.describe('登录页', () => {
  test('应展示 Vaultcare 标题与账号输入', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toContainText('Vaultcare')
    await expect(page.locator('#username')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  })
})
