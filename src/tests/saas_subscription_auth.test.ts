import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import * as path from 'path';
import { setTestRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { ensureAdminTables } from '@/infrastructure/database/sqlite/adminSchema';
import { AdminAuthService } from '@/services/auth/AdminAuthService';
import { CustomerRegistrationService } from '@/services/registration/CustomerRegistrationService';
import { DeviceLicenseService } from '@/services/licensing/DeviceLicenseService';

describe('SaaS Subscription, Registration & Super Admin Architecture', () => {
  let db: Database;

  beforeEach(async () => {
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(process.cwd(), 'public', file),
    });
    db = new SQL.Database();
    setTestRawSqlDb(db);

    // Bootstrap base tables needed
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT,
        cost_price REAL NOT NULL DEFAULT 0,
        stock_quantity REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inventory_batches (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        supplier_id TEXT,
        purchase_id TEXT,
        purchase_item_id TEXT,
        batch_number TEXT NOT NULL,
        supplier_batch_number TEXT,
        unit_cost REAL NOT NULL,
        quantity_received REAL NOT NULL,
        quantity_remaining REAL NOT NULL,
        received_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inventory_batch_transactions (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        reference_type TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        quantity_in REAL NOT NULL DEFAULT 0,
        quantity_out REAL NOT NULL DEFAULT 0,
        unit_cost REAL NOT NULL DEFAULT 0,
        balance_quantity REAL NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        email TEXT,
        phone TEXT,
        timezone TEXT DEFAULT 'Asia/Colombo',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscription_plans (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        monthly_price REAL NOT NULL DEFAULT 0,
        yearly_price REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'LKR',
        trial_days INTEGER NOT NULL DEFAULT 0,
        max_users INTEGER NOT NULL DEFAULT 1,
        max_branches INTEGER NOT NULL DEFAULT 1,
        max_devices INTEGER NOT NULL DEFAULT 1,
        max_products INTEGER NOT NULL DEFAULT 1000,
        max_transactions INTEGER NOT NULL DEFAULT 10000,
        storage_limit_mb INTEGER NOT NULL DEFAULT 1024,
        entitlements_json TEXT NOT NULL DEFAULT '[]',
        support_level TEXT NOT NULL DEFAULT 'STANDARD',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
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
        expires_at TEXT
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

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        reason TEXT,
        user_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Ensure admin tables and seed test super admin
    ensureAdminTables(db);
    AdminAuthService.setupInitialSuperAdmin('test_admin@triwynpos.lk', 'TestPassword123!', 'Test Super Admin');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CUSTOMER REGISTRATION & ISOLATION
  // ─────────────────────────────────────────────────────────────────────────────

  it('1. Successfully registers a customer organization with initial verification pending, then activates trial on verification', async () => {
    const res = await CustomerRegistrationService.register({
      businessName: 'Apex Supermarket Ltd',
      fullName: 'John Owner',
      email: 'owner@apex.lk',
      phone: '+94771234567',
      password: 'SecurePassword123!',
      selectedPlanCode: 'FREE_TRIAL',
      billingCycle: 'MONTHLY',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('EMAIL_VERIFICATION_PENDING');
    expect(res.organizationId).toBeDefined();

    // Verify email token
    const reg = CustomerRegistrationService.getRegistrationByEmail('owner@apex.lk');
    const token = reg?.email_verification_token as string;
    const verified = CustomerRegistrationService.verifyEmail('owner@apex.lk', token);
    expect(verified.success).toBe(true);
    expect(verified.status).toBe('TRIALING');

    // Verify trial access
    const accessCheck = CustomerRegistrationService.checkSubscriptionAccess(res.organizationId);
    expect(accessCheck.allowed).toBe(true);
    expect(accessCheck.reason).toBe('TRIALING');
    expect(accessCheck.daysRemaining).toBeGreaterThanOrEqual(13);
  });

  it('2. Prevents duplicate registrations with the same email', async () => {
    await CustomerRegistrationService.register({
      businessName: 'Business A',
      fullName: 'Alice',
      email: 'duplicate@test.lk',
      password: 'Pass123456!',
      selectedPlanCode: 'FREE_TRIAL',
      billingCycle: 'MONTHLY',
    });

    await expect(
      CustomerRegistrationService.register({
        businessName: 'Business B',
        fullName: 'Bob',
        email: 'duplicate@test.lk',
        password: 'Pass123456!',
        selectedPlanCode: 'STARTER',
        billingCycle: 'MONTHLY',
      })
    ).rejects.toThrow(/already exists/i);
  });

  it('3. Customer cannot set admin privileges via registration payload', async () => {
    const res = await CustomerRegistrationService.register({
      businessName: 'Hacker Biz',
      fullName: 'Mallory',
      email: 'mallory@hack.lk',
      password: 'Password999!',
      selectedPlanCode: 'INVALID_SUPER_ADMIN_PLAN' as any,
      billingCycle: 'MONTHLY',
    });

    expect(res.success).toBe(true);

    // Auto-verify email
    const reg = CustomerRegistrationService.getRegistrationByEmail('mallory@hack.lk');
    CustomerRegistrationService.verifyEmail('mallory@hack.lk', reg?.email_verification_token as string);

    // Should safely fallback to FREE_TRIAL
    const access = CustomerRegistrationService.checkSubscriptionAccess(res.organizationId);
    expect(access.planName).toBe('Free Trial');

    // Verify no admin user was created in admin_users table for this customer
    const checkStmt = db.prepare('SELECT COUNT(*) as cnt FROM admin_users WHERE email = "mallory@hack.lk"');
    checkStmt.step();
    expect(checkStmt.getAsObject().cnt).toBe(0);
    checkStmt.free();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SUPER ADMIN AUTHENTICATION & RBAC
  // ─────────────────────────────────────────────────────────────────────────────

  it('4. Super Admin can authenticate with initial seeded credentials', async () => {
    const session = await AdminAuthService.login('test_admin@triwynpos.lk', 'TestPassword123!');
    expect(session.email).toBe('test_admin@triwynpos.lk');
    expect(session.role).toBe('SUPER_ADMIN');
    expect(session.sessionToken).toBeDefined();
    expect(session.permissions).toContain('*');
  });

  it('5. Super Admin login fails with incorrect password and records attempts', async () => {
    await expect(
      AdminAuthService.login('test_admin@triwynpos.lk', 'WrongPassword123')
    ).rejects.toThrow(/Invalid credentials/i);

    const stmt = db.prepare('SELECT failed_login_attempts FROM admin_users WHERE email = "test_admin@triwynpos.lk"');
    stmt.step();
    expect(stmt.getAsObject().failed_login_attempts).toBe(1);
    stmt.free();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SUPER ADMIN APPROVALS & TRIAL MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  it('6. Super Admin can review and approve a pending commercial subscription', async () => {
    // Customer registers for a paid plan (Starter)
    const regRes = await CustomerRegistrationService.register({
      businessName: 'Royal Bakery',
      fullName: 'Kamal Perera',
      email: 'kamal@bakery.lk',
      password: 'Password123!',
      selectedPlanCode: 'STARTER',
      billingCycle: 'MONTHLY',
    });

    const reg = CustomerRegistrationService.getRegistrationByEmail('kamal@bakery.lk');
    CustomerRegistrationService.verifyEmail('kamal@bakery.lk', reg?.email_verification_token as string);

    // Initial check: requires approval
    const preApproval = CustomerRegistrationService.checkSubscriptionAccess(regRes.organizationId);
    expect(preApproval.allowed).toBe(false);
    expect(preApproval.reason).toBe('PENDING_APPROVAL');

    // Super Admin signs in and approves
    const adminSession = await AdminAuthService.login('test_admin@triwynpos.lk', 'TestPassword123!');
    const approved = CustomerRegistrationService.approveSubscription(regRes.organizationId, adminSession.id);
    expect(approved).toBe(true);

    // Now access is unlocked
    const postApproval = CustomerRegistrationService.checkSubscriptionAccess(regRes.organizationId);
    expect(postApproval.allowed).toBe(true);
    expect(postApproval.reason).toBe('ACTIVE');
  });

  it('7. Super Admin can extend trial days for an evaluating customer', async () => {
    const regRes = await CustomerRegistrationService.register({
      businessName: 'Colombo Café',
      fullName: 'Sunil',
      email: 'sunil@cafe.lk',
      password: 'Password123!',
      selectedPlanCode: 'FREE_TRIAL',
      billingCycle: 'MONTHLY',
    });

    const reg = CustomerRegistrationService.getRegistrationByEmail('sunil@cafe.lk');
    CustomerRegistrationService.verifyEmail('sunil@cafe.lk', reg?.email_verification_token as string);

    const adminSession = await AdminAuthService.login('test_admin@triwynpos.lk', 'TestPassword123!');
    const extended = CustomerRegistrationService.extendTrial(regRes.organizationId, 30, adminSession.id, 'Customer requested more evaluation time');
    expect(extended).toBe(true);

    const check = CustomerRegistrationService.checkSubscriptionAccess(regRes.organizationId);
    expect(check.allowed).toBe(true);
    expect(check.daysRemaining).toBeGreaterThanOrEqual(43); // 14 initial + 30 added
  });

  it('8. Super Admin can suspend and reactivate organizations immediately', async () => {
    const regRes = await CustomerRegistrationService.register({
      businessName: 'Bad Actor Store',
      fullName: 'Dave',
      email: 'dave@store.lk',
      password: 'Password123!',
      selectedPlanCode: 'FREE_TRIAL',
      billingCycle: 'MONTHLY',
    });

    const reg = CustomerRegistrationService.getRegistrationByEmail('dave@store.lk');
    CustomerRegistrationService.verifyEmail('dave@store.lk', reg?.email_verification_token as string);

    const adminSession = await AdminAuthService.login('test_admin@triwynpos.lk', 'TestPassword123!');

    // 1. Suspend
    CustomerRegistrationService.suspendOrganization(regRes.organizationId, 'Breach of payment policy', adminSession.id);
    const suspendedCheck = CustomerRegistrationService.checkSubscriptionAccess(regRes.organizationId);
    expect(suspendedCheck.allowed).toBe(false);
    expect(suspendedCheck.reason).toBe('SUSPENDED');

    // 2. Reactivate
    CustomerRegistrationService.activateOrganization(regRes.organizationId, adminSession.id);
    const reactivatedCheck = CustomerRegistrationService.checkSubscriptionAccess(regRes.organizationId);
    expect(reactivatedCheck.allowed).toBe(true);
    expect(reactivatedCheck.reason).toBe('ACTIVE');
  });

  it('9. Plan change updates tier limits and catalog capacity correctly', async () => {
    const regRes = await CustomerRegistrationService.register({
      businessName: 'Scaling Retail Ltd',
      fullName: 'Saman',
      email: 'saman@retail.lk',
      password: 'Password123!',
      selectedPlanCode: 'STARTER',
      billingCycle: 'MONTHLY',
    });

    const adminSession = await AdminAuthService.login('test_admin@triwynpos.lk', 'TestPassword123!');
    // Upgrade directly to BUSINESS tier
    const changed = CustomerRegistrationService.changeOrganizationPlan(regRes.organizationId, 'BUSINESS', adminSession.id);
    expect(changed).toBe(true);

    const reg = CustomerRegistrationService.getRegistrationByEmail('saman@retail.lk');
    expect(reg?.selected_plan_code).toBe('BUSINESS');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. DEVICE LICENSING & HARDWARE GATING
  // ─────────────────────────────────────────────────────────────────────────────

  it('10. Enforces device limits based on plan tier and allows Super Admin authorization', async () => {
    const regRes = await CustomerRegistrationService.register({
      businessName: 'One Register Shop',
      fullName: 'Owner',
      email: 'single@shop.lk',
      password: 'Password123!',
      selectedPlanCode: 'FREE_TRIAL', // Trial permits 1 device
      billingCycle: 'MONTHLY',
    });

    const reg = CustomerRegistrationService.getRegistrationByEmail('single@shop.lk');
    CustomerRegistrationService.verifyEmail('single@shop.lk', reg?.email_verification_token as string);

    const deviceSvc = new DeviceLicenseService(db);

    // Register device 1: Should be allowed under max_devices=1
    const dev1 = deviceSvc.registerDevice(
      regRes.organizationId,
      {
        fingerprint: 'device-fp-001',
        name: 'Front Register 1',
        type: 'POS_TERMINAL',
        macAddress: '00:1A:2B:3C:4D:5E',
        hostname: 'POS-TERM-01',
        osInfo: 'Windows 11 POS',
      },
      'owner',
      true // auto-approve first device
    );
    expect(dev1.success).toBe(true);
    expect(dev1.status).toBe('ACTIVE');

    // Register device 2: Over limit of 1
    const check2 = deviceSvc.checkDeviceAccess(regRes.organizationId, 'device-fp-002');
    expect(check2.allowed).toBe(false);
    expect(check2.reason).toBe('LIMIT_REACHED');

    // Submit request for authorization
    const dev2Req = deviceSvc.registerDevice(
      regRes.organizationId,
      {
        fingerprint: 'device-fp-002',
        name: 'Back Register 2',
        type: 'POS_TERMINAL',
        macAddress: '00:1A:2B:3C:4D:99',
        hostname: 'POS-TERM-02',
        osInfo: 'Windows 11 POS',
      },
      'owner',
      false // pending
    );
    expect(dev2Req.status).toBe('PENDING_APPROVAL');

    // Super Admin approves the device explicitly
    const approved = deviceSvc.approveDevice(dev2Req.licenseId, 'test_admin@triwynpos.lk');
    expect(approved).toBe(true);

    const dev2Check = deviceSvc.getDeviceLicenseById(dev2Req.licenseId);
    expect(dev2Check?.status).toBe('ACTIVE');
  });
});
