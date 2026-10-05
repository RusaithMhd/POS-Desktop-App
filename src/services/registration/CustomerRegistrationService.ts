import bcrypt from 'bcryptjs';
import { Database } from 'sql.js';
import { getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type RegistrationStatus =
  | 'REGISTERED'
  | 'EMAIL_VERIFICATION_PENDING'
  | 'EMAIL_VERIFIED'
  | 'TRIALING'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_RECEIVED'
  | 'SUBSCRIPTION_PENDING_APPROVAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface RegistrationPayload {
  businessName: string;
  fullName: string;
  email: string;
  phone?: string;
  country?: string;
  password: string;
  selectedPlanCode: 'FREE_TRIAL' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE';
  billingCycle: 'MONTHLY' | 'YEARLY';
  businessRegNumber?: string;
  address?: string;
  industry?: string;
  timezone?: string;
  currency?: string;
}

export interface RegistrationResult {
  success: boolean;
  registrationId: string;
  organizationId: string;
  status: RegistrationStatus;
  message: string;
  trialEndsAt?: string;
}

export interface SubscriptionAccessCheck {
  allowed: boolean;
  reason: 'ACTIVE' | 'TRIALING' | 'EXPIRED' | 'SUSPENDED' | 'PENDING_APPROVAL' | 'NO_SUBSCRIPTION' | 'EMAIL_NOT_VERIFIED';
  daysRemaining?: number;
  planName: string;
  status: RegistrationStatus;
  organizationId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export const PLAN_CATALOG = {
  FREE_TRIAL:    { name: 'Free Trial',    monthlyPrice: 0,       yearlyPrice: 0,        maxUsers: 2,  maxDevices: 1,  maxBranches: 1, maxProducts: 500,   trialDays: 14 },
  STARTER:       { name: 'Starter',       monthlyPrice: 2999,    yearlyPrice: 29990,    maxUsers: 3,  maxDevices: 2,  maxBranches: 1, maxProducts: 2000,  trialDays: 0  },
  PROFESSIONAL:  { name: 'Professional',  monthlyPrice: 5999,    yearlyPrice: 59990,    maxUsers: 10, maxDevices: 5,  maxBranches: 2, maxProducts: 10000, trialDays: 0  },
  BUSINESS:      { name: 'Business',      monthlyPrice: 11999,   yearlyPrice: 119990,   maxUsers: 25, maxDevices: 10, maxBranches: 5, maxProducts: 50000, trialDays: 0  },
  ENTERPRISE:    { name: 'Enterprise',    monthlyPrice: 0,       yearlyPrice: 0,        maxUsers: 999,maxDevices: 50, maxBranches: 50,maxProducts: 999999,trialDays: 0  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export class CustomerRegistrationService {
  // ---------------------------------------------------------------------------
  // REGISTER NEW CUSTOMER
  // ---------------------------------------------------------------------------

  static async register(payload: RegistrationPayload): Promise<RegistrationResult> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();

    // Security: NEVER allow customer to set admin roles
    const safePlanCodes = ['FREE_TRIAL', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE'];
    const planCode = safePlanCodes.includes(payload.selectedPlanCode) ? payload.selectedPlanCode : 'FREE_TRIAL';
    const plan = PLAN_CATALOG[planCode as keyof typeof PLAN_CATALOG];

    // Check for duplicate email
    const dupCheck = db.prepare(`SELECT id FROM customer_registrations WHERE email = :email LIMIT 1`);
    dupCheck.bind({ ':email': payload.email.toLowerCase().trim() });
    if (dupCheck.step()) {
      dupCheck.free();
      throw new Error('An account with this email already exists. Please log in instead.');
    }
    dupCheck.free();

    const regId = `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const orgId = `org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = bcrypt.hashSync(payload.password, 12);
    const verificationToken = this.generateToken(32);

    const isTrial = planCode === 'FREE_TRIAL';
    const trialEndsAt = isTrial
      ? new Date(Date.now() + plan.trialDays * 86400_000).toISOString()
      : null;

    const initialStatus: RegistrationStatus = 'EMAIL_VERIFICATION_PENDING';

    try {
      // 1. Create customer_registration record
      db.run(
        `INSERT INTO customer_registrations
          (id, organization_id, email, full_name, business_name, phone, country, password_hash, selected_plan_code, billing_cycle, status, email_verification_token, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [regId, orgId, payload.email.toLowerCase().trim(), payload.fullName, payload.businessName, payload.phone || null, payload.country || null, passwordHash, planCode, payload.billingCycle, initialStatus, verificationToken, now, now]
      );

      // 2. Create organization
      const orgCode = this.generateOrgCode(payload.businessName);
      db.run(
        `INSERT OR IGNORE INTO organizations (id, name, code, email, phone, timezone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orgId, payload.businessName, orgCode, payload.email.toLowerCase().trim(), payload.phone || null, payload.timezone || 'Asia/Colombo', now, now]
      );

      // 3. Create subscription plan if not exists (for this plan type)
      this.ensurePlanExists(db, planCode, plan, now);

      // 4. Create subscription record
      const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const planRow = db.prepare(`SELECT id FROM subscription_plans WHERE code = :code LIMIT 1`);
      planRow.bind({ ':code': planCode });
      let planId = '';
      if (planRow.step()) planId = (planRow.getAsObject().id as string) || '';
      planRow.free();

      if (planId) {
        const subStatus = isTrial ? 'TRIALING' : 'INCOMPLETE';
        const periodEnd = isTrial ? trialEndsAt! : new Date(Date.now() + 30 * 86400_000).toISOString();
        db.run(
          `INSERT OR IGNORE INTO subscriptions
            (id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_started_at, trial_ends_at, trial_used, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [subId, orgId, planId, subStatus, payload.billingCycle, now, periodEnd, isTrial ? now : null, isTrial ? trialEndsAt : null, isTrial ? 1 : 0, now, now]
        );
      }

      saveLocalDbState();

      // In production: send email verification here
      // For offline: auto-verify (simulate email click)
      // We skip actual email sending for offline desktop app
      // and instead provide the token in the response so the status page can auto-verify
      console.log(`[Registration] Email verification token for ${payload.email}: ${verificationToken}`);

      return {
        success: true,
        registrationId: regId,
        organizationId: orgId,
        status: initialStatus,
        message: isTrial
          ? 'Registration successful! Please verify your email to activate your free trial.'
          : `Registration successful! Please verify your email and complete payment for the ${plan.name} plan.`,
        trialEndsAt: trialEndsAt || undefined,
      };
    } catch (err: any) {
      throw new Error(`Registration failed: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // EMAIL VERIFICATION (simulate for offline — in production hit an API)
  // ---------------------------------------------------------------------------

  static verifyEmail(email: string, token: string): { success: boolean; status: RegistrationStatus; organizationId: string } {
    const db = getRawSqlDb();
    const stmt = db.prepare(
      `SELECT * FROM customer_registrations WHERE email = :email AND email_verification_token = :token LIMIT 1`
    );
    stmt.bind({ ':email': email.toLowerCase().trim(), ':token': token });

    if (!stmt.step()) {
      stmt.free();
      throw new Error('Invalid or expired verification link.');
    }

    const reg = stmt.getAsObject();
    stmt.free();

    const now = new Date().toISOString();
    const planCode = reg.selected_plan_code as string;
    const isTrial = planCode === 'FREE_TRIAL';

    const newRegStatus: RegistrationStatus = isTrial ? 'TRIALING' : 'PAYMENT_PENDING';

    // Update registration
    db.run(
      `UPDATE customer_registrations SET status = ?, email_verified_at = ?, updated_at = ? WHERE id = ?`,
      [newRegStatus, now, now, reg.id]
    );

    // If trial: activate subscription immediately
    if (isTrial) {
      db.run(
        `UPDATE subscriptions SET status = 'TRIALING', updated_at = ? WHERE organization_id = ?`,
        [now, reg.organization_id]
      );
    }

    saveLocalDbState();

    return {
      success: true,
      status: newRegStatus,
      organizationId: reg.organization_id as string,
    };
  }

  // ---------------------------------------------------------------------------
  // AUTO-VERIFY for offline desktop mode
  // ---------------------------------------------------------------------------

  static autoVerifyForDesktop(email: string): RegistrationStatus {
    const db = getRawSqlDb();
    const stmt = db.prepare(`SELECT * FROM customer_registrations WHERE email = :email LIMIT 1`);
    stmt.bind({ ':email': email.toLowerCase().trim() });
    if (!stmt.step()) { stmt.free(); throw new Error('Registration not found.'); }
    const reg = stmt.getAsObject();
    stmt.free();

    const token = reg.email_verification_token as string;
    const result = this.verifyEmail(email, token);
    return result.status;
  }

  // ---------------------------------------------------------------------------
  // SUBSCRIPTION ACCESS GATE (called before showing POS)
  // ---------------------------------------------------------------------------

  static checkSubscriptionAccess(organizationId: string): SubscriptionAccessCheck {
    const db = getRawSqlDb();

    const stmt = db.prepare(`
      SELECT s.status, s.trial_ends_at, s.current_period_end, s.grace_period_ends_at,
             p.name as plan_name, cr.status as reg_status, cr.email_verified_at
      FROM subscriptions s
      JOIN subscription_plans p ON p.id = s.plan_id
      LEFT JOIN customer_registrations cr ON cr.organization_id = s.organization_id
      WHERE s.organization_id = :orgId
      ORDER BY s.created_at DESC
      LIMIT 1
    `);
    stmt.bind({ ':orgId': organizationId });

    if (!stmt.step()) {
      stmt.free();
      return { allowed: false, reason: 'NO_SUBSCRIPTION', planName: 'None', status: 'REGISTERED', organizationId };
    }

    const row = stmt.getAsObject();
    stmt.free();

    const subStatus = row.status as string;
    const planName = (row.plan_name as string) || 'Unknown';
    const regStatus = (row.reg_status as RegistrationStatus) || 'REGISTERED';
    const emailVerifiedAt = row.email_verified_at as string;

    // Email not verified
    if (!emailVerifiedAt) {
      return { allowed: false, reason: 'EMAIL_NOT_VERIFIED', planName, status: regStatus, organizationId };
    }

    if (subStatus === 'TRIALING') {
      const trialEnd = row.trial_ends_at as string;
      const msLeft = trialEnd ? new Date(trialEnd).getTime() - Date.now() : -1;
      const daysRemaining = msLeft > 0 ? Math.ceil(msLeft / 86400_000) : 0;
      if (daysRemaining <= 0) {
        // Mark as expired
        db.run(`UPDATE subscriptions SET status = 'EXPIRED', updated_at = ? WHERE organization_id = ?`, [new Date().toISOString(), organizationId]);
        return { allowed: false, reason: 'EXPIRED', planName, status: 'EXPIRED', organizationId };
      }
      return { allowed: true, reason: 'TRIALING', daysRemaining, planName, status: 'TRIALING', organizationId };
    }

    if (subStatus === 'ACTIVE') {
      return { allowed: true, reason: 'ACTIVE', planName, status: 'ACTIVE', organizationId };
    }

    if (subStatus === 'GRACE_PERIOD') {
      const graceEnd = row.grace_period_ends_at as string;
      const daysLeft = graceEnd ? Math.max(0, Math.ceil((new Date(graceEnd).getTime() - Date.now()) / 86400_000)) : 0;
      return { allowed: true, reason: 'ACTIVE', daysRemaining: daysLeft, planName, status: 'ACTIVE', organizationId };
    }

    if (subStatus === 'SUSPENDED') return { allowed: false, reason: 'SUSPENDED', planName, status: 'SUSPENDED', organizationId };
    if (subStatus === 'TRIALING' || subStatus === 'INCOMPLETE' || subStatus === 'PAYMENT_FAILED') {
      return { allowed: false, reason: 'PENDING_APPROVAL', planName, status: regStatus, organizationId };
    }

    return { allowed: false, reason: 'EXPIRED', planName, status: 'EXPIRED', organizationId };
  }

  // ---------------------------------------------------------------------------
  // GET REGISTRATION BY EMAIL
  // ---------------------------------------------------------------------------

  static getRegistrationByEmail(email: string): Record<string, unknown> | null {
    const db = getRawSqlDb();
    const stmt = db.prepare(`SELECT * FROM customer_registrations WHERE email = :email LIMIT 1`);
    stmt.bind({ ':email': email.toLowerCase().trim() });
    if (!stmt.step()) { stmt.free(); return null; }
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  static getRegistrationByOrgId(orgId: string): Record<string, unknown> | null {
    const db = getRawSqlDb();
    const stmt = db.prepare(`SELECT * FROM customer_registrations WHERE organization_id = :orgId LIMIT 1`);
    stmt.bind({ ':orgId': orgId });
    if (!stmt.step()) { stmt.free(); return null; }
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  // ---------------------------------------------------------------------------
  // ALL REGISTRATIONS (for Super Admin)
  // ---------------------------------------------------------------------------

  static ensureDefaultRegistrations(db: any): void {
    try {
      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM customer_registrations`);
      let count = 0;
      if (countStmt.step()) {
        count = (countStmt.getAsObject().count as number) || 0;
      }
      countStmt.free();

      if (count === 0) {
        const now = new Date().toISOString();
        const trialEnd = new Date(Date.now() + 14 * 86400_000).toISOString();

        // 1. Merchant 1
        db.run(
          `INSERT OR IGNORE INTO customer_registrations
            (id, organization_id, email, full_name, business_name, phone, country, password_hash, selected_plan_code, billing_cycle, status, created_at, updated_at)
           VALUES ('reg-demo-1', 'org-1791213425877-466xxh', 'chlifrost@gmail.com', 'Rusaith Muhammathu', 'TFTFTF', '0770802365', 'Sri Lanka', 'demo_hash', 'FREE_TRIAL', 'monthly', 'ACTIVE', datetime('now', '-2 days'), datetime('now'))`
        );
        db.run(
          `INSERT OR IGNORE INTO subscriptions
            (id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_ends_at, created_at, updated_at)
           VALUES ('sub-demo-1', 'org-1791213425877-466xxh', 'plan-free-trial', 'ACTIVE', 'monthly', datetime('now', '-2 days'), ?, ?, datetime('now', '-2 days'), datetime('now'))`,
          [trialEnd, trialEnd]
        );

        // 2. Merchant 2
        db.run(
          `INSERT OR IGNORE INTO customer_registrations
            (id, organization_id, email, full_name, business_name, phone, country, password_hash, selected_plan_code, billing_cycle, status, created_at, updated_at)
           VALUES ('reg-demo-2', 'org-1791204899120-881bba', 'chlifrost.tl@gmail.com', 'Rusaith Muhammathu', 'Rusaith Retail', '0750802353', 'Sri Lanka', 'demo_hash', 'FREE_TRIAL', 'monthly', 'TRIALING', datetime('now', '-1 hours'), datetime('now'))`
        );
        db.run(
          `INSERT OR IGNORE INTO subscriptions
            (id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_ends_at, created_at, updated_at)
           VALUES ('sub-demo-2', 'org-1791204899120-881bba', 'plan-free-trial', 'TRIALING', 'monthly', datetime('now'), ?, ?, datetime('now'), datetime('now'))`,
          [trialEnd, trialEnd]
        );

        // 3. Merchant 3
        db.run(
          `INSERT OR IGNORE INTO customer_registrations
            (id, organization_id, email, full_name, business_name, phone, country, password_hash, selected_plan_code, billing_cycle, status, created_at, updated_at)
           VALUES ('reg-demo-3', 'org-1791198421045-992ccd', 'rusairzeck72@gmail.com', 'Muhammathu Rusaith', 'Apex Commercial', '0770802365', 'Sri Lanka', 'demo_hash', 'STARTER', 'yearly', 'ACTIVE', datetime('now', '-5 days'), datetime('now'))`
        );
        db.run(
          `INSERT OR IGNORE INTO subscriptions
            (id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_ends_at, created_at, updated_at)
           VALUES ('sub-demo-3', 'org-1791198421045-992ccd', 'plan-starter', 'ACTIVE', 'yearly', datetime('now', '-5 days'), datetime('now', '+360 days'), null, datetime('now', '-5 days'), datetime('now'))`
        );

        // 4. Default Devices
        db.run(
          `INSERT OR IGNORE INTO registered_devices
            (id, organization_id, device_name, device_type, terminal_code, status, registered_at)
           VALUES ('dev-demo-1', 'org-1791213425877-466xxh', 'POS Counter 01 - Windows NSIS', 'DESKTOP_POS', 'TERM-01', 'ACTIVE', datetime('now', '-2 days'))`
        );
        db.run(
          `INSERT OR IGNORE INTO registered_devices
            (id, organization_id, device_name, device_type, terminal_code, status, registered_at)
           VALUES ('dev-demo-2', 'org-1791198421045-992ccd', 'Front Cashier - Main Terminal', 'DESKTOP_POS', 'TERM-02', 'ACTIVE', datetime('now', '-5 days'))`
        );

        saveLocalDbState();
      }
    } catch (e) {
      console.error('Failed to seed default demo registrations:', e);
    }
  }

  static listAllRegistrations(): Record<string, unknown>[] {
    const db = getRawSqlDb();
    this.ensureDefaultRegistrations(db);
    const stmt = db.prepare(`
      SELECT cr.*, 
             s.status as sub_status, s.trial_ends_at,
             p.name as plan_name
      FROM customer_registrations cr
      LEFT JOIN subscriptions s ON s.organization_id = cr.organization_id
      LEFT JOIN subscription_plans p ON p.id = s.plan_id
      ORDER BY cr.created_at DESC
    `);
    const results: Record<string, unknown>[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  // ---------------------------------------------------------------------------
  // APPROVE SUBSCRIPTION (Super Admin action)
  // ---------------------------------------------------------------------------

  static approveSubscription(organizationId: string, adminId: string): boolean {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 86400_000).toISOString();
    try {
      db.run(
        `UPDATE subscriptions SET status = 'ACTIVE', current_period_start = ?, current_period_end = ?, updated_at = ? WHERE organization_id = ?`,
        [now, periodEnd, now, organizationId]
      );
      db.run(
        `UPDATE customer_registrations SET status = 'ACTIVE', updated_at = ? WHERE organization_id = ?`,
        [now, organizationId]
      );
      // Audit
      const id = `sub_evt-${Date.now()}`;
      try {
        db.run(
          `INSERT OR IGNORE INTO subscription_events (id, organization_id, subscription_id, event_type, source, performed_by, created_at)
           SELECT ?, organization_id, id, 'PLAN_ACTIVATED', 'ADMIN_OVERRIDE', ?, ? FROM subscriptions WHERE organization_id = ?`,
          [id, adminId, now, organizationId]
        );
      } catch { /* subscription_events may be missing org */ }
      saveLocalDbState();
      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // SUSPEND ORGANIZATION (Super Admin action)
  // ---------------------------------------------------------------------------

  static suspendOrganization(organizationId: string, reason: string, adminId: string): boolean {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    try {
      db.run(`UPDATE subscriptions SET status = 'SUSPENDED', updated_at = ? WHERE organization_id = ?`, [now, organizationId]);
      db.run(`UPDATE customer_registrations SET status = 'SUSPENDED', notes = ?, updated_at = ? WHERE organization_id = ?`, [reason, now, organizationId]);
      saveLocalDbState();

      if (isSupabaseConfigured && supabase) {
        supabase.from('customer_registrations').update({ status: 'SUSPENDED', notes: reason, updated_at: now }).eq('organization_id', organizationId).then();
        supabase.from('subscriptions').update({ status: 'SUSPENDED', updated_at: now }).eq('organization_id', organizationId).then();
      }

      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // REACTIVATE ORGANIZATION (Super Admin action)
  // ---------------------------------------------------------------------------

  static activateOrganization(organizationId: string, adminId: string): boolean {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    try {
      db.run(`UPDATE subscriptions SET status = 'ACTIVE', updated_at = ? WHERE organization_id = ?`, [now, organizationId]);
      db.run(`UPDATE customer_registrations SET status = 'ACTIVE', updated_at = ? WHERE organization_id = ?`, [now, organizationId]);
      saveLocalDbState();

      if (isSupabaseConfigured && supabase) {
        supabase.from('customer_registrations').update({ status: 'ACTIVE', updated_at: now }).eq('organization_id', organizationId).then();
        supabase.from('subscriptions').update({ status: 'ACTIVE', updated_at: now }).eq('organization_id', organizationId).then();
      }

      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // CHANGE PLAN (Super Admin action)
  // ---------------------------------------------------------------------------

  static changeOrganizationPlan(organizationId: string, planCode: string, adminId: string): boolean {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    try {
      const plan = PLAN_CATALOG[planCode as keyof typeof PLAN_CATALOG];
      if (!plan) return false;
      this.ensurePlanExists(db, planCode, plan, now);

      const planStmt = db.prepare(`SELECT id FROM subscription_plans WHERE code = :code LIMIT 1`);
      planStmt.bind({ ':code': planCode });
      let planId = '';
      if (planStmt.step()) planId = (planStmt.getAsObject().id as string) || '';
      planStmt.free();

      if (!planId) return false;

      db.run(
        `UPDATE subscriptions SET plan_id = ?, updated_at = ? WHERE organization_id = ?`,
        [planId, now, organizationId]
      );
      db.run(
        `UPDATE customer_registrations SET selected_plan_code = ?, updated_at = ? WHERE organization_id = ?`,
        [planCode, now, organizationId]
      );
      saveLocalDbState();
      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // EXTEND TRIAL (Super Admin action)
  // ---------------------------------------------------------------------------

  static extendTrial(organizationId: string, additionalDays: number, adminId: string, reason: string): boolean {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    try {
      const stmt = db.prepare(`SELECT trial_ends_at FROM subscriptions WHERE organization_id = :orgId LIMIT 1`);
      stmt.bind({ ':orgId': organizationId });
      let currentEnd = '';
      if (stmt.step()) currentEnd = (stmt.getAsObject().trial_ends_at as string) || '';
      stmt.free();

      const base = currentEnd && new Date(currentEnd) > new Date() ? new Date(currentEnd) : new Date();
      const newEnd = new Date(base.getTime() + additionalDays * 86400_000).toISOString();

      db.run(
        `UPDATE subscriptions SET trial_ends_at = ?, status = 'TRIALING', current_period_end = ?, updated_at = ? WHERE organization_id = ?`,
        [newEnd, newEnd, now, organizationId]
      );
      db.run(`UPDATE customer_registrations SET status = 'TRIALING', updated_at = ? WHERE organization_id = ?`, [now, organizationId]);
      saveLocalDbState();

      if (isSupabaseConfigured && supabase) {
        supabase.from('subscriptions').update({
          status: 'TRIALING',
          trial_ends_at: newEnd,
          current_period_end: newEnd,
          updated_at: now,
        }).eq('organization_id', organizationId).then();

        supabase.from('customer_registrations').update({
          status: 'TRIALING',
          updated_at: now,
        }).eq('organization_id', organizationId).then();
      }

      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // 14-DAY FREE TRIAL REGISTRATION (No credit card, no complex credentials)
  // ---------------------------------------------------------------------------

  static async registerFreeTrial(payload: {
    fullName: string;
    businessName: string;
    phone: string;
    email: string;
    country?: string;
  }): Promise<{ trialId: string; businessName: string; expiryDate: string; organizationId: string }> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const trialDays = 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 86400_000).toISOString();
    const trialId = `TRIAL-${Math.floor(100000 + Math.random() * 900000)}`;

    const regId = `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const orgId = `org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempPasswordHash = bcrypt.hashSync(`Trial@${trialId}`, 10);

    // 1. Insert customer registration with TRIALING status
    db.run(
      `INSERT INTO customer_registrations
        (id, organization_id, email, full_name, business_name, phone, country, password_hash, selected_plan_code, billing_cycle, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FREE_TRIAL', 'MONTHLY', 'TRIALING', ?, ?, ?)`,
      [regId, orgId, payload.email.toLowerCase().trim(), payload.fullName, payload.businessName, payload.phone || null, payload.country || 'Sri Lanka', tempPasswordHash, trialId, now, now]
    );

    // 2. Insert or update organization
    const orgCode = this.generateOrgCode(payload.businessName);
    db.run(
      `INSERT OR REPLACE INTO organizations (id, name, code, email, phone, timezone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'Asia/Colombo', ?, ?)`,
      [orgId, payload.businessName, orgCode, payload.email.toLowerCase().trim(), payload.phone || null, now, now]
    );

    // 3. Ensure plan exists
    this.ensurePlanExists(db, 'FREE_TRIAL', PLAN_CATALOG.FREE_TRIAL, now);

    // 4. Create subscription
    const planRow = db.prepare(`SELECT id FROM subscription_plans WHERE code = 'FREE_TRIAL' LIMIT 1`);
    let planId = '';
    if (planRow.step()) planId = (planRow.getAsObject().id as string) || '';
    planRow.free();

    const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    db.run(
      `INSERT OR REPLACE INTO subscriptions
        (id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_started_at, trial_ends_at, trial_used, created_at, updated_at)
       VALUES (?, ?, ?, 'TRIALING', 'MONTHLY', ?, ?, ?, ?, 1, ?, ?)`,
      [subId, orgId, planId, now, trialEndsAt, now, trialEndsAt, now, now]
    );

    saveLocalDbState();

    // 5. Sync to Supabase Cloud if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('organizations').upsert({
          id: orgId,
          name: payload.businessName,
          code: orgCode,
          email: payload.email.toLowerCase().trim(),
          phone: payload.phone || null,
        });

        await supabase.from('customer_registrations').upsert({
          id: regId,
          organization_id: orgId,
          email: payload.email.toLowerCase().trim(),
          full_name: payload.fullName,
          business_name: payload.businessName,
          phone: payload.phone || null,
          country: payload.country || 'Sri Lanka',
          selected_plan_code: 'FREE_TRIAL',
          billing_cycle: 'monthly',
          status: 'TRIALING',
        });

        await supabase.from('subscriptions').upsert({
          id: subId,
          organization_id: orgId,
          status: 'TRIALING',
          billing_cycle: 'monthly',
          trial_ends_at: trialEndsAt,
        });
      } catch (err) {
        console.warn('[Supabase] Free trial cloud sync error:', err);
      }
    }

    return {
      trialId,
      businessName: payload.businessName,
      expiryDate: new Date(trialEndsAt).toLocaleDateString(),
      organizationId: orgId,
    };
  }

  // ---------------------------------------------------------------------------
  // SUPER ADMIN MANUAL ACTIVATION (After Bank Transfer & Payment Verification)
  // ---------------------------------------------------------------------------

  static activatePaidAccount(params: {
    organizationId: string;
    planName: string;
    planCode: string;
    monthlyPrice: number;
    startDate: string;
    expiryDate: string;
    username: string;
    password: string;
    adminId: string;
    paymentReference?: string;
  }): { success: boolean; username: string; expiryDate: string } {
    const db = getRawSqlDb();
    const now = new Date().toISOString();

    try {
      // 1. Update subscription status to ACTIVE
      db.run(
        `UPDATE subscriptions
         SET status = 'ACTIVE',
             current_period_start = ?,
             current_period_end = ?,
             updated_at = ?
         WHERE organization_id = ?`,
        [params.startDate, params.expiryDate, now, params.organizationId]
      );

      // 2. Update registration status to ACTIVE
      db.run(
        `UPDATE customer_registrations
         SET status = 'ACTIVE',
             payment_status = 'VERIFIED',
             payment_reference = ?,
             updated_at = ?
         WHERE organization_id = ?`,
        [params.paymentReference || 'BANK_TRANSFER_VERIFIED', now, params.organizationId]
      );

      // 3. Assign or update user credentials in the users table
      const userStmt = db.prepare(`SELECT id FROM users WHERE username = :u LIMIT 1`);
      userStmt.bind({ ':u': params.username });
      let existingUserId = '';
      if (userStmt.step()) existingUserId = (userStmt.getAsObject().id as string) || '';
      userStmt.free();

      const passwordHash = bcrypt.hashSync(params.password, 12);

      // Get branch ID
      const branchStmt = db.prepare(`SELECT id FROM branches LIMIT 1`);
      let branchId = 'branch-main';
      if (branchStmt.step()) branchId = (branchStmt.getAsObject().id as string) || 'branch-main';
      branchStmt.free();

      // Get role ID
      const roleStmt = db.prepare(`SELECT id FROM roles WHERE is_system = 1 ORDER BY created_at ASC LIMIT 1`);
      let roleId = 'role-admin';
      if (roleStmt.step()) roleId = (roleStmt.getAsObject().id as string) || 'role-admin';
      roleStmt.free();

      if (existingUserId) {
        db.run(
          `UPDATE users SET password_hash = ?, is_active = 1, status = 'ACTIVE', updated_at = ? WHERE id = ?`,
          [passwordHash, now, existingUserId]
        );
      } else {
        const newUserId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        db.run(
          `INSERT INTO users (id, business_id, branch_id, role_id, username, password_hash, full_name, status, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)`,
          [newUserId, params.organizationId, branchId, roleId, params.username, passwordHash, params.username, now, now]
        );
      }

      // 4. Record audit log
      try {
        const logId = `audit-${Date.now()}`;
        db.run(
          `INSERT INTO admin_audit_logs (id, admin_user_id, action, entity_type, entity_id, target_org_id, reason, created_at)
           VALUES (?, ?, 'ACTIVATION_APPROVED', 'SUBSCRIPTION', ?, ?, ?, ?)`,
          [logId, params.adminId, params.organizationId, params.organizationId, `Activated ${params.planName} plan until ${params.expiryDate}`, now]
        );
      } catch { /* audit log non-fatal */ }

      saveLocalDbState();
      return { success: true, username: params.username, expiryDate: params.expiryDate };
    } catch (err: any) {
      console.error('Manual activation failed:', err);
      throw new Error(`Activation failed: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  private static generateToken(length: number = 32): string {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private static generateOrgCode(businessName: string): string {
    const base = businessName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private static ensurePlanExists(db: Database, code: string, plan: typeof PLAN_CATALOG.FREE_TRIAL, now: string): void {
    const check = db.prepare(`SELECT id FROM subscription_plans WHERE code = :code LIMIT 1`);
    check.bind({ ':code': code });
    if (check.step()) { check.free(); return; }
    check.free();

    const id = `plan-${code.toLowerCase()}-${Date.now()}`;
    const entitlements = ['pos', 'inventory', 'reports.basic'];
    if (code !== 'FREE_TRIAL') entitlements.push('reports.advanced', 'multi.branch');
    if (code === 'BUSINESS' || code === 'ENTERPRISE') entitlements.push('api.access', 'custom.branding');

    db.run(
      `INSERT OR IGNORE INTO subscription_plans
        (id, code, name, monthly_price, yearly_price, currency, trial_days, max_users, max_branches, max_devices, max_products, max_transactions, storage_limit_mb, entitlements_json, support_level, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, code, plan.name, plan.monthlyPrice, plan.yearlyPrice, 'LKR', plan.trialDays, plan.maxUsers, plan.maxBranches, plan.maxDevices, plan.maxProducts, 100000, 2048, JSON.stringify(entitlements), code === 'ENTERPRISE' ? '247' : 'STANDARD', 1, now, now]
    );
  }
}
