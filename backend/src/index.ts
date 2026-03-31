import express from 'express'
import cors from 'cors'
import { initDb } from './db/index.js'
import { productRouter } from './routes/products.js'
import { siteRouter } from './routes/sites.js'
import { orderRouter } from './routes/orders.js'
import { supplierRouter } from './routes/suppliers.js'
import { settingsRouter } from './routes/settings.js'

async function main() {
  await initDb()
  console.log('Database initialized')

  const app = express()
  /** 默认 3002：避免与本机已占用 3001 的旧 API 进程冲突（旧进程常无 /catalog 路由导致 404） */
  const PORT = process.env.PORT || 3002

  app.use(cors())
  app.use(express.json())

  app.use('/api/v1/product', productRouter)
  app.use('/api/v1/sites', siteRouter)
  app.use('/api/v1/orders', orderRouter)
  app.use('/api/v1/suppliers', supplierRouter)
  app.use('/api/v1/settings', settingsRouter)

  app.get('/api/health', (_req, res) => {
    res.json({ code: 200, message: 'ok', data: { status: 'healthy' } })
  })

  app.listen(PORT, () => {
    console.log(`Vaultcare API running on http://localhost:${PORT}`)
    console.log(
      `[vaultcare] 图册: GET /api/v1/product/catalog?audience=him|her — 自检: GET /api/v1/product/catalog-health`,
    )
  })
}

main().catch(console.error)
