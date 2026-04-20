import { getDb } from '../db/index.js'

/**
 * Generate order number in format: VC + MMDD + NN + distributor_code
 * Example: VC041507K = VC + Apr 15 + 7th order of the day + distributor code K
 */
export function generateOrderNumber(distributorId: number): string {
  const db = getDb()

  // Get distributor code
  const dist = db.get('SELECT code FROM distributors WHERE id = ?', [distributorId]) as any
  if (!dist) throw new Error(`Distributor ${distributorId} not found`)

  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateKey = `${mm}${dd}`

  // Atomic increment: INSERT or UPDATE the sequence
  const existing = db.get(
    'SELECT last_seq FROM order_number_seq WHERE date_key = ? AND distributor_id = ?',
    [dateKey, distributorId]
  ) as any

  let seq: number
  if (existing) {
    seq = (existing.last_seq as number) + 1
    db.run(
      'UPDATE order_number_seq SET last_seq = ? WHERE date_key = ? AND distributor_id = ?',
      [seq, dateKey, distributorId]
    )
  } else {
    seq = 1
    db.run(
      'INSERT INTO order_number_seq (date_key, distributor_id, last_seq) VALUES (?, ?, ?)',
      [dateKey, distributorId, seq]
    )
  }

  return `VC${dateKey}${String(seq).padStart(2, '0')}${dist.code}`
}
