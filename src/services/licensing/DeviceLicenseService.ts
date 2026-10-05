import { Database } from 'sql.js';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type DeviceStatus =
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'EXPIRED';

export type DeviceType = 'POS_TERMINAL' | 'ADMIN_WORKSTATION' | 'MOBILE' | 'KIOSK';

export interface DeviceLicense {
  id: string;
  organizationId: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceType: DeviceType;
  macAddress: string | null;
  hostname: string | null;
  osInfo: string | null;
  status: DeviceStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  suspendedReason: string | null;
  lastSeenAt: string | null;
  registeredAt: string;
  expiresAt: string | null;
  isCurrentDevice?: boolean;
}

export interface DeviceRegistrationRequest {
  id: string;
  organizationId: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceType: DeviceType;
  macAddress: string | null;
  hostname: string | null;
  osInfo: string | null;
  requestedBy: string;
  requestNotes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface DeviceLimitCheck {
  allowed: boolean;
  reason:
    | 'OK'
    | 'ALREADY_REGISTERED'
    | 'LIMIT_REACHED'
    | 'PENDING_APPROVAL'
    | 'SUSPENDED'
    | 'REVOKED'
    | 'NO_SUBSCRIPTION'
    | 'SUBSCRIPTION_EXPIRED';
  currentDevice: DeviceLicense | null;
  activeCount: number;
  maxAllowed: number;
  planName: string;
}

export interface DeviceInfo {
  fingerprint: string;
  name: string;
  type: DeviceType;
  macAddress: string | null;
  hostname: string | null;
  osInfo: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FINGERPRINT UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export function getOrCreateDeviceFingerprint(): string {
  const KEY = 'triwyn_device_fingerprint_v1';
  if (typeof window === 'undefined') return 'server-side-device';

  let fp = localStorage.getItem(KEY);
  if (fp) return fp;

  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  arr[6] = (arr[6] & 0x0f) | 0x40;
  arr[8] = (arr[8] & 0x3f) | 0x80;
  const hex = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  fp = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  localStorage.setItem(KEY, fp);
  return fp;
}

export function collectDeviceInfo(): DeviceInfo {
  const fingerprint = getOrCreateDeviceFingerprint();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const osInfo = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null;
  const storedName = typeof window !== 'undefined' ? (localStorage.getItem('triwyn_device_name') || '') : '';
  const deviceName = storedName || `Terminal-${fingerprint.slice(0, 8).toUpperCase()}`;
  return { fingerprint, name: deviceName, type: 'POS_TERMINAL', macAddress: null, hostname, osInfo };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export class DeviceLicenseService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.ensureTablesExist();
  }

  private ensureTablesExist(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS device_licenses (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        device_fingerprint TEXT NOT NULL,
        device_name TEXT NOT NULL,
        device_type TEXT NOT NULL DEFAULT 'POS_TERMINAL',
        mac_address TEXT,
        hostname TEXT,
        os_info TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
        approved_by TEXT,
        approved_at TEXT,
        suspended_reason TEXT,
        last_seen_at TEXT,
        registered_at TEXT NOT NULL,
        expires_at TEXT,
        UNIQUE(organization_id, device_fingerprint)
      );

      CREATE TABLE IF NOT EXISTS device_registration_requests (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        device_fingerprint TEXT NOT NULL,
        device_name TEXT NOT NULL,
        device_type TEXT NOT NULL DEFAULT 'POS_TERMINAL',
        mac_address TEXT,
        hostname TEXT,
        os_info TEXT,
        requested_by TEXT NOT NULL,
        request_notes TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        reviewed_by TEXT,
        reviewed_at TEXT,
        rejection_reason TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_device_lic_org ON device_licenses(organization_id);
      CREATE INDEX IF NOT EXISTS idx_device_lic_fp ON device_licenses(device_fingerprint);
      CREATE INDEX IF NOT EXISTS idx_device_lic_status ON device_licenses(status);
      CREATE INDEX IF NOT EXISTS idx_dev_req_org ON device_registration_requests(organization_id);
      CREATE INDEX IF NOT EXISTS idx_dev_req_status ON device_registration_requests(status);
    `);
  }

  checkDeviceAccess(organizationId: string, deviceFingerprint: string): DeviceLimitCheck {
    const subStmt = this.db.prepare(`
      SELECT s.status as sub_status, p.max_devices, p.name as plan_name, s.current_period_end
      FROM subscriptions s
      JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.organization_id = :orgId
      ORDER BY s.created_at DESC
      LIMIT 1
    `);
    subStmt.bind({ ':orgId': organizationId });
    let maxDevices = 1;
    let planName = 'Free';
    let subStatus = '';

    if (subStmt.step()) {
      const row = subStmt.getAsObject();
      maxDevices = (row.max_devices as number) || 1;
      planName = (row.plan_name as string) || 'Free';
      subStatus = (row.sub_status as string) || '';
    }
    subStmt.free();

    if (!subStatus) return { allowed: false, reason: 'NO_SUBSCRIPTION', currentDevice: null, activeCount: 0, maxAllowed: maxDevices, planName };
    const validStatuses = ['TRIALING', 'ACTIVE', 'GRACE_PERIOD', 'PAST_DUE'];
    if (!validStatuses.includes(subStatus)) return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED', currentDevice: null, activeCount: 0, maxAllowed: maxDevices, planName };

    const countStmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM device_licenses WHERE organization_id = :orgId AND status = 'ACTIVE'`);
    countStmt.bind({ ':orgId': organizationId });
    let activeCount = 0;
    if (countStmt.step()) activeCount = (countStmt.getAsObject().cnt as number) || 0;
    countStmt.free();

    const devStmt = this.db.prepare(`SELECT * FROM device_licenses WHERE organization_id = :orgId AND device_fingerprint = :fp LIMIT 1`);
    devStmt.bind({ ':orgId': organizationId, ':fp': deviceFingerprint });
    let device: DeviceLicense | null = null;
    if (devStmt.step()) device = this.rowToLicense(devStmt.getAsObject());
    devStmt.free();

    if (device) {
      if (device.status === 'ACTIVE') {
        this.db.run(`UPDATE device_licenses SET last_seen_at = ? WHERE id = ?`, [new Date().toISOString(), device.id]);
        return { allowed: true, reason: 'ALREADY_REGISTERED', currentDevice: device, activeCount, maxAllowed: maxDevices, planName };
      }
      if (device.status === 'PENDING_APPROVAL') return { allowed: false, reason: 'PENDING_APPROVAL', currentDevice: device, activeCount, maxAllowed: maxDevices, planName };
      if (device.status === 'SUSPENDED') return { allowed: false, reason: 'SUSPENDED', currentDevice: device, activeCount, maxAllowed: maxDevices, planName };
      return { allowed: false, reason: 'REVOKED', currentDevice: device, activeCount, maxAllowed: maxDevices, planName };
    }

    if (activeCount >= maxDevices) return { allowed: false, reason: 'LIMIT_REACHED', currentDevice: null, activeCount, maxAllowed: maxDevices, planName };
    return { allowed: true, reason: 'OK', currentDevice: null, activeCount, maxAllowed: maxDevices, planName };
  }

  registerDevice(organizationId: string, deviceInfo: DeviceInfo, requestedBy: string, autoApprove: boolean = false): { success: boolean; status: DeviceStatus; licenseId: string } {
    const now = new Date().toISOString();
    const id = `dlicense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const status: DeviceStatus = autoApprove ? 'ACTIVE' : 'PENDING_APPROVAL';
    try {
      this.db.run(
        `INSERT OR IGNORE INTO device_licenses (id, organization_id, device_fingerprint, device_name, device_type, mac_address, hostname, os_info, status, approved_by, approved_at, last_seen_at, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, organizationId, deviceInfo.fingerprint, deviceInfo.name, deviceInfo.type, deviceInfo.macAddress, deviceInfo.hostname, deviceInfo.osInfo, status, autoApprove ? requestedBy : null, autoApprove ? now : null, now, now]
      );
      const reqId = `devreq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.db.run(
        `INSERT OR IGNORE INTO device_registration_requests (id, organization_id, device_fingerprint, device_name, device_type, mac_address, hostname, os_info, requested_by, status, reviewed_by, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reqId, organizationId, deviceInfo.fingerprint, deviceInfo.name, deviceInfo.type, deviceInfo.macAddress, deviceInfo.hostname, deviceInfo.osInfo, requestedBy, autoApprove ? 'APPROVED' : 'PENDING', autoApprove ? 'SYSTEM' : null, autoApprove ? now : null, now]
      );
      return { success: true, status, licenseId: id };
    } catch (err) {
      console.error('Device registration failed:', err);
      return { success: false, status: 'PENDING_APPROVAL', licenseId: '' };
    }
  }

  approveDevice(deviceLicenseId: string, approvedBy: string): boolean {
    const now = new Date().toISOString();
    try {
      this.db.run(`UPDATE device_licenses SET status = 'ACTIVE', approved_by = ?, approved_at = ?, suspended_reason = NULL WHERE id = ?`, [approvedBy, now, deviceLicenseId]);
      this.db.run(`UPDATE device_registration_requests SET status = 'APPROVED', reviewed_by = ?, reviewed_at = ? WHERE device_fingerprint = (SELECT device_fingerprint FROM device_licenses WHERE id = ?) AND status = 'PENDING'`, [approvedBy, now, deviceLicenseId]);
      this._auditLog('DEVICE_APPROVED', deviceLicenseId, approvedBy, now);
      return true;
    } catch { return false; }
  }

  suspendDevice(deviceLicenseId: string, reason: string, performedBy: string): boolean {
    const now = new Date().toISOString();
    try {
      this.db.run(`UPDATE device_licenses SET status = 'SUSPENDED', suspended_reason = ? WHERE id = ?`, [reason, deviceLicenseId]);
      this._auditLog('DEVICE_SUSPENDED', deviceLicenseId, performedBy, now, reason);
      return true;
    } catch { return false; }
  }

  revokeDevice(deviceLicenseId: string, reason: string, performedBy: string): boolean {
    const now = new Date().toISOString();
    try {
      this.db.run(`UPDATE device_licenses SET status = 'REVOKED', suspended_reason = ? WHERE id = ?`, [reason, deviceLicenseId]);
      this._auditLog('DEVICE_REVOKED', deviceLicenseId, performedBy, now, reason);
      return true;
    } catch { return false; }
  }

  renameDevice(deviceLicenseId: string, newName: string): boolean {
    try {
      this.db.run(`UPDATE device_licenses SET device_name = ? WHERE id = ?`, [newName, deviceLicenseId]);
      return true;
    } catch { return false; }
  }

  listDevicesForOrg(organizationId: string): DeviceLicense[] {
    const stmt = this.db.prepare(`SELECT * FROM device_licenses WHERE organization_id = :orgId ORDER BY registered_at DESC`);
    stmt.bind({ ':orgId': organizationId });
    const results: DeviceLicense[] = [];
    while (stmt.step()) results.push(this.rowToLicense(stmt.getAsObject()));
    stmt.free();
    return results;
  }

  listAllDevices(): DeviceLicense[] {
    const stmt = this.db.prepare(`SELECT dl.*, o.name as org_name FROM device_licenses dl LEFT JOIN organizations o ON o.id = dl.organization_id ORDER BY dl.registered_at DESC`);
    const results: DeviceLicense[] = [];
    while (stmt.step()) results.push(this.rowToLicense(stmt.getAsObject()));
    stmt.free();
    return results;
  }

  listPendingRequests(): DeviceRegistrationRequest[] {
    const stmt = this.db.prepare(`SELECT * FROM device_registration_requests WHERE status = 'PENDING' ORDER BY created_at DESC`);
    const results: DeviceRegistrationRequest[] = [];
    while (stmt.step()) results.push(this.rowToRequest(stmt.getAsObject()));
    stmt.free();
    return results;
  }

  listAllRequests(): DeviceRegistrationRequest[] {
    const stmt = this.db.prepare(`SELECT * FROM device_registration_requests ORDER BY created_at DESC`);
    const results: DeviceRegistrationRequest[] = [];
    while (stmt.step()) results.push(this.rowToRequest(stmt.getAsObject()));
    stmt.free();
    return results;
  }

  getDeviceByFingerprint(organizationId: string, fingerprint: string): DeviceLicense | null {
    const stmt = this.db.prepare(`SELECT * FROM device_licenses WHERE organization_id = :orgId AND device_fingerprint = :fp LIMIT 1`);
    stmt.bind({ ':orgId': organizationId, ':fp': fingerprint });
    let device: DeviceLicense | null = null;
    if (stmt.step()) device = this.rowToLicense(stmt.getAsObject());
    stmt.free();
    return device;
  }

  getDeviceLicenseById(id: string): DeviceLicense | null {
    const stmt = this.db.prepare(`SELECT * FROM device_licenses WHERE id = :id LIMIT 1`);
    stmt.bind({ ':id': id });
    let device: DeviceLicense | null = null;
    if (stmt.step()) device = this.rowToLicense(stmt.getAsObject());
    stmt.free();
    return device;
  }

  getDeviceStats(): { totalActive: number; totalPending: number; totalSuspended: number; totalRevoked: number; byOrg: Array<{ orgId: string; orgName: string; active: number; maxAllowed: number }> } {
    const countByStatus = (s: string): number => {
      const st = this.db.prepare(`SELECT COUNT(*) as cnt FROM device_licenses WHERE status = :s`);
      st.bind({ ':s': s });
      let cnt = 0;
      if (st.step()) cnt = (st.getAsObject().cnt as number) || 0;
      st.free();
      return cnt;
    };
    const byOrgStmt = this.db.prepare(`
      SELECT dl.organization_id, o.name as org_name,
             SUM(CASE WHEN dl.status = 'ACTIVE' THEN 1 ELSE 0 END) as active_count,
             MAX(COALESCE(p.max_devices, 1)) as max_devices
      FROM device_licenses dl
      LEFT JOIN organizations o ON o.id = dl.organization_id
      LEFT JOIN subscriptions sub ON sub.organization_id = dl.organization_id
      LEFT JOIN subscription_plans p ON p.id = sub.plan_id
      GROUP BY dl.organization_id
    `);
    const byOrg: Array<{ orgId: string; orgName: string; active: number; maxAllowed: number }> = [];
    while (byOrgStmt.step()) {
      const row = byOrgStmt.getAsObject();
      byOrg.push({ orgId: (row.organization_id as string) || '', orgName: (row.org_name as string) || 'Unknown', active: (row.active_count as number) || 0, maxAllowed: (row.max_devices as number) || 1 });
    }
    byOrgStmt.free();
    return { totalActive: countByStatus('ACTIVE'), totalPending: countByStatus('PENDING_APPROVAL'), totalSuspended: countByStatus('SUSPENDED'), totalRevoked: countByStatus('REVOKED'), byOrg };
  }

  ensureDefaultOrgAndSubscription(): string {
    const now = new Date().toISOString();
    const orgStmt = this.db.prepare(`SELECT id FROM organizations LIMIT 1`);
    let orgId = '';
    if (orgStmt.step()) orgId = (orgStmt.getAsObject().id as string) || '';
    orgStmt.free();

    if (!orgId) {
      orgId = `org-default-${Date.now()}`;
      this.db.run(`INSERT OR IGNORE INTO organizations (id, name, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [orgId, 'My Business', 'MY-BIZ', now, now]);
    }

    const planStmt = this.db.prepare(`SELECT id FROM subscription_plans LIMIT 1`);
    let planId = '';
    if (planStmt.step()) planId = (planStmt.getAsObject().id as string) || '';
    planStmt.free();

    if (!planId) {
      planId = `plan-starter-${Date.now()}`;
      this.db.run(
        `INSERT OR IGNORE INTO subscription_plans (id, code, name, description, monthly_price, yearly_price, currency, trial_days, max_users, max_branches, max_devices, max_products, max_transactions, storage_limit_mb, entitlements_json, support_level, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [planId, 'STARTER', 'Starter', '14-day free trial', 0, 0, 'LKR', 14, 5, 1, 3, 5000, 10000, 1024, JSON.stringify(['pos', 'inventory', 'reports.basic']), 'STANDARD', 1, now, now]
      );
    }

    const subCheckStmt = this.db.prepare(`SELECT id, status FROM subscriptions WHERE organization_id = :orgId LIMIT 1`);
    subCheckStmt.bind({ ':orgId': orgId });
    let hasSub = false;
    if (subCheckStmt.step()) hasSub = true;
    subCheckStmt.free();

    if (!hasSub) {
      const subId = `sub-default-${Date.now()}`;
      const trialEnd = new Date(Date.now() + 14 * 86400_000).toISOString();
      this.db.run(
        `INSERT INTO subscriptions (id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_started_at, trial_ends_at, trial_used, created_at, updated_at) VALUES (?, ?, ?, 'TRIALING', 'MONTHLY', ?, ?, ?, ?, 0, ?, ?)`,
        [subId, orgId, planId, now, trialEnd, now, trialEnd, now, now]
      );
    }
    return orgId;
  }

  private rowToLicense(row: Record<string, unknown>): DeviceLicense {
    return {
      id: row.id as string,
      organizationId: (row.organization_id as string) || '',
      deviceFingerprint: (row.device_fingerprint as string) || '',
      deviceName: (row.device_name as string) || '',
      deviceType: (row.device_type as DeviceType) || 'POS_TERMINAL',
      macAddress: (row.mac_address as string) || null,
      hostname: (row.hostname as string) || null,
      osInfo: (row.os_info as string) || null,
      status: (row.status as DeviceStatus) || 'PENDING_APPROVAL',
      approvedBy: (row.approved_by as string) || null,
      approvedAt: (row.approved_at as string) || null,
      suspendedReason: (row.suspended_reason as string) || null,
      lastSeenAt: (row.last_seen_at as string) || null,
      registeredAt: (row.registered_at as string) || '',
      expiresAt: (row.expires_at as string) || null,
    };
  }

  private rowToRequest(row: Record<string, unknown>): DeviceRegistrationRequest {
    return {
      id: row.id as string,
      organizationId: (row.organization_id as string) || '',
      deviceFingerprint: (row.device_fingerprint as string) || '',
      deviceName: (row.device_name as string) || '',
      deviceType: (row.device_type as DeviceType) || 'POS_TERMINAL',
      macAddress: (row.mac_address as string) || null,
      hostname: (row.hostname as string) || null,
      osInfo: (row.os_info as string) || null,
      requestedBy: (row.requested_by as string) || '',
      requestNotes: (row.request_notes as string) || null,
      status: (row.status as 'PENDING' | 'APPROVED' | 'REJECTED') || 'PENDING',
      reviewedBy: (row.reviewed_by as string) || null,
      reviewedAt: (row.reviewed_at as string) || null,
      rejectionReason: (row.rejection_reason as string) || null,
      createdAt: (row.created_at as string) || '',
    };
  }

  private _auditLog(action: string, entityId: string, performedBy: string, now: string, reason?: string): void {
    try {
      const id = `audit-dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.db.run(`INSERT OR IGNORE INTO audit_logs (id, timestamp, action, entity_type, entity_id, reason, user_name, created_at) VALUES (?, ?, ?, 'DEVICE_LICENSE', ?, ?, ?, ?)`, [id, now, action, entityId, reason || null, performedBy, now]);
    } catch { /* non-critical */ }
  }
}
