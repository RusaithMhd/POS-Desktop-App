import { Database } from 'sql.js';
import { realtimeService } from '../realtime/RealtimeService';

export interface UserSessionInfo {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  roleName: string;
  terminalId: string;
  terminalCode: string;
  deviceInfo: string;
  ipAddress?: string | null;
  status: 'ONLINE' | 'IDLE' | 'OFFLINE';
  lastActivityAt: string;
}

export class SessionService {
  public static ensureInitialSessions(db: Database) {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as cnt FROM active_user_sessions');
      let cnt = 0;
      if (stmt.step()) {
        cnt = (stmt.getAsObject().cnt as number) || 0;
      }
      stmt.free();

      if (cnt === 0) {
        const now = new Date().toISOString();
        db.run(
          `INSERT INTO active_user_sessions (id, user_id, username, full_name, role_name, terminal_id, terminal_code, device_info, ip_address, status, last_activity_at)
           VALUES 
           ('sess-01', 'u-cashier01', 'cashier01', 'Sarah Jenkins', 'Cashier', 'term-01', 'POS-01', 'POS Terminal (Windows)', '192.168.1.101', 'ONLINE', ?),
           ('sess-02', 'u-cashier02', 'cashier02', 'Michael Wong', 'Cashier', 'term-02', 'POS-02', 'Tablet POS (iOS)', '192.168.1.102', 'ONLINE', ?),
           ('sess-03', 'u-admin', 'admin', 'System Administrator', 'Admin', 'term-main', 'Desktop', 'Admin Workstation (Windows)', '192.168.1.100', 'ONLINE', ?)`,
          [now, now, now]
        );
      }
    } catch (err) {
      console.warn('Failed to seed active sessions', err);
    }
  }

  public static getActiveSessions(db: Database): UserSessionInfo[] {
    this.ensureInitialSessions(db);
    const stmt = db.prepare(
      `SELECT id, user_id, username, full_name, role_name, terminal_id, terminal_code, device_info, ip_address, status, last_activity_at
       FROM active_user_sessions
       ORDER BY last_activity_at DESC`
    );

    const sessions: UserSessionInfo[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      sessions.push({
        id: r.id as string,
        userId: r.user_id as string,
        username: r.username as string,
        fullName: r.full_name as string,
        roleName: r.role_name as string,
        terminalId: r.terminal_id as string,
        terminalCode: r.terminal_code as string,
        deviceInfo: r.device_info as string,
        ipAddress: r.ip_address ? (r.ip_address as string) : null,
        status: (r.status as any) || 'ONLINE',
        lastActivityAt: r.last_activity_at as string,
      });
    }
    stmt.free();
    return sessions;
  }

  public static touchSession(db: Database, userId: string, terminalCode: string) {
    const now = new Date().toISOString();
    db.run(
      `UPDATE active_user_sessions SET last_activity_at = ?, status = 'ONLINE' WHERE user_id = ? OR terminal_code = ?`,
      [now, userId, terminalCode]
    );

    realtimeService.emit('ACTIVE_USERS_UPDATED', {
      userId,
      terminalCode,
      lastActivityAt: now,
    });
  }
}
