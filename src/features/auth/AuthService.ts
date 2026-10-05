import bcrypt from 'bcryptjs';
import { getRawSqlDb } from '@/infrastructure/database/sqlite/db';

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
    const stmt = db.prepare('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE (u.username = :u OR u.email = :u) AND u.is_active = 1 LIMIT 1');
    stmt.bind({ ':u': username.trim().toLowerCase() });

    if (!stmt.step()) {
      stmt.free();
      throw new Error('Invalid username/email or inactive user account.');
    }

    const u = stmt.getAsObject();
    stmt.free();

    const passwordHash = u.password_hash as string;
    const isValid = bcrypt.compareSync(password, passwordHash);

    if (!isValid) {
      throw new Error('Incorrect password.');
    }

    // Fetch user permissions
    const permissions = this.getUserPermissions(u.role_id as string);

    const session: UserSession = {
      id: u.id as string,
      username: u.username as string,
      fullName: u.full_name as string,
      roleName: u.role_name as string,
      roleId: u.role_id as string,
      businessId: u.business_id as string,
      branchId: u.branch_id as string,
      permissions,
    };

    this.saveSession(session);
    return session;
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
