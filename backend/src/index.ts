import express from 'express'
import cors from 'cors'
import { initDb } from './db/index.js'
import { productRouter } from './routes/products.js'
import { siteRouter } from './routes/sites.js'
import { orderRouter } from './routes/orders.js'
import { supplierRouter } from './routes/suppliers.js'
import { settingsRouter } from './routes/settings.js'
import { authRouter } from './routes/auth.js'
import { distributorRouter } from './routes/distributors.js'
import { operatorRouter } from './routes/operators.js'
import { webhookRouter } from './routes/webhooks.js'
import { favoriteRouter } from './routes/favorites.js'
import { startOrderSync } from './services/order-sync.js'

async function main() {
  await initDb()
  console.log('Database initialized')

  const app = express()
  const PORT = process.env.PORT || 3002

  app.use(cors())
  app.use(express.json({ limit: '5mb' }))

  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/distributors', distributorRouter)
  app.use('/api/v1/operators', operatorRouter)
  app.use('/api/v1/webhooks', webhookRouter)
  app.use('/api/v1/favorites', favoriteRouter)
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
    // 定时/启动时全站拉单默认关闭，减轻小机内存与对外请求，避免拖垮进程导致 Nginx 502。
    // 需要自动同步时：环境变量 ORDER_SYNC_ENABLED=true 后重启后端。
    if (process.env.ORDER_SYNC_ENABLED === 'true') {
      startOrderSync()
    } else {
      console.log('订单自动同步已关闭（未设置 ORDER_SYNC_ENABLED=true）；进订单页的「拉取」与 POST /orders/pull 仍可用')
    }
  })
}

main().catch(console.error)
