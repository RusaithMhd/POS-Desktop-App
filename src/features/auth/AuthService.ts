import bcrypt from 'bcryptjs';
import { getRawSqlDb, saveLocalDbState, migrateMissingColumns } from '@/infrastructure/database/sqlite/db';
import { ensureAdminTables } from '@/infrastructure/database/sqlite/adminSchema';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export interface UserSession {
  id: string;
  username: string;
  fullName: string;
  roleName: string;
  roleId: string;
  businessId: string;
  branchId: string;
  permissions: string[];
}

const SESSION_KEY = 'triwyn_pos_active_session_v1';

export class AuthService {
  static async loginWithPassword(username: string, password: string): Promise<UserSession> {
    const db = getRawSqlDb();
    ensureAdminTables(db);
    const cleanIdentifier = username.trim().toLowerCase();

    // 1. Check local users table
    const stmt = db.prepare(
      'SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE (LOWER(u.username) = :u OR LOWER(u.email) = :u) LIMIT 1'
    );
    stmt.bind({ ':u': cleanIdentifier });

    let u: any = null;
    if (stmt.step()) {
      u = stmt.getAsObject();
    }
    stmt.free();

    if (u) {
      if (u.is_active === 0 || u.status === 'SUSPENDED') {
        throw new Error('This user account is deactivated or suspended. Please contact your administrator.');
      }
      const passwordHash = u.password_hash as string;
      if (!passwordHash || !bcrypt.compareSync(password, passwordHash)) {
        throw new Error('Incorrect password. Please verify your password and try again.');
      }
      return this._createAndSaveSession(u);
    }

    // 2. Check local customer_registrations
    try {
      const regStmt = db.prepare(
        'SELECT * FROM customer_registrations WHERE (LOWER(email) = :u OR LOWER(business_name) = :u OR LOWER(organization_id) = :u) LIMIT 1'
      );
      regStmt.bind({ ':u': cleanIdentifier });
      let reg: any = null;
      if (regStmt.step()) {
        reg = regStmt.getAsObject();
      }
      regStmt.free();

      if (reg) {
        if (reg.status === 'SUSPENDED') {
          throw new Error('Your account is currently suspended. Please contact TRIWYN POS support.');
        }
        if (reg.password_hash) {
          if (!bcrypt.compareSync(password, reg.password_hash as string)) {
            throw new Error('Incorrect password. Please verify your password and try again.');
          }
          const provisioned = this._provisionUserFromRegistration(db, reg, cleanIdentifier);
          return this._createAndSaveSession(provisioned);
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('suspended') || err.message.includes('Incorrect password'))) {
        throw err;
      }
    }

    // 3. Check local admin_users table (e.g. Super Administrator)
    try {
      const adminStmt = db.prepare(
        'SELECT * FROM admin_users WHERE (LOWER(email) = :u OR LOWER(username) = :u) LIMIT 1'
      );
      adminStmt.bind({ ':u': cleanIdentifier });
      let admin: any = null;
      if (adminStmt.step()) {
        admin = adminStmt.getAsObject();
      }
      adminStmt.free();

      if (admin) {
        if (admin.is_active === 0) {
          throw new Error('This administrator account is currently inactive.');
        }
        if (admin.password_hash) {
          if (!bcrypt.compareSync(password, admin.password_hash as string)) {
            throw new Error('Incorrect password. Please verify your password and try again.');
          }
          const provisioned = this._provisionUserFromAdmin(db, admin, cleanIdentifier);
          return this._createAndSaveSession(provisioned);
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('inactive') || err.message.includes('Incorrect password'))) {
        throw err;
      }
    }

    // 4. Check Supabase Cloud Database (customer_registrations and admin_users)
    if (isSupabaseConfigured && supabase) {
      try {
        // Check customer_registrations in Supabase
        const { data: cloudRegs, error: cloudRegErr } = await supabase
          .from('customer_registrations')
          .select('*')
          .or(`email.ilike.${cleanIdentifier},business_name.ilike.${cleanIdentifier},organization_id.eq.${cleanIdentifier}`)
          .limit(1);

        if (!cloudRegErr && cloudRegs && cloudRegs.length > 0) {
          const cloudReg = cloudRegs[0];
          if (cloudReg.status === 'SUSPENDED') {
            throw new Error('Your account is currently suspended. Please contact TRIWYN POS support.');
          }
          if (cloudReg.password_hash) {
            if (!bcrypt.compareSync(password, cloudReg.password_hash)) {
              throw new Error('Incorrect password. Please verify your password and try again.');
            }
            const provisioned = this._provisionUserFromRegistration(db, cloudReg, cleanIdentifier);
            return this._createAndSaveSession(provisioned);
          }
        }

        // Check admin_users in Supabase
        const { data: cloudAdmins, error: cloudAdminErr } = await supabase
          .from('admin_users')
          .select('*')
          .ilike('email', cleanIdentifier)
          .limit(1);

        if (!cloudAdminErr && cloudAdmins && cloudAdmins.length > 0) {
          const cloudAdmin = cloudAdmins[0];
          if (cloudAdmin.is_active === 0) {
            throw new Error('This administrator account is currently inactive.');
          }
          if (cloudAdmin.password_hash) {
            if (!bcrypt.compareSync(password, cloudAdmin.password_hash)) {
              throw new Error('Incorrect password. Please verify your password and try again.');
            }
            const provisioned = this._provisionUserFromAdmin(db, cloudAdmin, cleanIdentifier);
            return this._createAndSaveSession(provisioned);
          }
        }
      } catch (err: any) {
        if (err.message && (err.message.includes('suspended') || err.message.includes('inactive') || err.message.includes('Incorrect password'))) {
          throw err;
        }
        console.warn('[Supabase Cloud Auth Sync]:', err);
      }
    }

    throw new Error('Invalid username/email or inactive user account.');
  }

  private static _createAndSaveSession(u: any): UserSession {
    const permissions = this.getUserPermissions(u.role_id as string);
    const session: UserSession = {
      id: u.id as string,
      username: u.username as string,
      fullName: u.full_name as string,
      roleName: u.role_name || (u.role_id === 'role-superadmin' ? 'SUPER_ADMIN' : 'ADMIN_MANAGER'),
      roleId: u.role_id as string,
      businessId: u.business_id as string,
      branchId: u.branch_id as string,
      permissions,
    };
    this.saveSession(session);
    return session;
  }

  private static _provisionUserFromRegistration(db: any, reg: any, identifier: string): any {
    const now = new Date().toISOString();
    const userId = `usr-${Date.now()}`;
    const orgId = reg.organization_id || 'biz-001';
    const fullName = reg.full_name || reg.business_name || 'Store Owner';
    const email = reg.email || identifier;
    const username = (reg.business_name ? reg.business_name.toLowerCase().replace(/[^a-z0-9]/g, '') : '') || identifier.split('@')[0];

    let branchId = 'branch-001';
    try {
      const bStmt = db.prepare('SELECT id FROM branches LIMIT 1');
      if (bStmt.step()) branchId = (bStmt.getAsObject().id as string) || 'branch-001';
      bStmt.free();
    } catch {}

    let roleId = 'role-admin';
    try {
      const rStmt = db.prepare("SELECT id FROM roles WHERE id IN ('role-admin', 'role-sysadmin', 'role-superadmin') LIMIT 1");
      if (rStmt.step()) roleId = (rStmt.getAsObject().id as string) || 'role-admin';
      rStmt.free();
    } catch {}

    migrateMissingColumns(db);
    const userCols = db.exec("PRAGMA table_info(users)")[0]?.values?.map((v: any) => v[1]) || [];
    const hasStatus = userCols.includes('status');

    if (hasStatus) {
      db.run(
        `INSERT OR REPLACE INTO users (id, business_id, branch_id, role_id, username, email, password_hash, full_name, phone, status, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)`,
        [userId, orgId, branchId, roleId, username, email, reg.password_hash, fullName, reg.phone || null, now, now]
      );
    } else {
      db.run(
        `INSERT OR REPLACE INTO users (id, business_id, branch_id, role_id, username, email, password_hash, full_name, phone, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [userId, orgId, branchId, roleId, username, email, reg.password_hash, fullName, reg.phone || null, now, now]
      );
    }

    try {
      db.run(
        `INSERT OR REPLACE INTO customer_registrations
          (id, organization_id, email, full_name, business_name, phone, country, password_hash, selected_plan_code, billing_cycle, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reg.id || `reg-${Date.now()}`,
          orgId,
          email,
          fullName,
          reg.business_name || fullName,
          reg.phone || null,
          reg.country || 'Sri Lanka',
          reg.password_hash,
          reg.selected_plan_code || 'FREE_TRIAL',
          reg.billing_cycle || 'monthly',
          reg.status || 'ACTIVE',
          reg.notes || null,
          reg.created_at || now,
          now,
        ]
      );
    } catch {}

    saveLocalDbState();

    return {
      id: userId,
      business_id: orgId,
      branch_id: branchId,
      role_id: roleId,
      role_name: 'ADMIN_MANAGER',
      username,
      email,
      password_hash: reg.password_hash,
      full_name: fullName,
      is_active: 1,
    };
  }

  private static _provisionUserFromAdmin(db: any, admin: any, identifier: string): any {
    const now = new Date().toISOString();
    const userId = `usr-${Date.now()}`;
    const fullName = admin.full_name || 'Super Administrator';
    const email = admin.email || identifier;
    const username = email.split('@')[0];

    let branchId = 'branch-001';
    try {
      const bStmt = db.prepare('SELECT id FROM branches LIMIT 1');
      if (bStmt.step()) branchId = (bStmt.getAsObject().id as string) || 'branch-001';
      bStmt.free();
    } catch {}

    let roleId = 'role-superadmin';
    try {
      const rStmt = db.prepare("SELECT id FROM roles WHERE id = 'role-superadmin' LIMIT 1");
      if (rStmt.step()) roleId = (rStmt.getAsObject().id as string) || 'role-superadmin';
      rStmt.free();
    } catch {}

    migrateMissingColumns(db);
    const userCols = db.exec("PRAGMA table_info(users)")[0]?.values?.map((v: any) => v[1]) || [];
    const hasStatus = userCols.includes('status');

    if (hasStatus) {
      db.run(
        `INSERT OR REPLACE INTO users (id, business_id, branch_id, role_id, username, email, password_hash, full_name, status, is_active, created_at, updated_at)
         VALUES (?, 'biz-001', ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)`,
        [userId, branchId, roleId, username, email, admin.password_hash, fullName, now, now]
      );
    } else {
      db.run(
        `INSERT OR REPLACE INTO users (id, business_id, branch_id, role_id, username, email, password_hash, full_name, is_active, created_at, updated_at)
         VALUES (?, 'biz-001', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [userId, branchId, roleId, username, email, admin.password_hash, fullName, now, now]
      );
    }
    saveLocalDbState();

    return {
      id: userId,
      business_id: 'biz-001',
      branch_id: branchId,
      role_id: roleId,
      role_name: 'SUPER_ADMIN',
      username,
      email,
      password_hash: admin.password_hash,
      full_name: fullName,
      is_active: 1,
    };
  }

  static async loginWithPin(pin: string): Promise<UserSession> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.is_active = 1 AND u.pin_hash IS NOT NULL');
    
    let matchedUser: any = null;
    while (stmt.step()) {
      const u = stmt.getAsObject();
      if (bcrypt.compareSync(pin, u.pin_hash as string)) {
        matchedUser = u;
        break;
      }
    }
    stmt.free();

    if (!matchedUser) {
      throw new Error('Invalid PIN code.');
    }

    const permissions = this.getUserPermissions(matchedUser.role_id as string);

    const session: UserSession = {
      id: matchedUser.id as string,
      username: matchedUser.username as string,
      fullName: matchedUser.full_name as string,
      roleName: matchedUser.role_name as string,
      roleId: matchedUser.role_id as string,
      businessId: matchedUser.business_id as string,
      branchId: matchedUser.branch_id as string,
      permissions,
    };

    this.saveSession(session);
    return session;
  }

  static getUserPermissions(roleId: string): string[] {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT p.name FROM permissions p JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = :rId');
    stmt.bind({ ':rId': roleId });
    const perms: string[] = [];
    while (stmt.step()) {
      perms.push(stmt.getAsObject().name as string);
    }
    stmt.free();
    return perms;
  }

  static getActiveSession(): UserSession | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    try {
      const session: UserSession = JSON.parse(data);
      if (session && session.roleId) {
        try {
          const freshPerms = this.getUserPermissions(session.roleId);
          if (freshPerms && freshPerms.length > 0) {
            session.permissions = freshPerms;
          }
        } catch {
          // DB not ready yet fallback to stored session permissions
        }
      }
      return session;
    } catch {
      return null;
    }
  }

  static saveSession(session: UserSession) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }

  static logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
  }
}
