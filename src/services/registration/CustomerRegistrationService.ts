import bcrypt from 'bcryptjs';
import { Database } from 'sql.js';
import { getRawSqlDb, saveLocalDbState, migrateMissingColumns } from '@/infrastructure/database/sqlite/db';
import { ensureAdminTables } from '@/infrastructure/database/sqlite/adminSchema';
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
            password_hash: passwordHash,
            selected_plan_code: planCode,
            billing_cycle: payload.billingCycle,
            status: initialStatus,
          });

          if (planId) {
            await supabase.from('subscriptions').upsert({
              id: subId,
              organization_id: orgId,
              plan_id: planCode,
              status: isTrial ? 'TRIALING' : 'INCOMPLETE',
              billing_cycle: payload.billingCycle,
              trial_ends_at: trialEndsAt,
            });
          }
        } catch (cloudErr) {
          console.warn('[Supabase] Registration cloud sync warning:', cloudErr);
        }
      }

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
      // Purge any legacy demo registrations to ensure clean production database
      db.run("DELETE FROM customer_registrations WHERE id LIKE 'reg-demo-%'");
      db.run("DELETE FROM subscriptions WHERE id LIKE 'sub-demo-%'");
      db.run("DELETE FROM registered_devices WHERE id LIKE 'dev-demo-%'");
      db.run("DELETE FROM organizations WHERE id IN ('org-1791213425877-466xxh', 'org-1791204899120-881bba', 'org-1791198421045-992ccd')");
    } catch {}
  }

  static async listAllRegistrations(): Promise<Record<string, unknown>[]> {
    // 1. Check Supabase Cloud Database first
    if (isSupabaseConfigured && supabase) {
      try {
        const [regsRes, subsRes, orgsRes] = await Promise.all([
          supabase.from('customer_registrations').select('*').order('created_at', { ascending: false }),
          supabase.from('subscriptions').select('*'),
          supabase.from('organizations').select('*'),
        ]);

        if (!regsRes.error && regsRes.data && regsRes.data.length > 0) {
          const subsMap = new Map<string, any>();
          if (subsRes.data) {
            subsRes.data.forEach((s: any) => subsMap.set(s.organization_id, s));
          }

          const orgsMap = new Map<string, any>();
          if (orgsRes.data) {
            orgsRes.data.forEach((o: any) => orgsMap.set(o.id, o));
          }

          const results: Record<string, unknown>[] = regsRes.data.map((cr: any) => {
            const sub = subsMap.get(cr.organization_id) || {};
            const org = orgsMap.get(cr.organization_id) || {};
            return {
              id: cr.id,
              organization_id: cr.organization_id,
              business_name: cr.business_name || org.name || 'Commercial Merchant',
              full_name: cr.full_name || 'Admin',
              email: cr.email || org.email || '',
              phone: cr.phone || org.phone || '',
              country: cr.country || 'Sri Lanka',
              selected_plan_code: cr.selected_plan_code || 'FREE_TRIAL',
              billing_cycle: cr.billing_cycle || sub.billing_cycle || 'monthly',
              status: cr.status || 'TRIALING',
              sub_status: sub.status || cr.status || 'TRIALING',
              trial_ends_at: sub.trial_ends_at || cr.trial_ends_at || '',
              current_period_end: sub.current_period_end || '',
              payment_status: cr.payment_status || 'PENDING',
              payment_reference: cr.payment_reference || '',
              notes: cr.notes || '',
              created_at: cr.created_at,
              updated_at: cr.updated_at,
              plan_name: cr.selected_plan_code || 'Free Trial',
            };
          });

          // Sync into local SQLite in background for offline caching
          try {
            const db = getRawSqlDb();
            results.forEach((r: any) => {
              db.run(
                `INSERT OR REPLACE INTO customer_registrations
                  (id, organization_id, email, full_name, business_name, phone, country, selected_plan_code, billing_cycle, status, notes, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [r.id, r.organization_id, r.email, r.full_name, r.business_name, r.phone, r.country, r.selected_plan_code, r.billing_cycle, r.status, r.notes, r.created_at, r.updated_at]
              );
            });
            saveLocalDbState();
          } catch {}

          return results;
        }
      } catch (cloudErr) {
        console.warn('[Supabase Cloud] Failed to fetch live registrations, falling back to local SQLite:', cloudErr);
      }
    }

    // 2. Fallback: Query local SQLite
    const db = getRawSqlDb();
    ensureAdminTables(db);
    this.ensureDefaultRegistrations(db);
    const stmt = db.prepare(`
      SELECT cr.*, 
             s.status as sub_status, s.trial_ends_at, s.current_period_end,
             p.name as plan_name
      FROM customer_registrations cr
      LEFT JOIN subscriptions s ON s.organization_id = cr.organization_id
      LEFT JOIN subscription_plans p ON p.id = s.plan_id
      WHERE cr.id NOT LIKE 'reg-demo-%'
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

  static async approveSubscription(organizationId: string, adminId: string): Promise<boolean> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 86400_000).toISOString();
    try {
      db.run(
        `UPDATE subscriptions SET status = 'ACTIVE', current_period_start = ?, current_period_end = ?, updated_at = ? WHERE organization_id = ?`,
        [now, periodEnd, now, organizationId]
      );
      db.run(
        `UPDATE customer_registrations SET status = 'ACTIVE', payment_status = 'VERIFIED', updated_at = ? WHERE organization_id = ?`,
        [now, organizationId]
      );

      // Audit local
      const id = `sub_evt-${Date.now()}`;
      try {
        db.run(
          `INSERT OR IGNORE INTO subscription_events (id, organization_id, subscription_id, event_type, source, performed_by, created_at)
           SELECT ?, organization_id, id, 'PLAN_ACTIVATED', 'ADMIN_OVERRIDE', ?, ? FROM subscriptions WHERE organization_id = ?`,
          [id, adminId, now, organizationId]
        );
      } catch { /* subscription_events non-fatal */ }

      saveLocalDbState();

      // Cloud Supabase Sync
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('subscriptions').update({
            status: 'ACTIVE',
            current_period_start: now,
            current_period_end: periodEnd,
            updated_at: now,
          }).eq('organization_id', organizationId);

          await supabase.from('customer_registrations').update({
            status: 'ACTIVE',
            payment_status: 'VERIFIED',
            updated_at: now,
          }).eq('organization_id', organizationId);

          await supabase.from('admin_audit_logs').insert({
            id: `audit-${Date.now()}`,
            admin_user_id: adminId,
            admin_email: adminId,
            action: 'SUBSCRIPTION_APPROVED',
            entity_type: 'SUBSCRIPTION',
            entity_id: organizationId,
            target_org_id: organizationId,
            reason: 'Super Admin approved subscription',
            created_at: now,
          });
        } catch (e) {
          console.warn('[Supabase Cloud] Approve subscription sync warning:', e);
        }
      }

      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // SUSPEND ORGANIZATION (Super Admin action)
  // ---------------------------------------------------------------------------

  static async suspendOrganization(organizationId: string, reason: string, adminId: string): Promise<boolean> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    try {
      db.run(`UPDATE subscriptions SET status = 'SUSPENDED', updated_at = ? WHERE organization_id = ?`, [now, organizationId]);
      db.run(`UPDATE customer_registrations SET status = 'SUSPENDED', notes = ?, updated_at = ? WHERE organization_id = ?`, [reason, now, organizationId]);
      saveLocalDbState();

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('customer_registrations').update({ status: 'SUSPENDED', notes: reason, updated_at: now }).eq('organization_id', organizationId);
          await supabase.from('subscriptions').update({ status: 'SUSPENDED', updated_at: now }).eq('organization_id', organizationId);
          await supabase.from('admin_audit_logs').insert({
            id: `audit-${Date.now()}`,
            admin_user_id: adminId,
            admin_email: adminId,
            action: 'ORGANIZATION_SUSPENDED',
            entity_type: 'ORGANIZATION',
            entity_id: organizationId,
            target_org_id: organizationId,
            reason: reason || 'Manual Admin Suspension',
            created_at: now,
          });
        } catch (e) {
          console.warn('[Supabase Cloud] Suspend organization sync warning:', e);
        }
      }

      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // REACTIVATE ORGANIZATION (Super Admin action)
  // ---------------------------------------------------------------------------

  static async activateOrganization(organizationId: string, adminId: string): Promise<boolean> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    try {
      db.run(`UPDATE subscriptions SET status = 'ACTIVE', updated_at = ? WHERE organization_id = ?`, [now, organizationId]);
      db.run(`UPDATE customer_registrations SET status = 'ACTIVE', updated_at = ? WHERE organization_id = ?`, [now, organizationId]);
      saveLocalDbState();

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('customer_registrations').update({ status: 'ACTIVE', updated_at: now }).eq('organization_id', organizationId);
          await supabase.from('subscriptions').update({ status: 'ACTIVE', updated_at: now }).eq('organization_id', organizationId);
          await supabase.from('admin_audit_logs').insert({
            id: `audit-${Date.now()}`,
            admin_user_id: adminId,
            admin_email: adminId,
            action: 'ORGANIZATION_ACTIVATED',
            entity_type: 'ORGANIZATION',
            entity_id: organizationId,
            target_org_id: organizationId,
            reason: 'Super Admin manual reactivation',
            created_at: now,
          });
        } catch (e) {
          console.warn('[Supabase Cloud] Reactivate organization sync warning:', e);
        }
      }

      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // CHANGE PLAN (Super Admin action)
  // ---------------------------------------------------------------------------

  static async changeOrganizationPlan(organizationId: string, planCode: string, adminId: string): Promise<boolean> {
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

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('subscriptions').update({ plan_id: planCode, updated_at: now }).eq('organization_id', organizationId);
          await supabase.from('customer_registrations').update({ selected_plan_code: planCode, updated_at: now }).eq('organization_id', organizationId);
          await supabase.from('admin_audit_logs').insert({
            id: `audit-${Date.now()}`,
            admin_user_id: adminId,
            admin_email: adminId,
            action: 'PLAN_CHANGED',
            entity_type: 'SUBSCRIPTION',
            entity_id: organizationId,
            target_org_id: organizationId,
            reason: `Plan changed to ${planCode}`,
            created_at: now,
          });
        } catch (e) {
          console.warn('[Supabase Cloud] Change plan sync warning:', e);
        }
      }

      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // EXTEND TRIAL (Super Admin action)
  // ---------------------------------------------------------------------------

  static async extendTrial(organizationId: string, additionalDays: number, adminId: string, reason: string): Promise<boolean> {
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
        try {
          await supabase.from('subscriptions').update({
            status: 'TRIALING',
            trial_ends_at: newEnd,
            current_period_end: newEnd,
            updated_at: now,
          }).eq('organization_id', organizationId);

          await supabase.from('customer_registrations').update({
            status: 'TRIALING',
            updated_at: now,
          }).eq('organization_id', organizationId);

          await supabase.from('admin_audit_logs').insert({
            id: `audit-${Date.now()}`,
            admin_user_id: adminId,
            admin_email: adminId,
            action: 'TRIAL_EXTENDED',
            entity_type: 'SUBSCRIPTION',
            entity_id: organizationId,
            target_org_id: organizationId,
            reason: `Trial extended by ${additionalDays} days. Reason: ${reason}`,
            created_at: now,
          });
        } catch (e) {
          console.warn('[Supabase Cloud] Extend trial sync warning:', e);
        }
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
    password?: string;
    username?: string;
  }): Promise<{ trialId: string; businessName: string; expiryDate: string; organizationId: string }> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const trialDays = 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 86400_000).toISOString();
    const trialId = `TRIAL-${Math.floor(100000 + Math.random() * 900000)}`;

    const regId = `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const orgId = `org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userPass = payload.password || `Trial@${trialId}`;
    const passwordHash = bcrypt.hashSync(userPass, 10);
    const chosenUsername = payload.username || payload.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'admin';

    // 1. Insert customer registration with TRIALING status
    db.run(
      `INSERT INTO customer_registrations
        (id, organization_id, email, full_name, business_name, phone, country, password_hash, selected_plan_code, billing_cycle, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FREE_TRIAL', 'MONTHLY', 'TRIALING', ?, ?, ?)`,
      [regId, orgId, payload.email.toLowerCase().trim(), payload.fullName, payload.businessName, payload.phone || null, payload.country || 'Sri Lanka', passwordHash, trialId, now, now]
    );

    // 2. Register merchant POS user in local users table
    try {
      migrateMissingColumns(db);
      const userCols = db.exec("PRAGMA table_info(users)")[0]?.values?.map((v: any) => v[1]) || [];
      const hasStatus = userCols.includes('status');
      const userId = `usr-${Date.now()}`;
      if (hasStatus) {
        db.run(
          `INSERT OR REPLACE INTO users (id, business_id, branch_id, role_id, username, email, password_hash, full_name, phone, status, is_active, created_at, updated_at)
           VALUES (?, 'biz-001', 'branch-001', 'role-admin', ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)`,
          [userId, chosenUsername, payload.email.toLowerCase().trim(), passwordHash, payload.fullName, payload.phone || null, now, now]
        );
      } else {
        db.run(
          `INSERT OR REPLACE INTO users (id, business_id, branch_id, role_id, username, email, password_hash, full_name, phone, is_active, created_at, updated_at)
           VALUES (?, 'biz-001', 'branch-001', 'role-admin', ?, ?, ?, ?, ?, 1, ?, ?)`,
          [userId, chosenUsername, payload.email.toLowerCase().trim(), passwordHash, payload.fullName, payload.phone || null, now, now]
        );
      }
    } catch {}

    // 3. Insert or update organization
    const orgCode = this.generateOrgCode(payload.businessName);
    db.run(
      `INSERT OR REPLACE INTO organizations (id, name, code, email, phone, timezone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'Asia/Colombo', ?, ?)`,
      [orgId, payload.businessName, orgCode, payload.email.toLowerCase().trim(), payload.phone || null, now, now]
    );

    // 4. Ensure plan exists
    this.ensurePlanExists(db, 'FREE_TRIAL', PLAN_CATALOG.FREE_TRIAL, now);

    // 5. Create subscription
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
          password_hash: passwordHash,
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

  static async activatePaidAccount(params: {
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
  }): Promise<{ success: boolean; username: string; expiryDate: string }> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();

    try {
      const passwordHash = bcrypt.hashSync(params.password, 10);
      ensureAdminTables(db);

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

      // Fetch customer email and business/full name for seamless login
      const regStmt = db.prepare(`SELECT email, full_name, business_name FROM customer_registrations WHERE organization_id = :orgId LIMIT 1`);
      regStmt.bind({ ':orgId': params.organizationId });
      let customerEmail = '';
      let customerFullName = params.username;
      if (regStmt.step()) {
        const obj = regStmt.getAsObject();
        customerEmail = (obj.email as string) || '';
        customerFullName = (obj.full_name as string) || (obj.business_name as string) || params.username;
      }
      regStmt.free();

      if (!customerEmail && params.username.includes('@')) {
        customerEmail = params.username.toLowerCase().trim();
      }

      // 2. Update registration status and password_hash in local SQLite
      db.run(
        `UPDATE customer_registrations
         SET status = 'ACTIVE',
             payment_status = 'VERIFIED',
             password_hash = ?,
             payment_reference = ?,
             notes = ?,
             updated_at = ?
         WHERE organization_id = ?`,
        [passwordHash, params.paymentReference || 'BANK_TRANSFER_VERIFIED', `Activated credentials: ${params.username}`, now, params.organizationId]
      );

      // 3. Assign or update user credentials in the users table
      const userStmt = db.prepare(`SELECT id FROM users WHERE username = :u OR (email = :e AND email != '') LIMIT 1`);
      userStmt.bind({ ':u': params.username, ':e': customerEmail });
      let existingUserId = '';
      if (userStmt.step()) existingUserId = (userStmt.getAsObject().id as string) || '';
      userStmt.free();

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

      migrateMissingColumns(db);
      const userCols = db.exec("PRAGMA table_info(users)")[0]?.values?.map((v: any) => v[1]) || [];
      const hasStatus = userCols.includes('status');

      if (existingUserId) {
        if (hasStatus) {
          db.run(
            `UPDATE users SET username = ?, email = COALESCE(NULLIF(?, ''), email), password_hash = ?, full_name = ?, is_active = 1, status = 'ACTIVE', updated_at = ? WHERE id = ?`,
            [params.username, customerEmail, passwordHash, customerFullName, now, existingUserId]
          );
        } else {
          db.run(
            `UPDATE users SET username = ?, email = COALESCE(NULLIF(?, ''), email), password_hash = ?, full_name = ?, is_active = 1, updated_at = ? WHERE id = ?`,
            [params.username, customerEmail, passwordHash, customerFullName, now, existingUserId]
          );
        }
      } else {
        const newUserId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (hasStatus) {
          db.run(
            `INSERT INTO users (id, business_id, branch_id, role_id, username, email, password_hash, full_name, status, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)`,
            [newUserId, params.organizationId, branchId, roleId, params.username, customerEmail, passwordHash, customerFullName, now, now]
          );
        } else {
          db.run(
            `INSERT INTO users (id, business_id, branch_id, role_id, username, email, password_hash, full_name, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [newUserId, params.organizationId, branchId, roleId, params.username, customerEmail, passwordHash, customerFullName, now, now]
          );
        }
      }

      // 4. Record audit log locally
      try {
        const logId = `audit-${Date.now()}`;
        db.run(
          `INSERT INTO admin_audit_logs (id, admin_user_id, action, entity_type, entity_id, target_org_id, reason, created_at)
           VALUES (?, ?, 'ACTIVATION_APPROVED', 'SUBSCRIPTION', ?, ?, ?, ?)`,
          [logId, params.adminId, params.organizationId, params.organizationId, `Activated ${params.planName} plan until ${params.expiryDate}`, now]
        );
      } catch { /* audit log non-fatal */ }

      saveLocalDbState();

      // 5. Cloud Supabase Sync
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('subscriptions').update({
            status: 'ACTIVE',
            plan_id: params.planCode,
            current_period_start: params.startDate,
            current_period_end: params.expiryDate,
            updated_at: now,
          }).eq('organization_id', params.organizationId);

          await supabase.from('customer_registrations').update({
            status: 'ACTIVE',
            password_hash: passwordHash,
            selected_plan_code: params.planCode,
            payment_status: 'VERIFIED',
            payment_reference: params.paymentReference || 'BANK_TRANSFER_VERIFIED',
            notes: `Activated credentials: ${params.username}`,
            updated_at: now,
          }).eq('organization_id', params.organizationId);

          await supabase.from('admin_audit_logs').insert({
            id: `audit-${Date.now()}`,
            admin_user_id: params.adminId,
            admin_email: params.adminId,
            action: 'ACTIVATION_APPROVED',
            entity_type: 'SUBSCRIPTION',
            entity_id: params.organizationId,
            target_org_id: params.organizationId,
            reason: `Activated ${params.planName} plan until ${params.expiryDate}. Assigned Cashier: ${params.username}`,
            created_at: now,
          });
        } catch (e) {
          console.warn('[Supabase Cloud] Manual activation sync warning:', e);
        }
      }

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
