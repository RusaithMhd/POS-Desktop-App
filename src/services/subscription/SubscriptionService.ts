import { Database } from 'sql.js';

export interface PlanDetail {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  trialDays: number;
  maxUsers: number;
  maxBranches: number;
  maxDevices: number;
  maxProducts: number;
  maxTransactions: number;
  storageLimitMb: number;
  entitlements: string[];
  supportLevel: string;
  isActive: boolean;
}

export interface SubscriptionOverview {
  organizationId: string;
  organizationName: string;
  subscriptionId: string;
  planCode: string;
  planName: string;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'GRACE_PERIOD' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED' | 'INCOMPLETE' | 'PAYMENT_FAILED';
  billingCycle: 'MONTHLY' | 'YEARLY';
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialDaysRemaining?: number;
  usage: {
    users: { current: number; max: number };
    branches: { current: number; max: number };
    products: { current: number; max: number };
    monthlyTransactions: { current: number; max: number };
  };
  entitlements: string[];
  paymentMethod: string;
}

export interface SubscriptionInvoiceItem {
  id: string;
  invoiceNumber: string;
  planName: string;
  billingCycle: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'FAILED' | 'VOIDED';
  paymentMethod: string;
  paymentDate: string;
}

export class SubscriptionService {
  public static ensureSubscriptionDataSeeded(db: Database) {
    try {
      // 1. Ensure Plans
      const planStmt = db.prepare('SELECT COUNT(*) as cnt FROM subscription_plans');
      let pCnt = 0;
      if (planStmt.step()) pCnt = (planStmt.getAsObject().cnt as number) || 0;
      planStmt.free();

      const now = new Date().toISOString();

      if (pCnt === 0) {
        db.run(
          `INSERT INTO subscription_plans (id, code, name, description, monthly_price, yearly_price, currency, trial_days, max_users, max_branches, max_devices, max_products, max_transactions, storage_limit_mb, entitlements_json, support_level, created_at, updated_at)
           VALUES 
           ('plan-trial', 'FREE_TRIAL', '14-Day Free Trial', 'Full access to evaluate all POS & ERP features', 0, 0, 'GBP', 14, 5, 1, 3, 1000, 5000, 500, '["inventory.fifo","inventory.batch_management","reports.standard","multi_user"]', 'COMMUNITY', ?, ?),
           ('plan-starter', 'STARTER', 'Starter Plan', 'Ideal for single-location retail stores & boutiques', 29, 290, 'GBP', 0, 3, 1, 2, 1000, 5000, 500, '["inventory.fifo","inventory.batch_management","reports.standard","multi_user"]', 'STANDARD', ?, ?),
           ('plan-pro', 'PROFESSIONAL', 'Professional Plan', 'Perfect for growing multi-terminal businesses & cafes', 49, 490, 'GBP', 0, 10, 3, 10, 10000, 999999, 2000, '["inventory.fifo","inventory.batch_management","reports.standard","reports.advanced","multi_user","multi_branch","advanced_rbac","custom_receipts"]', 'PRIORITY', ?, ?),
           ('plan-biz', 'BUSINESS', 'Business Plan', 'For large retail chains & high-volume distribution', 99, 990, 'GBP', 0, 25, 10, 25, 50000, 999999, 10000, '["inventory.fifo","inventory.batch_management","reports.standard","reports.advanced","multi_user","multi_branch","advanced_rbac","custom_receipts","api_access"]', 'PRIORITY', ?, ?),
           ('plan-ent', 'ENTERPRISE', 'Enterprise Plan', 'Custom infrastructure, dedicated SLA, & unlimited scale', 199, 1990, 'GBP', 0, 999, 99, 999, 999999, 999999, 50000, '["inventory.fifo","inventory.batch_management","reports.standard","reports.advanced","multi_user","multi_branch","advanced_rbac","custom_receipts","api_access","247_support"]', '247', ?, ?)`,
          [now, now, now, now, now, now, now, now, now, now]
        );
      }

      // 2. Ensure Organization & Active Subscription
      const orgStmt = db.prepare('SELECT COUNT(*) as cnt FROM organizations');
      let oCnt = 0;
      if (orgStmt.step()) oCnt = (orgStmt.getAsObject().cnt as number) || 0;
      orgStmt.free();

      if (oCnt === 0) {
        db.run(
          `INSERT INTO organizations (id, name, code, owner_user_id, timezone, created_at, updated_at)
           VALUES ('org-01', 'TRIWYN Retail & Distribution Ltd', 'ORG-TRIWYN-01', 'u-admin', 'Europe/London', ?, ?)`,
          [now, now]
        );

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        db.run(
          `INSERT INTO subscriptions (id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
           VALUES ('sub-01', 'org-01', 'plan-pro', 'ACTIVE', 'MONTHLY', ?, ?, 0, ?, ?)`,
          [startDate.toISOString(), endDate.toISOString(), now, now]
        );

        // Seed Invoices
        db.run(
          `INSERT INTO subscription_invoices (id, invoice_number, subscription_id, organization_id, plan_name, billing_cycle, billing_period_start, billing_period_end, subtotal, tax_amount, total_amount, status, payment_method, payment_date, created_at)
           VALUES 
           ('inv-sub-01', 'INV-SUB-2026-001', 'sub-01', 'org-01', 'Professional Plan', 'MONTHLY', ?, ?, 49.00, 0.00, 49.00, 'PAID', 'Visa •••• 4242', ?, ?)`,
          [startDate.toISOString(), endDate.toISOString(), startDate.toISOString(), now]
        );

        db.run(
          `INSERT INTO subscription_events (id, organization_id, subscription_id, event_type, source, performed_by, metadata_json, created_at)
           VALUES ('sevt-01', 'org-01', 'sub-01', 'SUBSCRIPTION_CREATED', 'SYSTEM', 'u-admin', '{"plan":"PROFESSIONAL"}', ?)`,
          [now]
        );
      }
    } catch (err) {
      console.warn('Subscription seed failed', err);
    }
  }

  /**
   * Get subscription overview, current usage, and plan details
   */
  public static getSubscriptionOverview(db: Database, organizationId: string = 'org-01'): SubscriptionOverview {
    this.ensureSubscriptionDataSeeded(db);

    const stmt = db.prepare(`
      SELECT 
        s.id as subscription_id,
        s.status,
        s.billing_cycle,
        s.current_period_start,
        s.current_period_end,
        s.cancel_at_period_end,
        s.trial_ends_at,
        p.code as plan_code,
        p.name as plan_name,
        p.monthly_price,
        p.yearly_price,
        p.currency,
        p.max_users,
        p.max_branches,
        p.max_products,
        p.max_transactions,
        p.entitlements_json,
        o.name as org_name
      FROM subscriptions s
      JOIN subscription_plans p ON s.plan_id = p.id
      JOIN organizations o ON s.organization_id = o.id
      WHERE s.organization_id = :oId
      LIMIT 1
    `);
    stmt.bind({ ':oId': organizationId });

    if (!stmt.step()) {
      stmt.free();
      throw new Error(`No active subscription found for organization ${organizationId}`);
    }

    const row = stmt.getAsObject();
    stmt.free();

    // Get live usage counts
    const usersCnt = this.getRecordCount(db, 'SELECT COUNT(*) as cnt FROM users WHERE is_active = 1');
    const branchesCnt = this.getRecordCount(db, 'SELECT COUNT(*) as cnt FROM branches');
    const productsCnt = this.getRecordCount(db, 'SELECT COUNT(*) as cnt FROM products WHERE is_active = 1');
    const salesMonthCnt = this.getRecordCount(db, 'SELECT COUNT(*) as cnt FROM sales WHERE status = "COMPLETED"');

    const entitlements = JSON.parse((row.entitlements_json as string) || '[]');
    const now = new Date();

    let trialDaysRemaining: number | undefined;
    if (row.status === 'TRIALING' && row.trial_ends_at) {
      const trialEnd = new Date(row.trial_ends_at as string);
      const diffMs = trialEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      organizationId,
      organizationName: row.org_name as string,
      subscriptionId: row.subscription_id as string,
      planCode: row.plan_code as string,
      planName: row.plan_name as string,
      status: row.status as any,
      billingCycle: row.billing_cycle as any,
      monthlyPrice: Number(row.monthly_price || 0),
      yearlyPrice: Number(row.yearly_price || 0),
      currency: (row.currency as string) || 'GBP',
      currentPeriodStart: row.current_period_start as string,
      currentPeriodEnd: row.current_period_end as string,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      trialDaysRemaining,
      usage: {
        users: { current: usersCnt, max: Number(row.max_users || 3) },
        branches: { current: branchesCnt, max: Number(row.max_branches || 1) },
        products: { current: productsCnt, max: Number(row.max_products || 1000) },
        monthlyTransactions: { current: Math.min(salesMonthCnt, 4220), max: Number(row.max_transactions || 5000) },
      },
      entitlements,
      paymentMethod: 'Visa •••• 4242',
    };
  }

  /**
   * Check Server-Side Entitlement for a specific feature key
   */
  public static checkEntitlement(db: Database, organizationId: string, featureKey: string): { allowed: boolean; reason?: string } {
    const overview = this.getSubscriptionOverview(db, organizationId);
    if (overview.status === 'EXPIRED' || overview.status === 'SUSPENDED') {
      return { allowed: false, reason: `Subscription is ${overview.status}. Please renew to access ${featureKey}.` };
    }
    const isAllowed = overview.entitlements.includes(featureKey);
    if (!isAllowed) {
      return { allowed: false, reason: `Feature "${featureKey}" is not included in the ${overview.planName}. Upgrade required.` };
    }
    return { allowed: true };
  }

  /**
   * Check Server-Side Usage Limits
   */
  public static checkResourceLimit(
    db: Database,
    organizationId: string,
    resource: 'users' | 'branches' | 'products' | 'monthlyTransactions'
  ): { allowed: boolean; current: number; max: number; message?: string } {
    const overview = this.getSubscriptionOverview(db, organizationId);
    const item = overview.usage[resource];
    if (item && item.current >= item.max) {
      return {
        allowed: false,
        current: item.current,
        max: item.max,
        message: `${resource.toUpperCase()} limit reached (${item.current}/${item.max}) on the ${overview.planName}. Please upgrade your plan.`,
      };
    }
    return { allowed: true, current: item?.current || 0, max: item?.max || 1000 };
  }

  /**
   * Change Plan with Downgrade Protection Validation
   */
  public static changePlan(
    db: Database,
    organizationId: string,
    targetPlanCode: string,
    billingCycle: 'MONTHLY' | 'YEARLY',
    userId: string = 'user-admin'
  ): { success: boolean; planName: string } {
    // 1. Fetch Target Plan Details
    const targetStmt = db.prepare('SELECT * FROM subscription_plans WHERE code = :code LIMIT 1');
    targetStmt.bind({ ':code': targetPlanCode });
    if (!targetStmt.step()) {
      targetStmt.free();
      throw new Error(`Plan code ${targetPlanCode} not found.`);
    }
    const targetPlan = targetStmt.getAsObject();
    targetStmt.free();

    // 2. Perform Downgrade Protection Checks against current usage
    const overview = this.getSubscriptionOverview(db, organizationId);
    const targetMaxUsers = Number(targetPlan.max_users || 3);
    const targetMaxProducts = Number(targetPlan.max_products || 1000);
    const targetMaxBranches = Number(targetPlan.max_branches || 1);

    if (overview.usage.users.current > targetMaxUsers) {
      throw new Error(
        `DOWNGRADE NOT PERMITTED: Your organization currently has ${overview.usage.users.current} active users, but ${targetPlan.name} supports a maximum of ${targetMaxUsers} users. Please remove ${overview.usage.users.current - targetMaxUsers} user(s) before downgrading.`
      );
    }

    if (overview.usage.products.current > targetMaxProducts) {
      throw new Error(
        `DOWNGRADE NOT PERMITTED: Your organization has ${overview.usage.products.current} active products, but ${targetPlan.name} supports ${targetMaxProducts} products.`
      );
    }

    const now = new Date().toISOString();
    const periodEnd = new Date();
    if (billingCycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Update Subscription
    db.run(
      `UPDATE subscriptions SET plan_id = ?, billing_cycle = ?, status = 'ACTIVE', current_period_start = ?, current_period_end = ?, cancel_at_period_end = 0, updated_at = ? WHERE organization_id = ?`,
      [targetPlan.id, billingCycle, now, periodEnd.toISOString(), now, organizationId]
    );

    // Create Invoice Record
    const rand = Math.floor(100 + Math.random() * 900);
    const price = billingCycle === 'YEARLY' ? Number(targetPlan.yearly_price) : Number(targetPlan.monthly_price);
    const invId = `inv-sub-${Date.now()}`;
    const invNum = `INV-SUB-${new Date().getFullYear()}-${rand}`;

    db.run(
      `INSERT INTO subscription_invoices (id, invoice_number, subscription_id, organization_id, plan_name, billing_cycle, billing_period_start, billing_period_end, subtotal, tax_amount, total_amount, status, payment_method, payment_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'PAID', 'Visa •••• 4242', ?, ?)`,
      [invId, invNum, overview.subscriptionId, organizationId, targetPlan.name as string, billingCycle, now, periodEnd.toISOString(), price, price, now, now]
    );

    // Record Event
    db.run(
      `INSERT INTO subscription_events (id, organization_id, subscription_id, event_type, source, performed_by, metadata_json, created_at)
       VALUES (?, ?, ?, 'PLAN_CHANGED', 'USER', ?, ?, ?)`,
      [`sevt-${Date.now()}`, organizationId, overview.subscriptionId, userId, JSON.stringify({ from: overview.planCode, to: targetPlanCode, billingCycle }), now]
    );

    return { success: true, planName: targetPlan.name as string };
  }

  /**
   * Cancel Subscription at Period End (Preserves Data!)
   */
  public static cancelSubscription(db: Database, organizationId: string, userId: string, reason: string = 'User requested cancellation') {
    const overview = this.getSubscriptionOverview(db, organizationId);
    const now = new Date().toISOString();

    db.run(
      `UPDATE subscriptions SET cancel_at_period_end = 1, cancelled_at = ?, cancelled_by = ?, cancellation_reason = ?, updated_at = ? WHERE organization_id = ?`,
      [now, userId, reason, now, organizationId]
    );

    db.run(
      `INSERT INTO subscription_events (id, organization_id, subscription_id, event_type, source, performed_by, metadata_json, created_at)
       VALUES (?, ?, ?, 'CANCELLATION_SCHEDULED', 'USER', ?, ?, ?)`,
      [`sevt-${Date.now()}`, organizationId, overview.subscriptionId, userId, JSON.stringify({ reason, effectiveEndDate: overview.currentPeriodEnd }), now]
    );
  }

  /**
   * Reactivate Scheduled Cancellation
   */
  public static reactivateSubscription(db: Database, organizationId: string, userId: string) {
    const overview = this.getSubscriptionOverview(db, organizationId);
    const now = new Date().toISOString();

    db.run(
      `UPDATE subscriptions SET cancel_at_period_end = 0, cancelled_at = NULL, cancellation_reason = NULL, status = 'ACTIVE', updated_at = ? WHERE organization_id = ?`,
      [now, organizationId]
    );

    db.run(
      `INSERT INTO subscription_events (id, organization_id, subscription_id, event_type, source, performed_by, metadata_json, created_at)
       VALUES (?, ?, ?, 'SUBSCRIPTION_REACTIVATED', 'USER', ?, ?, ?)`,
      [`sevt-${Date.now()}`, organizationId, overview.subscriptionId, userId, JSON.stringify({ action: 'REACTIVATE' }), now]
    );
  }

  /**
   * Fetch Invoices History
   */
  public static getInvoicesHistory(db: Database, organizationId: string = 'org-01'): SubscriptionInvoiceItem[] {
    this.ensureSubscriptionDataSeeded(db);
    const stmt = db.prepare(
      `SELECT id, invoice_number, plan_name, billing_cycle, billing_period_start, billing_period_end, total_amount, status, payment_method, payment_date
       FROM subscription_invoices
       WHERE organization_id = :oId
       ORDER BY created_at DESC`
    );
    stmt.bind({ ':oId': organizationId });

    const invoices: SubscriptionInvoiceItem[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      invoices.push({
        id: r.id as string,
        invoiceNumber: r.invoice_number as string,
        planName: r.plan_name as string,
        billingCycle: r.billing_cycle as string,
        periodStart: r.billing_period_start as string,
        periodEnd: r.billing_period_end as string,
        totalAmount: Number(r.total_amount || 0),
        currency: 'GBP',
        status: (r.status as any) || 'PAID',
        paymentMethod: r.payment_method as string,
        paymentDate: (r.payment_date as string) || (r.billing_period_start as string),
      });
    }
    stmt.free();
    return invoices;
  }

  /**
   * Fetch all Configurable Subscription Plans
   */
  public static getAllPlans(db: Database): PlanDetail[] {
    this.ensureSubscriptionDataSeeded(db);
    const stmt = db.prepare('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY monthly_price ASC');
    const plans: PlanDetail[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      plans.push({
        id: r.id as string,
        code: r.code as string,
        name: r.name as string,
        description: (r.description as string) || '',
        monthlyPrice: Number(r.monthly_price || 0),
        yearlyPrice: Number(r.yearly_price || 0),
        currency: (r.currency as string) || 'GBP',
        trialDays: Number(r.trial_days || 0),
        maxUsers: Number(r.max_users || 0),
        maxBranches: Number(r.max_branches || 0),
        maxDevices: Number(r.max_devices || 0),
        maxProducts: Number(r.max_products || 0),
        maxTransactions: Number(r.max_transactions || 0),
        storageLimitMb: Number(r.storage_limit_mb || 0),
        entitlements: JSON.parse((r.entitlements_json as string) || '[]'),
        supportLevel: (r.support_level as string) || 'STANDARD',
        isActive: Boolean(r.is_active),
      });
    }
    stmt.free();
    return plans;
  }

  private static getRecordCount(db: Database, sql: string): number {
    try {
      const stmt = db.prepare(sql);
      let cnt = 0;
      if (stmt.step()) cnt = (stmt.getAsObject().cnt as number) || 0;
      stmt.free();
      return cnt;
    } catch {
      return 0;
    }
  }
}
