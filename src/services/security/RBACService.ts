import { getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import { UserSession } from '@/features/auth/AuthService';
import bcrypt from 'bcryptjs';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  roleName?: string;
  action: string;
  entity?: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  authorizerId?: string;
  authorizerName?: string;
  deviceId?: string;
  createdAt: string;
}

export interface ApprovalRule {
  id: string;
  businessId: string;
  ruleType: string;
  minValue: number;
  maxValue: number;
  requiredRole: string;
  createdAt: string;
  updatedAt: string;
}

export class RBACService {
  /**
   * Server-Side / Backend Validation
   * Enforces permission check at the database/service layer.
   * Throws Error if unauthorized and logs denial event.
   */
  static validatePermission(session: UserSession | null, requiredPermission: string, resourceName?: string): boolean {
    if (!session) {
      this.logAudit({
        action: 'SECURITY_DENIED',
        entity: resourceName || 'SYSTEM',
        reason: 'Unauthenticated attempt to access protected resource',
      });
      throw new Error('403 Forbidden: Authentication session required.');
    }

    // Admin and Manager roles have unconditional system access
    const roleUpper = (session.roleName || '').toUpperCase();
    if (
      roleUpper === 'SUPER_ADMIN' ||
      roleUpper === 'ADMIN_MANAGER' ||
      roleUpper === 'ADMIN' ||
      roleUpper === 'STORE_ADMIN'
    ) {
      return true;
    }

    const hasPerm = session.permissions.includes(requiredPermission);
    if (!hasPerm) {
      this.logAudit({
        userId: session.id,
        userName: session.fullName,
        roleName: session.roleName,
        action: 'SECURITY_DENIED',
        entity: resourceName || requiredPermission,
        reason: `Role '${session.roleName}' lacking required permission '${requiredPermission}'`,
      });
      throw new Error(`403 Forbidden: Required permission '${requiredPermission}' is not granted to role '${session.roleName}'.`);
    }

    return true;
  }

  /**
   * Verifies Manager/Admin Authorization PIN for Sensitive Actions
   * Logs approval event into audit_logs.
   */
  static verifyAndLogManagerApproval(params: {
    cashierSession: UserSession | null;
    managerPin: string;
    action: string;
    entity?: string;
    entityId?: string;
    amount?: number;
    reason?: string;
    deviceId?: string;
  }): { success: boolean; authorizer: any } {
    const db = getRawSqlDb();
    
    // Find active manager or superadmin matching PIN
    const stmt = db.prepare(
      `SELECT u.*, r.name as role_name FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.is_active = 1 AND r.name IN ('SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN', 'MANAGER') AND u.pin_hash IS NOT NULL`
    );

    let authorizer: any = null;
    while (stmt.step()) {
      const u = stmt.getAsObject();
      if (bcrypt.compareSync(params.managerPin.trim(), u.pin_hash as string)) {
        authorizer = u;
        break;
      }
    }
    stmt.free();

    if (!authorizer) {
      this.logAudit({
        userId: params.cashierSession?.id,
        userName: params.cashierSession?.fullName,
        roleName: params.cashierSession?.roleName,
        action: 'MANAGER_APPROVAL_FAILED',
        entity: params.entity || 'POS',
        entityId: params.entityId,
        reason: `Failed manager approval for action '${params.action}'. Invalid PIN entered.`,
        deviceId: params.deviceId || 'POS-TERMINAL-01',
      });
      throw new Error('Invalid Manager PIN. Authorization denied.');
    }

    // Log Successful Manager Approval
    this.logAudit({
      userId: params.cashierSession?.id,
      userName: params.cashierSession?.fullName,
      roleName: params.cashierSession?.roleName,
      action: params.action,
      entity: params.entity || 'POS',
      entityId: params.entityId,
      newValue: params.amount ? `Amount: ${params.amount}` : undefined,
      reason: params.reason || 'Manager PIN Authorization Override',
      authorizerId: authorizer.id,
      authorizerName: authorizer.full_name,
      deviceId: params.deviceId || 'POS-TERMINAL-01',
    });

    return { success: true, authorizer };
  }

  /**
   * Log an event into permanent immutable audit_logs
   */
  static logAudit(params: {
    userId?: string;
    userName?: string;
    roleName?: string;
    action: string;
    entity?: string;
    entityId?: string;
    oldValue?: string;
    newValue?: string;
    reason?: string;
    authorizerId?: string;
    authorizerName?: string;
    deviceId?: string;
  }) {
    try {
      const db = getRawSqlDb();
      const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const now = new Date().toISOString();

      db.run(
        `INSERT INTO audit_logs (id, timestamp, user_id, user_name, role_name, action, entity, entity_id, old_value, new_value, reason, authorizer_id, authorizer_name, device_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          now,
          params.userId || null,
          params.userName || 'System',
          params.roleName || 'SYSTEM',
          params.action,
          params.entity || null,
          params.entityId || null,
          params.oldValue || null,
          params.newValue || null,
          params.reason || null,
          params.authorizerId || null,
          params.authorizerName || null,
          params.deviceId || 'POS-01',
          now,
        ]
      );

      saveLocalDbState();
    } catch (err) {
      console.error('Failed to insert audit log entry:', err);
    }
  }

  /**
   * Fetch Audit Logs for UI table
   */
  static getAuditLogs(limit = 100): AuditLogEntry[] {
    try {
      const db = getRawSqlDb();
      const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT :lim');
      stmt.bind({ ':lim': limit });
      const logs: AuditLogEntry[] = [];
      while (stmt.step()) {
        const obj = stmt.getAsObject();
        logs.push({
          id: obj.id as string,
          timestamp: obj.timestamp as string,
          userId: obj.user_id as string,
          userName: obj.user_name as string,
          roleName: obj.role_name as string,
          action: obj.action as string,
          entity: obj.entity as string,
          entityId: obj.entity_id as string,
          oldValue: obj.old_value as string,
          newValue: obj.new_value as string,
          reason: obj.reason as string,
          authorizerId: obj.authorizer_id as string,
          authorizerName: obj.authorizer_name as string,
          deviceId: obj.device_id as string,
          createdAt: obj.created_at as string,
        });
      }
      stmt.free();
      return logs;
    } catch (err) {
      console.error('Failed to read audit logs:', err);
      return [];
    }
  }

  /**
   * Fetch System Approval Rules
   */
  static getApprovalRules(): ApprovalRule[] {
    try {
      const db = getRawSqlDb();
      const stmt = db.prepare('SELECT * FROM approval_rules ORDER BY rule_type ASC');
      const rules: ApprovalRule[] = [];
      while (stmt.step()) {
        const obj = stmt.getAsObject();
        rules.push({
          id: obj.id as string,
          businessId: obj.business_id as string,
          ruleType: obj.rule_type as string,
          minValue: Number(obj.min_value || 0),
          maxValue: Number(obj.max_value || 0),
          requiredRole: obj.required_role as string,
          createdAt: obj.created_at as string,
          updatedAt: obj.updated_at as string,
        });
      }
      stmt.free();
      return rules;
    } catch (err) {
      console.error('Failed to load approval rules:', err);
      return [];
    }
  }
}
