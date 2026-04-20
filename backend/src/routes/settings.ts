import { Router, Request, Response } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const settingsRouter = Router()

function respond(res: Response, data: unknown, code = 200) { res.status(code).json({ code, message: 'ok', data }) }
function respondError(res: Response, message: string, code = 400) { res.status(code).json({ code, message, data: null }) }

settingsRouter.use(requireAuth, requireRole('operator'))

// GET /settings
settingsRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb()
  const rows = db.all('SELECT key, value FROM settings')
  const settings: Record<string, string> = {}
  for (const row of rows) {
    settings[row.key as string] = row.value as string
  }
  respond(res, settings)
})

// PUT /settings/:key
settingsRouter.put('/:key', (req: Request, res: Response) => {
  const { key } = req.params
  const { value } = req.body
  if (value === undefined || value === null) return respondError(res, '缺少 value 字段')

  const db = getDb()
  db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
    [key, String(value), String(value)]
  )
  respond(res, { key, value: String(value) })
})
