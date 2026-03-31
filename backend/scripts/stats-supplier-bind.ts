import { initDb, getDb } from '../src/db/index.js'

await initDb()
const db = getDb()
const a = db.get('SELECT COUNT(*) as c FROM products') as { c: number }
const b = db.get('SELECT COUNT(*) as c FROM product_supplier') as { c: number }
const c = db.get('SELECT COUNT(*) as c FROM supplier_products WHERE mapped_product_id IS NOT NULL') as { c: number }
console.log(JSON.stringify({ products: a.c, product_supplier: b.c, supplier_products_mapped: c.c }, null, 0))
