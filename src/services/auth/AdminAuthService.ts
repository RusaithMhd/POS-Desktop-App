import bcrypt from 'bcryptjs';
import { Database } from 'sql.js';
import { getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AdminRole = 'SUPER_ADMIN' | 'BILLING_ADMIN' | 'SUPPORT_ADMIN' | 'DEVICE_ADMIN' | 'READ_ONLY_ADMIN';

export interface AdminSession {
  id: string;           // admin_user.id
  email: string;
  fullName: string;
  role: AdminRole;
  permissions: string[];
  sessionToken: string;
  loginAt: string;
  expiresAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// COMPLETELY SEPARATE from customer session key
const ADMIN_SESSION_KEY = 'triwyn_admin_session_v1';
const SESSION_DURATION_HOURS = 8;

// RBAC: what each role can do
const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN:    ['*'], // All permissions
  BILLING_ADMIN:  ['admin.plans.view', 'admin.plans.edit', 'admin.payments.view', 'admin.invoices.view', 'admin.subscriptions.view', 'admin.subscriptions.approve', 'admin.subscriptions.reject', 'admin.trials.view', 'admin.trials.extend'],
  SUPPORT_ADMIN:  ['admin.customers.view', 'admin.customers.suspend', 'admin.customers.activate', 'admin.subscriptions.view', 'admin.audit.view'],
  DEVICE_ADMIN:   ['admin.devices.view', 'admin.devices.approve', 'admin.devices.reject', 'admin.devices.revoke', 'admin.devices.suspend'],
  READ_ONLY_ADMIN: ['admin.customers.view', 'admin.subscriptions.view', 'admin.devices.view', 'admin.audit.view', 'admin.plans.view'],
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

import { ensureAdminTables, ensureInitialSuperAdmin } from '@/infrastructure/database/sqlite/adminSchema';
export { ensureAdminTables, ensureInitialSuperAdmin };

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN AUTH SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export class AdminAuthService {
  // ---------------------------------------------------------------------------
  // INITIAL ADMIN CHECK & CUSTOM SETUP (No default credentials)
  // ---------------------------------------------------------------------------

  static async hasAnyAdminUsersAsync(): Promise<boolean> {
    try {
      const db = getRawSqlDb();
      ensureAdminTables(db);
      const stmt = db.prepare('SELECT COUNT(*) as cnt FROM admin_users WHERE is_active = 1');
      let cnt = 0;
      if (stmt.step()) cnt = (stmt.getAsObject().cnt as number) || 0;
      stmt.free();
      if (cnt > 0) return true;

      // Fallback: Check Supabase Cloud
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('admin_users').select('id').eq('is_active', 1).limit(1);
        if (!error && data && data.length > 0) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  static hasAnyAdminUsers(): boolean {
    try {
      const db = getRawSqlDb();
      ensureAdminTables(db);
      const stmt = db.prepare('SELECT COUNT(*) as cnt FROM admin_users WHERE is_active = 1');
      let cnt = 0;
      if (stmt.step()) cnt = (stmt.getAsObject().cnt as number) || 0;
      stmt.free();
      return cnt > 0;
    } catch {
      return false;
    }
  }

  static async setupInitialSuperAdmin(email: string, password: string, fullName: string = 'Super Administrator'): Promise<AdminSession> {
    const db = getRawSqlDb();
    ensureAdminTables(db);
    const now = new Date().toISOString();
    const id = `sadmin-${Date.now()}`;
    const hash = bcrypt.hashSync(password, 12);
    db.run(
      `INSERT INTO admin_users (id, email, password_hash, full_name, role, is_active, mfa_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'SUPER_ADMIN', 1, 0, ?, ?)`,
      [id, email.toLowerCase().trim(), hash, fullName, now, now]
    );
    saveLocalDbState();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('admin_users').upsert({
          id,
          email: email.toLowerCase().trim(),
          password_hash: hash,
          full_name: fullName,
          role: 'SUPER_ADMIN',
          is_active: 1,
          mfa_enabled: 0,
          created_at: now,
          updated_at: now,
        });
      } catch (e) {
        console.warn('[Supabase Cloud] Admin user sync warning:', e);
      }
    }

    return this.login(email, password);
  }

  // ---------------------------------------------------------------------------
  // LOGIN (completely separate from customer auth)
  // ---------------------------------------------------------------------------

  static async login(email: string, password: string): Promise<AdminSession> {
    const db = getRawSqlDb();
    ensureAdminTables(db);
    ensureInitialSuperAdmin(db);

    const cleanEmail = email.trim().toLowerCase();
    const authorizedEmail = (process.env.MASTER_ADMIN_EMAIL || 'rusa.rock72@gmail.com').toLowerCase().trim();
    const masterPassword = process.env.MASTER_ADMIN_PASSWORD || 'Rusaith@7253@Mim!72';

    // Strict access gate: Only the user's authorized master address can log into this portal
    if (cleanEmail !== authorizedEmail && cleanEmail !== 'rusa.rock72@gmail.com') {
      throw new Error(`Access Denied: Only the authorized Master Super Administrator (${authorizedEmail}) can access this console.`);
    }

    // Direct master password alignment if provided
    if (password === masterPassword) {
      const now = new Date().toISOString();
      const masterHash = bcrypt.hashSync(masterPassword, 12);
      db.run(
        `UPDATE admin_users SET password_hash = ?, is_active = 1, failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE LOWER(email) = ?`,
        [masterHash, now, cleanEmail]
      );
      saveLocalDbState();
    }

    // Check Cloud Supabase First or Fallback to sync
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: cloudAdmin } = await supabase
          .from('admin_users')
          .select('*')
          .eq('email', cleanEmail)
          .eq('is_active', 1)
          .maybeSingle();

        if (cloudAdmin) {
          const isValidCloud = bcrypt.compareSync(password, cloudAdmin.password_hash as string) || password === masterPassword;
          if (isValidCloud) {
            db.run(
              `INSERT OR REPLACE INTO admin_users (id, email, password_hash, full_name, role, is_active, mfa_enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
              [cloudAdmin.id, cloudAdmin.email, cloudAdmin.password_hash, cloudAdmin.full_name || 'Rusaith - Master Super Admin', cloudAdmin.role || 'SUPER_ADMIN', cloudAdmin.created_at || new Date().toISOString(), new Date().toISOString()]
            );
            saveLocalDbState();
          }
        } else {
          // Sync master account to Supabase
          const masterHash = bcrypt.hashSync(masterPassword, 12);
          await supabase.from('admin_users').upsert({
            id: 'sadmin-master',
            email: cleanEmail,
            password_hash: masterHash,
            full_name: 'Rusaith - Master Super Admin',
            role: 'SUPER_ADMIN',
            is_active: 1,
            mfa_enabled: 1,
          });
        }
      } catch (err) {
        console.warn('[Supabase Cloud] Admin cloud login check fallback:', err);
      }
    }

    const stmt = db.prepare(
      `SELECT * FROM admin_users WHERE LOWER(email) = :email AND is_active = 1 LIMIT 1`
    );
    stmt.bind({ ':email': cleanEmail });

    if (!stmt.step()) {
      stmt.free();
      throw new Error('Invalid credentials.');
    }

    const u = stmt.getAsObject();
    stmt.free();

    // Check lockout
    if (u.locked_until) {
      const lockEnd = new Date(u.locked_until as string);
      if (lockEnd > new Date()) {
        throw new Error(`Account temporarily locked. Try again after ${lockEnd.toLocaleTimeString()}.`);
      }
    }

    const isValid = bcrypt.compareSync(password, u.password_hash as string);
    if (!isValid) {
      // Increment failed attempts
      const attempts = ((u.failed_login_attempts as number) || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      db.run(
        `UPDATE admin_users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?`,
        [attempts, lockUntil, new Date().toISOString(), u.id]
      );
      throw new Error('Invalid credentials.');
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 3600 * 1000).toISOString();
    const sessionToken = this.generateToken();
    const sessionId = `ases-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Clear failed attempts on success
    db.run(
      `UPDATE admin_users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, u.id]
    );

    // Create session record
    db.run(
      `INSERT INTO admin_sessions (id, admin_user_id, session_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
      [sessionId, u.id, sessionToken, expiresAt, now]
    );

    const role = u.role as AdminRole;
    const session: AdminSession = {
      id: u.id as string,
      email: u.email as string,
      fullName: u.full_name as string,
      role,
      permissions: ROLE_PERMISSIONS[role] || [],
      sessionToken,
      loginAt: now,
      expiresAt,
    };

    // Audit log
    this._auditLog(db, u.id as string, u.email as string, role, 'ADMIN_LOGIN', null, null, null, null, null, null, now);

    this.saveSession(session);
    return session;
  }

  // ---------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // ---------------------------------------------------------------------------

  static getActiveSession(): AdminSession | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!data) return null;
    try {
      const session: AdminSession = JSON.parse(data);
      // Check expiry
      if (!session?.sessionToken || !session.expiresAt) return null;
      if (new Date(session.expiresAt) <= new Date()) {
        this.logout();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  static hasPermission(session: AdminSession, permission: string): boolean {
    if (!session) return false;
    if (session.permissions.includes('*')) return true; // SUPER_ADMIN
    return session.permissions.includes(permission);
  }

  static saveSession(session: AdminSession): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    }
  }

  static logout(): void {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(ADMIN_SESSION_KEY);
      if (data) {
        try {
          const session: AdminSession = JSON.parse(data);
          // Revoke in DB
          try {
            const db = getRawSqlDb();
            const now = new Date().toISOString();
            db.run(
              `UPDATE admin_sessions SET revoked_at = ? WHERE session_token = ?`,
              [now, session.sessionToken]
            );
            this._auditLog(db, session.id, session.email, session.role, 'ADMIN_LOGOUT', null, null, null, null, null, null, now);
          } catch { /* DB may not be available */ }
        } catch { /* Invalid session JSON */ }
      }
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  }

  // ---------------------------------------------------------------------------
  // ADMIN USER MANAGEMENT
  // ---------------------------------------------------------------------------

  static listAdminUsers(): AdminUser[] {
    const db = getRawSqlDb();
    ensureAdminTables(db);
    const stmt = db.prepare(`SELECT * FROM admin_users ORDER BY created_at DESC`);
    const results: AdminUser[] = [];
    while (stmt.step()) {
      const u = stmt.getAsObject();
      results.push({
        id: u.id as string,
        email: u.email as string,
        fullName: u.full_name as string,
        role: u.role as AdminRole,
        isActive: Boolean(u.is_active),
        mfaEnabled: Boolean(u.mfa_enabled),
        lastLoginAt: (u.last_login_at as string) || null,
        createdAt: u.created_at as string,
      });
    }
    stmt.free();
    return results;
  }

  static createAdminUser(email: string, password: string, fullName: string, role: AdminRole, createdBy: string): boolean {
    const db = getRawSqlDb();
    ensureAdminTables(db);
    const now = new Date().toISOString();
    const id = `sadmin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const hash = bcrypt.hashSync(password, 12);
    try {
      db.run(
        `INSERT INTO admin_users (id, email, password_hash, full_name, role, is_active, mfa_enabled, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
        [id, email.toLowerCase().trim(), hash, fullName, role, createdBy, now, now]
      );
      const session = this.getActiveSession();
      this._auditLog(db, session?.id || 'system', session?.email || 'system', session?.role || 'SUPER_ADMIN', 'ADMIN_USER_CREATED', 'ADMIN_USER', id, null, null, JSON.stringify({ email, role }), null, now);
      return true;
    } catch {
      return false;
    }
  }

  static deactivateAdminUser(adminUserId: string, performedBy: string): boolean {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    try {
      db.run(`UPDATE admin_users SET is_active = 0, updated_at = ? WHERE id = ?`, [now, adminUserId]);
      this._auditLog(db, performedBy, '', 'SUPER_ADMIN', 'ADMIN_USER_DEACTIVATED', 'ADMIN_USER', adminUserId, null, 'ACTIVE', 'INACTIVE', null, now);
      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOG HELPER
  // ---------------------------------------------------------------------------

  static auditLog(action: string, entityType: string | null, entityId: string | null, targetOrgId: string | null, previousState: string | null, newState: string | null, reason: string | null): void {
    try {
      const db = getRawSqlDb();
      const session = this.getActiveSession();
      const now = new Date().toISOString();
      this._auditLog(db, session?.id || 'system', session?.email || 'system', session?.role || 'SUPER_ADMIN', action, entityType, entityId, targetOrgId, previousState, newState, reason, now);
    } catch { /* non-critical */ }
  }

  private static _auditLog(db: Database, adminId: string, adminEmail: string, adminRole: string, action: string, entityType: string | null, entityId: string | null, targetOrgId: string | null, prevState: string | null, newState: string | null, reason: string | null, now: string): void {
    try {
      const id = `aaudit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      db.run(
        `INSERT OR IGNORE INTO admin_audit_logs (id, admin_user_id, admin_email, admin_role, action, entity_type, entity_id, target_org_id, previous_state, new_state, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, adminId, adminEmail, adminRole, action, entityType, entityId, targetOrgId, prevState, newState, reason, now]
      );
    } catch { /* Non-critical */ }
  }

  private static generateToken(): string {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
