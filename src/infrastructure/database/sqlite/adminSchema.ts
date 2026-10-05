import bcrypt from 'bcryptjs';
import { Database } from 'sql.js';

export function ensureAdminTables(db: Database): void {
  db.run(`
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

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT NOT NULL REFERENCES admin_users(id),
      session_token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      revoked_by TEXT,
      created_at TEXT NOT NULL
    );

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

    CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(admin_user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_org ON admin_audit_logs(target_org_id);
    CREATE INDEX IF NOT EXISTS idx_customer_reg_email ON customer_registrations(email);
    CREATE INDEX IF NOT EXISTS idx_customer_reg_status ON customer_registrations(status);
  `);

  // Seed the initial SUPER_ADMIN if no admins exist
  ensureInitialSuperAdmin(db);
}

export function ensureInitialSuperAdmin(db: Database): void {
  const stmt = db.prepare('SELECT COUNT(*) as cnt FROM admin_users');
  let cnt = 0;
  if (stmt.step()) cnt = (stmt.getAsObject().cnt as number) || 0;
  stmt.free();
  if (cnt > 0) return;

  const now = new Date().toISOString();
  const id = `sadmin-${Date.now()}`;
  // Default credentials: admin@triwyn.com / SuperAdmin@2026!
  const hash = bcrypt.hashSync('SuperAdmin@2026!', 12);
  db.run(
    `INSERT INTO admin_users (id, email, password_hash, full_name, role, is_active, mfa_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, 'admin@triwyn.com', hash, 'System Super Admin', 'SUPER_ADMIN', 1, 0, now, now]
  );
}
