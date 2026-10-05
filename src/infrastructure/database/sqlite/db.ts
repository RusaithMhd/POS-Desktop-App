import { drizzle } from 'drizzle-orm/sql-js';
import initSqlJs, { Database } from 'sql.js';
import * as schema from './schema';
import { seedInitialData, ensurePermissionsMigrated, seedAccountingData } from './seed';
import { isDesktopApp, readDbFromDiskNative, saveDbToDiskNative } from '@/lib/electronBridge';

let rawDb: Database | null = null;
let drizzleDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let isInitializing = false;

const DB_STORAGE_KEY = 'triwyn_pos_sqlite_db_v1';

export async function getLocalDb() {
  if (drizzleDb) return drizzleDb;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (drizzleDb) return drizzleDb;
  }

  isInitializing = true;

  try {
    const SQL = await initSqlJs({
      locateFile: (file) => {
        // Node / Vitest execution environment
        if (typeof process !== 'undefined' && process.versions && process.versions.node && !process.browser) {
          try {
            const path = require('path');
            return path.join(process.cwd(), 'public', file);
          } catch {
            return file;
          }
        }
        // Real browser client execution
        return `/${file}`;
      },
    });

    let savedData: Uint8Array | null = null;

    // 1. Try Desktop Native Disk Persistence First
    if (isDesktopApp()) {
      try {
        savedData = await readDbFromDiskNative();
      } catch (e) {
        console.warn('Native disk DB read attempt failed, falling back to localStorage', e);
      }
    }

    // 2. Fallback to LocalStorage
    if (!savedData && typeof window !== 'undefined' && window.localStorage) {
      const b64 = localStorage.getItem(DB_STORAGE_KEY);
      if (b64) {
        try {
          const binaryStr = atob(b64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          savedData = bytes;
        } catch (e) {
          console.error('Failed to load saved SQLite database from localStorage', e);
        }
      }
    }

    if (savedData) {
      rawDb = new SQL.Database(savedData);
      ensurePermissionsMigrated(rawDb);
      ensureOpeningBatchesExist(rawDb);
    } else {
      rawDb = new SQL.Database();
      createTables(rawDb);
      seedInitialData(rawDb);
      ensureOpeningBatchesExist(rawDb);
      saveDatabaseToStorage(rawDb);
    }

    drizzleDb = drizzle(rawDb, { schema });
    return drizzleDb;
  } catch (error) {
    console.error('SQLite initialization failed:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

export function saveLocalDbState() {
  if (rawDb) {
    saveDatabaseToStorage(rawDb);
  }
}

export function getRawSqlDb(): Database {
  if (!rawDb) {
    throw new Error('Database not initialized yet.');
  }
  return rawDb;
}

export function setTestRawSqlDb(testDb: Database) {
  rawDb = testDb;
  ensureOpeningBatchesExist(testDb);
}

function saveDatabaseToStorage(db: Database) {
  try {
    const binary = db.export();

    // 1. Native Desktop Disk Storage
    if (isDesktopApp()) {
      saveDbToDiskNative(binary).catch((err) => {
        console.error('Failed to write database to native disk:', err);
      });
    }

    // 2. LocalStorage Backup
    if (typeof window !== 'undefined' && window.localStorage) {
      let binaryStr = '';
      const len = binary.byteLength;
      for (let i = 0; i < len; i++) {
        binaryStr += String.fromCharCode(binary[i]);
      }
      const b64 = btoa(binaryStr);
      localStorage.setItem(DB_STORAGE_KEY, b64);
    }
  } catch (err) {
    console.error('Failed to save SQLite DB state:', err);
  }
}

function createTables(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tax_number TEXT,
      currency TEXT NOT NULL DEFAULT 'USD',
      currency_symbol TEXT NOT NULL DEFAULT '$',
      address TEXT,
      phone TEXT,
      email TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      is_main INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS terminals (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      mac_address TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      module TEXT NOT NULL,
      action_type TEXT DEFAULT 'VIEW',
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT NOT NULL,
      pin_hash TEXT,
      full_name TEXT NOT NULL,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      last_activity TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      business_id TEXT,
      branch_id TEXT,
      terminal_id TEXT,
      user_id TEXT,
      user_name TEXT,
      role_name TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_type TEXT,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      new_values TEXT,
      reason TEXT,
      authorizer_id TEXT,
      authorizer_name TEXT,
      device_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS approval_rules (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      min_value REAL NOT NULL DEFAULT 0,
      max_value REAL NOT NULL DEFAULT 0,
      required_role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      category_id TEXT,
      unit_id TEXT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT,
      brand TEXT,
      description TEXT,
      cost_price REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL,
      wholesale_price REAL,
      tax_rate REAL NOT NULL DEFAULT 0,
      stock_quantity REAL NOT NULL DEFAULT 0,
      min_stock_level REAL NOT NULL DEFAULT 5,
      reorder_level REAL NOT NULL DEFAULT 10,
      track_inventory INTEGER NOT NULL DEFAULT 1,
      track_expiry INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock_quantity REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS product_barcodes (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      barcode TEXT NOT NULL UNIQUE,
      is_primary INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      tax_id TEXT,
      credit_limit REAL NOT NULL DEFAULT 0,
      current_credit REAL NOT NULL DEFAULT 0,
      loyalty_points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_addresses (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      city TEXT,
      postal_code TEXT,
      is_default INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      company_name TEXT,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      tax_id TEXT,
      tax_number TEXT,
      payment_terms TEXT DEFAULT '30 Days',
      credit_limit REAL NOT NULL DEFAULT 0,
      opening_balance REAL NOT NULL DEFAULT 0,
      current_outstanding REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      supplier_id TEXT REFERENCES suppliers(id),
      purchase_id TEXT REFERENCES purchases(id),
      purchase_item_id TEXT,
      batch_number TEXT NOT NULL,
      supplier_batch_number TEXT,
      unit_cost REAL NOT NULL,
      quantity_received REAL NOT NULL,
      quantity_remaining REAL NOT NULL,
      manufacturing_date TEXT,
      expiry_date TEXT,
      received_date TEXT NOT NULL,
      warehouse_id TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_batch_transactions (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES inventory_batches(id),
      transaction_type TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      quantity_in REAL NOT NULL DEFAULT 0,
      quantity_out REAL NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL,
      balance_quantity REAL NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_item_batch_allocations (
      id TEXT PRIMARY KEY,
      sale_item_id TEXT NOT NULL REFERENCES sale_items(id),
      batch_id TEXT NOT NULL REFERENCES inventory_batches(id),
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      purchase_id TEXT REFERENCES purchases(id),
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      reference_number TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      payment_status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      reserved_quantity REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      movement_type TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      quantity_change REAL NOT NULL,
      previous_quantity REAL NOT NULL,
      new_quantity REAL NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_registers (
      id TEXT PRIMARY KEY,
      terminal_id TEXT NOT NULL,
      name TEXT NOT NULL,
      opening_balance REAL NOT NULL DEFAULT 0,
      current_balance REAL NOT NULL DEFAULT 0,
      is_open INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cashier_shifts (
      id TEXT PRIMARY KEY,
      terminal_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_cash REAL NOT NULL,
      closing_cash_expected REAL,
      closing_cash_actual REAL,
      cash_difference REAL,
      total_sales REAL NOT NULL DEFAULT 0,
      total_refunds REAL NOT NULL DEFAULT 0,
      total_cash_in REAL NOT NULL DEFAULT 0,
      total_cash_out REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
      id TEXT PRIMARY KEY,
      shift_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      reference TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      shift_id TEXT,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      description TEXT NOT NULL,
      receipt_ref TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS discounts (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      discount_type TEXT NOT NULL,
      value REAL NOT NULL,
      min_purchase_amount REAL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS taxes (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      rate REAL NOT NULL,
      is_inclusive INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      client_transaction_id TEXT NOT NULL UNIQUE,
      business_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      customer_id TEXT,
      shift_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL UNIQUE,
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      change_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      notes TEXT,
      deleted_at TEXT,
      deleted_by TEXT,
      delete_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      quantity REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_payments (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      payment_method_id TEXT NOT NULL,
      method_code TEXT NOT NULL,
      amount REAL NOT NULL,
      reference_number TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      customer_id TEXT,
      return_number TEXT NOT NULL UNIQUE,
      total_refund_amount REAL NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      sale_item_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      refund_amount REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      client_transaction_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      error_message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      sync_queue_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      client_payload TEXT NOT NULL,
      server_payload TEXT NOT NULL,
      resolution_strategy TEXT,
      resolved_at TEXT,
      resolved_by TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      id TEXT PRIMARY KEY,
      terminal_id TEXT NOT NULL,
      last_successful_sync TEXT,
      server_version TEXT,
      status TEXT NOT NULL DEFAULT 'IDLE'
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'INFO',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      account_code TEXT NOT NULL UNIQUE,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      parent_id TEXT REFERENCES accounts(id),
      normal_balance TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_system_account INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      journal_number TEXT NOT NULL UNIQUE,
      transaction_date TEXT NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id TEXT,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'POSTED',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_lines (
      id TEXT PRIMARY KEY,
      journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS account_mappings (
      id TEXT PRIMARY KEY,
      mapping_key TEXT NOT NULL UNIQUE,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      updated_at TEXT NOT NULL
    );

    -- Index creation for high-speed POS search
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_sales_client_tx ON sales(client_transaction_id);
    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
    CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(account_code);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_number ON journal_entries(journal_number);
    CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
    CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
  `);

  try { db.run('ALTER TABLE sales ADD COLUMN deleted_at TEXT;'); } catch {}
  try { db.run('ALTER TABLE sales ADD COLUMN deleted_by TEXT;'); } catch {}
  try { db.run('ALTER TABLE sales ADD COLUMN delete_reason TEXT;'); } catch {}

  try { db.run('ALTER TABLE suppliers ADD COLUMN code TEXT;'); } catch {}
  try { db.run('ALTER TABLE suppliers ADD COLUMN company_name TEXT;'); } catch {}
  try { db.run('ALTER TABLE suppliers ADD COLUMN tax_number TEXT;'); } catch {}
  try { db.run('ALTER TABLE suppliers ADD COLUMN payment_terms TEXT DEFAULT "30 Days";'); } catch {}
  try { db.run('ALTER TABLE suppliers ADD COLUMN credit_limit REAL DEFAULT 0;'); } catch {}
  try { db.run('ALTER TABLE suppliers ADD COLUMN opening_balance REAL DEFAULT 0;'); } catch {}
  try { db.run('ALTER TABLE suppliers ADD COLUMN current_outstanding REAL DEFAULT 0;'); } catch {}
  try { db.run('ALTER TABLE suppliers ADD COLUMN status TEXT DEFAULT "ACTIVE";'); } catch {}
  try { db.run('ALTER TABLE suppliers ADD COLUMN notes TEXT;'); } catch {}

  seedAccountingData(db);
  ensureOpeningBatchesExist(db);
}

export function ensureOpeningBatchesExist(db: Database) {
  try {
    const now = new Date().toISOString();
    const prodStmt = db.prepare('SELECT id, name, sku, cost_price, stock_quantity, created_at FROM products WHERE stock_quantity > 0');
    const prodsToMigrate: Array<{ id: string; name: string; costPrice: number; stockQuantity: number; createdAt: string }> = [];
    while (prodStmt.step()) {
      const row = prodStmt.getAsObject();
      prodsToMigrate.push({
        id: row.id as string,
        name: row.name as string,
        costPrice: (row.cost_price as number) || 0,
        stockQuantity: (row.stock_quantity as number) || 0,
        createdAt: (row.created_at as string) || now,
      });
    }
    prodStmt.free();

    for (const prod of prodsToMigrate) {
      const batchCheck = db.prepare('SELECT COUNT(*) as cnt FROM inventory_batches WHERE product_id = :pId');
      batchCheck.bind({ ':pId': prod.id });
      let count = 0;
      if (batchCheck.step()) {
        count = (batchCheck.getAsObject().cnt as number) || 0;
      }
      batchCheck.free();

      if (count === 0) {
        const batchId = `batch-open-${prod.id}`;
        const batchNumber = `OPENING-000001`;
        db.run(
          `INSERT INTO inventory_batches (id, product_id, supplier_id, purchase_id, purchase_item_id, batch_number, supplier_batch_number, unit_cost, quantity_received, quantity_remaining, received_date, status, created_at, updated_at)
           VALUES (?, ?, NULL, NULL, NULL, ?, 'OPENING_STOCK', ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
          [
            batchId,
            prod.id,
            batchNumber,
            prod.costPrice,
            prod.stockQuantity,
            prod.stockQuantity,
            prod.createdAt,
            now,
            now,
          ]
        );

        db.run(
          `INSERT INTO inventory_batch_transactions (id, batch_id, transaction_type, reference_type, reference_id, quantity_in, quantity_out, unit_cost, balance_quantity, created_by, created_at)
           VALUES (?, ?, 'PURCHASE', 'opening_stock', ?, ?, 0, ?, ?, 'system', ?)`,
          [
            `tx-open-${prod.id}`,
            batchId,
            prod.id,
            prod.stockQuantity,
            prod.costPrice,
            prod.stockQuantity,
            now,
          ]
        );
      } else {
        const sumStmt = db.prepare('SELECT SUM(quantity_remaining) as total_rem FROM inventory_batches WHERE product_id = :pId AND status = "ACTIVE"');
        sumStmt.bind({ ':pId': prod.id });
        let totalRem = 0;
        if (sumStmt.step()) {
          totalRem = (sumStmt.getAsObject().total_rem as number) || 0;
        }
        sumStmt.free();

        if (prod.stockQuantity > totalRem) {
          const diff = prod.stockQuantity - totalRem;
          const openBatchCheck = db.prepare('SELECT id, quantity_remaining FROM inventory_batches WHERE product_id = :pId AND supplier_batch_number = "OPENING_STOCK" LIMIT 1');
          openBatchCheck.bind({ ':pId': prod.id });
          if (openBatchCheck.step()) {
            const ob = openBatchCheck.getAsObject();
            const newRem = ((ob.quantity_remaining as number) || 0) + diff;
            db.run('UPDATE inventory_batches SET quantity_remaining = ?, status = "ACTIVE", updated_at = ? WHERE id = ?', [newRem, now, ob.id]);
          } else {
            const batchId = `batch-open-${prod.id}-${Date.now()}`;
            db.run(
              `INSERT INTO inventory_batches (id, product_id, supplier_id, purchase_id, purchase_item_id, batch_number, supplier_batch_number, unit_cost, quantity_received, quantity_remaining, received_date, status, created_at, updated_at)
               VALUES (?, ?, NULL, NULL, NULL, 'OPENING-000001', 'OPENING_STOCK', ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
              [batchId, prod.id, prod.costPrice, diff, diff, now, now, now]
            );
          }
          openBatchCheck.free();
        }
      }
    }
  } catch (e) {
    console.error('Opening stock batch migration error:', e);
  }
}

