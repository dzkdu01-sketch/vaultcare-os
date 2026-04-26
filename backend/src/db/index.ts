import Database from 'better-sqlite3'
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

type SqliteDb = InstanceType<typeof Database>

/** 底层连接，供 withTransaction 使用；在 initDb 完成前为 null。 */
let backingDb: SqliteDb | null = null

function createWrapper(db: SqliteDb): DbWrapper {
  return {
    run(sql: string, params: unknown[] = []) {
      db.prepare(sql).run(...(params as []))
    },
    get(sql: string, params: unknown[] = []) {
      return db.prepare(sql).get(...(params as [])) as Record<string, unknown> | undefined
    },
    all(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as [])) as Record<string, unknown>[]
    },
    exec(sql: string) {
      db.exec(sql)
    },
  }
}

function addColumnIfMissing(db: SqliteDb, table: string, column: string, definition: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (rows.some((r) => r.name === column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

function openAndMigrate(): SqliteDb {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const db = new Database(DB_PATH)
  backingDb = db

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
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

  addColumnIfMissing(db, 'products', 'catalog_in', 'INTEGER NOT NULL DEFAULT 0')

  db.exec(`
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

  addColumnIfMissing(db, 'sites', 'distributor_id', 'TEXT')
  addColumnIfMissing(db, 'sites', 'webhook_secret', 'TEXT')
  addColumnIfMissing(db, 'distributors', 'site_display_name', 'TEXT')

  addColumnIfMissing(db, 'orders', 'distributor_id', 'INTEGER')
  addColumnIfMissing(db, 'orders', 'source', "TEXT DEFAULT 'woo_webhook'")
  addColumnIfMissing(db, 'orders', 'created_by_role', "TEXT DEFAULT 'system'")
  addColumnIfMissing(db, 'orders', 'created_by_id', 'INTEGER')
  addColumnIfMissing(db, 'orders', 'customer_city', 'TEXT')
  addColumnIfMissing(db, 'orders', 'customer_address', 'TEXT')
  addColumnIfMissing(db, 'orders', 'order_status', "TEXT DEFAULT 'unconfirmed'")
  addColumnIfMissing(db, 'orders', 'delivery_status', "TEXT DEFAULT 'not_submitted'")
  addColumnIfMissing(db, 'orders', 'item_summary', 'TEXT')
  addColumnIfMissing(db, 'orders', 'expedited_fee', 'REAL DEFAULT 0')
  addColumnIfMissing(db, 'orders', 'note', 'TEXT')
  addColumnIfMissing(db, 'orders', 'woo_raw_data', 'TEXT')
  addColumnIfMissing(db, 'orders', 'reviewed_by', 'INTEGER')
  addColumnIfMissing(db, 'orders', 'settlement_amount', 'REAL')
  addColumnIfMissing(db, 'orders', 'settlement_status', 'TEXT')
  addColumnIfMissing(db, 'orders', 'settlement_note', 'TEXT')
  addColumnIfMissing(db, 'orders', 'routed_supplier_id', 'INTEGER')
  addColumnIfMissing(db, 'orders', 'routing_reason', 'TEXT')

  db.exec(`
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

  return db
}

export async function initDb(): Promise<DbWrapper> {
  if (wrapper) return Promise.resolve(wrapper)
  const db = openAndMigrate()
  wrapper = createWrapper(db)
  return wrapper
}

export function getDb(): DbWrapper {
  if (!wrapper) throw new Error('Database not initialized. Call initDb() first.')
  return wrapper
}

/**
 * 在单次事务中执行同步回调（例如订单拉取中连续多条写入），
 * 减少 fsync 次数。回调内须使用 getDb() 与平时相同；勿在回调内 await。
 */
export function withTransaction<T>(fn: () => T): T {
  if (!backingDb) throw new Error('Database not initialized. Call initDb() first.')
  return backingDb.transaction(fn)() as T
}
