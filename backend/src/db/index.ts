import initSqlJs from 'sql.js'
type SqlJsDatabase = any
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'vaultcare.db')

export interface DbWrapper {
  run(sql: string, params?: unknown[]): void
  get(sql: string, params?: unknown[]): Record<string, unknown> | undefined
  all(sql: string, params?: unknown[]): Record<string, unknown>[]
  exec(sql: string): void
}

let wrapper: DbWrapper | null = null

function createWrapper(raw: SqlJsDatabase): DbWrapper {
  function save() {
    const data = raw.export()
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(DB_PATH, Buffer.from(data))
  }

  return {
    run(sql: string, params: unknown[] = []) {
      raw.run(sql, params as any)
      save()
    },
    get(sql: string, params: unknown[] = []) {
      const stmt = raw.prepare(sql)
      stmt.bind(params as any)
      let result: Record<string, unknown> | undefined
      if (stmt.step()) {
        result = stmt.getAsObject() as Record<string, unknown>
      }
      stmt.free()
      return result
    },
    all(sql: string, params: unknown[] = []) {
      const stmt = raw.prepare(sql)
      stmt.bind(params as any)
      const results: Record<string, unknown>[] = []
      while (stmt.step()) {
        results.push(stmt.getAsObject() as Record<string, unknown>)
      }
      stmt.free()
      return results
    },
    exec(sql: string) {
      raw.exec(sql)
      save()
    }
  }
}

export async function initDb(): Promise<DbWrapper> {
  const SQL = await initSqlJs()

  let raw: SqlJsDatabase
  if (fs.existsSync(DB_PATH)) {
    const data = fs.readFileSync(DB_PATH)
    raw = new SQL.Database(data)
  } else {
    raw = new SQL.Database()
  }

  raw.run('PRAGMA journal_mode = WAL')
  raw.run('PRAGMA foreign_keys = ON')

  function addColumnIfMissing(table: string, column: string, definition: string) {
    const stmt = raw.prepare(`PRAGMA table_info(${table})`)
    let found = false
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      if (row.name === column) { found = true; break }
    }
    stmt.free()
    if (!found) {
      raw.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
  }

  raw.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      consumer_key TEXT NOT NULL,
      consumer_secret TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      short_description TEXT,
      description TEXT,
      sale_price REAL DEFAULT 0,
      regular_price REAL DEFAULT 0,
      category TEXT,
      tags TEXT DEFAULT '[]',
      images TEXT DEFAULT '[]',
      status INTEGER DEFAULT 1,
      catalog_in INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      woo_product_id INTEGER,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      last_synced_at TEXT,
      error TEXT,
      UNIQUE(product_id, site_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      woo_order_id INTEGER NOT NULL,
      order_number TEXT,
      status TEXT NOT NULL,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      customer_whatsapp TEXT,
      payment_method TEXT,
      total TEXT,
      currency TEXT DEFAULT 'AED',
      line_items TEXT DEFAULT '[]',
      shipping_address TEXT,
      billing_address TEXT,
      date_created TEXT,
      date_modified TEXT,
      pulled_at TEXT NOT NULL,
      UNIQUE(site_id, woo_order_id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code_prefix TEXT,
      contact TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      supplier_code TEXT NOT NULL,
      product_name TEXT NOT NULL,
      cost_price_aed REAL,
      mapped_product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      import_batch_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(supplier_id, supplier_code)
    );

    CREATE TABLE IF NOT EXISTS product_supplier (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      supplier_code TEXT NOT NULL,
      cost_price REAL,
      note TEXT,
      UNIQUE(product_id, supplier_id)
    );

    CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_products_mapped_product ON supplier_products(mapped_product_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_products_code ON supplier_products(supplier_code);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_product_sync_product ON product_sync(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_sync_site ON product_sync(site_id);
    CREATE INDEX IF NOT EXISTS idx_orders_site ON orders(site_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_product_supplier_product ON product_supplier(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_supplier_supplier ON product_supplier(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_product_supplier_code ON product_supplier(supplier_code);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('exchange_rate', '1.95');
  `)

  {
    const stmt = raw.prepare('PRAGMA table_info(products)')
    let hasCatalogIn = false
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      if (row.name === 'catalog_in') {
        hasCatalogIn = true
        break
      }
    }
    stmt.free()
    if (!hasCatalogIn) {
      raw.run('ALTER TABLE products ADD COLUMN catalog_in INTEGER NOT NULL DEFAULT 0')
    }
  }

  // --- Migration: distributors, operators, order_number_seq, order_status_log ---
  raw.exec(`
    CREATE TABLE IF NOT EXISTS distributors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      site_display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_number_seq (
      date_key TEXT NOT NULL,
      distributor_id INTEGER NOT NULL REFERENCES distributors(id),
      last_seq INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date_key, distributor_id)
    );

    CREATE TABLE IF NOT EXISTS order_status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      field TEXT NOT NULL,
      from_value TEXT,
      to_value TEXT,
      changed_by TEXT NOT NULL,
      note TEXT,
      changed_at TEXT NOT NULL
    );
  `)

  // --- Migration: add columns to sites ---
  addColumnIfMissing('sites', 'distributor_id', 'TEXT')
  addColumnIfMissing('sites', 'webhook_secret', 'TEXT')
  addColumnIfMissing('distributors', 'site_display_name', 'TEXT')

  // --- Migration: add columns to orders ---
  addColumnIfMissing('orders', 'distributor_id', 'INTEGER')
  addColumnIfMissing('orders', 'source', "TEXT DEFAULT 'woo_webhook'")
  addColumnIfMissing('orders', 'created_by_role', "TEXT DEFAULT 'system'")
  addColumnIfMissing('orders', 'created_by_id', 'INTEGER')
  addColumnIfMissing('orders', 'customer_city', 'TEXT')
  addColumnIfMissing('orders', 'customer_address', 'TEXT')
  addColumnIfMissing('orders', 'order_status', "TEXT DEFAULT 'unconfirmed'")
  addColumnIfMissing('orders', 'delivery_status', "TEXT DEFAULT 'not_submitted'")
  addColumnIfMissing('orders', 'item_summary', 'TEXT')
  addColumnIfMissing('orders', 'expedited_fee', 'REAL DEFAULT 0')
  addColumnIfMissing('orders', 'note', 'TEXT')
  addColumnIfMissing('orders', 'woo_raw_data', 'TEXT')
  addColumnIfMissing('orders', 'reviewed_by', 'INTEGER')
  addColumnIfMissing('orders', 'settlement_amount', 'REAL')
  addColumnIfMissing('orders', 'settlement_status', 'TEXT')
  addColumnIfMissing('orders', 'settlement_note', 'TEXT')
  addColumnIfMissing('orders', 'routed_supplier_id', 'INTEGER')
  addColumnIfMissing('orders', 'routing_reason', 'TEXT')

  // --- Migration: new indexes ---
  raw.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_distributor ON orders(distributor_id);
    CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
    CREATE INDEX IF NOT EXISTS idx_sites_distributor ON sites(distributor_id);
    CREATE INDEX IF NOT EXISTS idx_order_status_log_order ON order_status_log(order_id);

    CREATE TABLE IF NOT EXISTS product_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributor_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(distributor_id, product_id)
    );
  `)

  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DB_PATH, Buffer.from(raw.export()))

  wrapper = createWrapper(raw)
  return wrapper
}

export function getDb(): DbWrapper {
  if (!wrapper) throw new Error('Database not initialized. Call initDb() first.')
  return wrapper
}
