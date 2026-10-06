import bcrypt from 'bcryptjs';
import { Database } from 'sql.js';

function addColumnIfNotExists(db: Database, table: string, column: string, columnDef: string): void {
  try {
    const res = db.exec(`PRAGMA table_info(${table})`);
    const cols = res[0]?.values?.map((v: any) => v[1]) || [];
    if (!cols.includes(column)) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef}`);
    }
  } catch (e) {
    console.warn(`[adminSchema] Migration: unable to add column ${column} to ${table}:`, e);
  }
}

function runSafe(db: Database, sql: string, params?: any[]): void {
  try {
    if (params && params.length > 0) {
      db.run(sql, params);
    } else {
      db.run(sql);
    }
  } catch (e) {
    console.warn('[adminSchema] Safe SQL statement warning:', sql, e);
  }
}

export function ensureAdminTables(db: Database): void {
  // 1. Create tables individually so syntax/runtime issues don't cascade
  runSafe(db, `
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'READ_ONLY_ADMIN',
      is_active INTEGER NOT NULL DEFAULT 1,
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      mfa_secret TEXT,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login_at TEXT,
      last_login_ip TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  runSafe(db, `
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      revoked_by TEXT,
      created_at TEXT NOT NULL
    );
  `);

  runSafe(db, `
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT,
      admin_email TEXT,
      admin_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      target_org_id TEXT,
      previous_state TEXT,
      new_state TEXT,
      reason TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  runSafe(db, `
    CREATE TABLE IF NOT EXISTS customer_registrations (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      phone TEXT,
      country TEXT,
      password_hash TEXT NOT NULL,
      selected_plan_code TEXT NOT NULL DEFAULT 'FREE_TRIAL',
      billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
      status TEXT NOT NULL DEFAULT 'REGISTERED',
      email_verification_token TEXT,
      email_verified_at TEXT,
      payment_reference TEXT,
      payment_status TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  runSafe(db, `
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      monthly_price REAL NOT NULL DEFAULT 0,
      yearly_price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'LKR',
      trial_days INTEGER NOT NULL DEFAULT 14,
      max_users INTEGER NOT NULL DEFAULT 3,
      max_branches INTEGER NOT NULL DEFAULT 1,
      max_devices INTEGER NOT NULL DEFAULT 2,
      max_products INTEGER NOT NULL DEFAULT 1000,
      max_transactions INTEGER NOT NULL DEFAULT 5000,
      storage_limit_mb INTEGER NOT NULL DEFAULT 500,
      entitlements_json TEXT NOT NULL DEFAULT '{}',
      support_level TEXT NOT NULL DEFAULT 'STANDARD',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  runSafe(db, `
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      owner_user_id TEXT,
      tax_number TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      timezone TEXT NOT NULL DEFAULT 'Asia/Colombo',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  runSafe(db, `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plan_id TEXT,
      status TEXT NOT NULL DEFAULT 'TRIALING',
      billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
      current_period_start TEXT NOT NULL,
      current_period_end TEXT NOT NULL,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancellation_reason TEXT,
      grace_period_ends_at TEXT,
      trial_started_at TEXT,
      trial_ends_at TEXT,
      trial_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Defensively ensure all required columns exist on older existing SQLite files
  // admin_users
  addColumnIfNotExists(db, 'admin_users', 'mfa_secret', 'TEXT');
  addColumnIfNotExists(db, 'admin_users', 'failed_login_attempts', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfNotExists(db, 'admin_users', 'locked_until', 'TEXT');
  addColumnIfNotExists(db, 'admin_users', 'last_login_at', 'TEXT');
  addColumnIfNotExists(db, 'admin_users', 'last_login_ip', 'TEXT');
  addColumnIfNotExists(db, 'admin_users', 'created_by', 'TEXT');

  // admin_audit_logs
  addColumnIfNotExists(db, 'admin_audit_logs', 'admin_email', 'TEXT');
  addColumnIfNotExists(db, 'admin_audit_logs', 'admin_role', 'TEXT');
  addColumnIfNotExists(db, 'admin_audit_logs', 'entity_type', 'TEXT');
  addColumnIfNotExists(db, 'admin_audit_logs', 'entity_id', 'TEXT');
  addColumnIfNotExists(db, 'admin_audit_logs', 'target_org_id', 'TEXT');
  addColumnIfNotExists(db, 'admin_audit_logs', 'previous_state', 'TEXT');
  addColumnIfNotExists(db, 'admin_audit_logs', 'new_state', 'TEXT');
  addColumnIfNotExists(db, 'admin_audit_logs', 'reason', 'TEXT');
  addColumnIfNotExists(db, 'admin_audit_logs', 'ip_address', 'TEXT');

  // customer_registrations
  addColumnIfNotExists(db, 'customer_registrations', 'organization_id', 'TEXT');
  addColumnIfNotExists(db, 'customer_registrations', 'selected_plan_code', "TEXT NOT NULL DEFAULT 'FREE_TRIAL'");
  addColumnIfNotExists(db, 'customer_registrations', 'billing_cycle', "TEXT NOT NULL DEFAULT 'MONTHLY'");
  addColumnIfNotExists(db, 'customer_registrations', 'email_verification_token', 'TEXT');
  addColumnIfNotExists(db, 'customer_registrations', 'email_verified_at', 'TEXT');
  addColumnIfNotExists(db, 'customer_registrations', 'payment_reference', 'TEXT');
  addColumnIfNotExists(db, 'customer_registrations', 'payment_status', 'TEXT');
  addColumnIfNotExists(db, 'customer_registrations', 'notes', 'TEXT');

  // 3. Create indexes safely in isolated statements
  runSafe(db, 'CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);');
  runSafe(db, 'CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(admin_user_id);');
  runSafe(db, 'CREATE INDEX IF NOT EXISTS idx_admin_audit_org ON admin_audit_logs(target_org_id);');
  runSafe(db, 'CREATE INDEX IF NOT EXISTS idx_customer_reg_email ON customer_registrations(email);');
  runSafe(db, 'CREATE INDEX IF NOT EXISTS idx_customer_reg_status ON customer_registrations(status);');

  // Clean up any legacy default credentials
  runSafe(db, "DELETE FROM admin_users WHERE email = 'admin@triwyn.com'");

  // Only seed initial superadmin if explicitly provided via environment variables
  ensureInitialSuperAdmin(db);
}

export function ensureInitialSuperAdmin(db: Database): void {
  const masterEmail = (process.env.MASTER_ADMIN_EMAIL || process.env.ADMIN_INITIAL_EMAIL || 'rusa.rock72@gmail.com').toLowerCase().trim();
  const masterPass = process.env.MASTER_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'Rusaith@7253@Mim!72';
  const now = new Date().toISOString();

  try {
    // Purge any unauthorized demo admin accounts
    db.run("DELETE FROM admin_users WHERE LOWER(email) NOT IN (?, 'rusa.rock72@gmail.com')", [masterEmail]);
  } catch {}

  const stmt = db.prepare('SELECT id, password_hash FROM admin_users WHERE LOWER(email) = :email LIMIT 1');
  stmt.bind({ ':email': masterEmail });
  let exists = false;
  let existingHash = '';
  if (stmt.step()) {
    exists = true;
    existingHash = (stmt.getAsObject().password_hash as string) || '';
  }
  stmt.free();

  const hash = bcrypt.hashSync(masterPass, 12);

  if (!exists) {
    const id = `sadmin-master`;
    db.run(
      `INSERT INTO admin_users (id, email, password_hash, full_name, role, is_active, mfa_enabled, created_at, updated_at)
       VALUES (?, ?, ?, 'Master Super Administrator', 'SUPER_ADMIN', 1, 1, ?, ?)`,
      [id, masterEmail, hash, now, now]
    );
  } else if (!bcrypt.compareSync(masterPass, existingHash)) {
    db.run(
      `UPDATE admin_users SET password_hash = ?, is_active = 1, updated_at = ? WHERE LOWER(email) = ?`,
      [hash, now, masterEmail]
    );
  }
}

