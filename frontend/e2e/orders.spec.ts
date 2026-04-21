import { test, expect } from '@playwright/test'

test.describe('订单列表（鉴权后）', () => {
  test('打开 /orders 可见筛选与表格区', async ({ page }) => {
    await page.goto('/orders', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: '筛选' })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('table').first()).toBeVisible()
  })
})
