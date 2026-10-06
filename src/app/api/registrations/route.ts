import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const initSqlJs = require('sql.js');

async function getSqlInstance() {
  const wasmPath = path.join(process.cwd(), 'public', 'sql-wasm.wasm');
  return await initSqlJs({
    locateFile: () => wasmPath,
  });
}

function getDiskDbPath(): string {
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Application Support') : '/var/local');
  const dir = path.join(appData, 'triwyn-pos');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'triwyn_pos.sqlite');
}

/**
 * GET /api/registrations
 * Returns all registered merchant accounts for the Super Admin console.
 */
export async function GET() {
  try {
    // 1. Check Supabase Cloud first if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const [regsRes, subsRes] = await Promise.all([
          supabase.from('customer_registrations').select('*').order('created_at', { ascending: false }),
          supabase.from('subscriptions').select('*')
        ]);
        
        if (!regsRes.error && regsRes.data && regsRes.data.length > 0) {
          const subsMap = new Map();
          if (subsRes.data) {
            subsRes.data.forEach((s: any) => subsMap.set(s.organization_id, s));
          }
          
          const mergedData = regsRes.data.map((cr: any) => {
            const sub = subsMap.get(cr.organization_id) || {};
            return {
              ...cr,
              sub_status: sub.status || cr.status,
              trial_ends_at: sub.trial_ends_at || cr.trial_ends_at,
              current_period_end: sub.current_period_end,
              plan_name: cr.selected_plan_code || 'Free Trial'
            };
          });
          
          return NextResponse.json({ success: true, registrations: mergedData, source: 'supabase' });
        }
      } catch (e) {
        console.warn('[API registrations] Supabase fetch error:', e);
      }
    }

    // 2. Fetch from shared disk SQLite database
    const dbPath = getDiskDbPath();
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ success: true, registrations: [], source: 'disk_not_found' });
    }

    const SQL = await getSqlInstance();
    const fileBuf = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuf);

    try {
      db.run(`
        CREATE TABLE IF NOT EXISTS subscription_plans (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          monthly_price REAL NOT NULL DEFAULT 0,
          yearly_price REAL NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'LKR',
          trial_days INTEGER NOT NULL DEFAULT 14,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
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
        CREATE TABLE IF NOT EXISTS subscriptions (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          plan_id TEXT,
          status TEXT NOT NULL DEFAULT 'TRIALING',
          billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
          current_period_start TEXT NOT NULL,
          current_period_end TEXT NOT NULL,
          trial_started_at TEXT,
          trial_ends_at TEXT,
          trial_used INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    } catch {}

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
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    return NextResponse.json({ success: true, registrations: results, source: 'disk_sqlite' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/registrations
 * Handles website free trial download registrations and syncs directly into the desktop database.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      fullName,
      businessName,
      phone,
      email,
      country = 'Sri Lanka',
      password,
      selectedPlanCode = 'FREE_TRIAL',
    } = body;

    if (!businessName || !businessName.trim()) {
      return NextResponse.json({ success: false, error: 'Business name is required.' }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid email address is required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanBusiness = businessName.trim();
    const cleanName = (fullName || 'Admin').trim();
    const cleanPhone = (phone || '').trim();

    const dbPath = getDiskDbPath();
    const SQL = await getSqlInstance();
    let db: any;
    if (fs.existsSync(dbPath)) {
      const fileBuf = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuf);
    } else {
      db = new SQL.Database();
    }

    const now = new Date().toISOString();
    const trialDays = 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 86400_000).toISOString();
    const trialId = `TRIAL-${Math.floor(100000 + Math.random() * 900000)}`;

    const regId = `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const orgId = `org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userPass = password || `Trial@${trialId}`;
    const passwordHash = bcrypt.hashSync(userPass, 10);
    const chosenUsername = cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'admin';
    const orgCode = cleanBusiness.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TRWPOS';

    // 1. Insert customer_registrations
    try {
      db.run(
        `INSERT INTO customer_registrations
          (id, organization_id, email, full_name, business_name, phone, country, password_hash, selected_plan_code, billing_cycle, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MONTHLY', 'TRIALING', ?, ?, ?)`,
        [regId, orgId, cleanEmail, cleanName, cleanBusiness, cleanPhone || null, country || 'Sri Lanka', passwordHash, selectedPlanCode, trialId, now, now]
      );
    } catch (e) {
      console.warn('[API registrations] customer_registrations insert warning:', e);
    }

    // 2. Insert organizations
    try {
      db.run(
        `INSERT OR REPLACE INTO organizations (id, name, code, email, phone, timezone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'Asia/Colombo', ?, ?)`,
        [orgId, cleanBusiness, orgCode, cleanEmail, cleanPhone || null, now, now]
      );
    } catch (e) {
      console.warn('[API registrations] organizations insert warning:', e);
    }

    // 3. Insert subscriptions
    try {
      const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      db.run(
        `INSERT OR REPLACE INTO subscriptions
          (id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_started_at, trial_ends_at, trial_used, created_at, updated_at)
         VALUES (?, ?, 'plan-trial', 'TRIALING', 'MONTHLY', ?, ?, ?, ?, 1, ?, ?)`,
        [subId, orgId, now, trialEndsAt, now, trialEndsAt, now, now]
      );
    } catch (e) {
      console.warn('[API registrations] subscriptions insert warning:', e);
    }

    // 4. Register merchant user in local users table
    try {
      const userId = `usr-${Date.now()}`;
      db.run(
        `INSERT OR REPLACE INTO users (id, business_id, branch_id, role_id, username, email, password_hash, full_name, phone, status, is_active, created_at, updated_at)
         VALUES (?, 'biz-001', 'branch-001', 'role-admin', ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)`,
        [userId, chosenUsername, cleanEmail, passwordHash, cleanName, cleanPhone || null, now, now]
      );
    } catch (e) {
      console.warn('[API registrations] users insert warning:', e);
    }

    // 5. Record Admin Audit Log
    try {
      const auditId = `aud-${Date.now()}`;
      db.run(
        `INSERT INTO admin_audit_logs (id, admin_user_id, admin_email, admin_role, action, entity_type, entity_id, target_org_id, reason, created_at)
         VALUES (?, 'website', cleanEmail, 'CUSTOMER', 'WEBSITE_TRIAL_DOWNLOAD', 'REGISTRATION', ?, ?, 'Website Free Trial Form Submitted', ?)`,
        [auditId, regId, orgId, now]
      );
    } catch (e) {
      console.warn('[API registrations] admin_audit_logs warning:', e);
    }

    // Save binary back to disk
    const exported = db.export();
    fs.writeFileSync(dbPath, Buffer.from(exported));
    console.log(`[API registrations] Saved new customer registration ${cleanBusiness} (${cleanEmail}) to disk database!`);

    // 6. Sync to Supabase Cloud if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('organizations').upsert({
          id: orgId,
          name: cleanBusiness,
          code: orgCode,
          email: cleanEmail,
          phone: cleanPhone || null,
        });

        await supabase.from('customer_registrations').upsert({
          id: regId,
          organization_id: orgId,
          email: cleanEmail,
          full_name: cleanName,
          business_name: cleanBusiness,
          phone: cleanPhone || null,
          country: country || 'Sri Lanka',
          password_hash: passwordHash,
          selected_plan_code: selectedPlanCode,
          billing_cycle: 'monthly',
          status: 'TRIALING',
        });
      } catch (sbErr) {
        console.warn('[API registrations] Supabase cloud sync warning:', sbErr);
      }
    }

    return NextResponse.json({
      success: true,
      trialId,
      businessName: cleanBusiness,
      expiryDate: new Date(trialEndsAt).toLocaleDateString(),
      organizationId: orgId,
      registrationId: regId,
    });
  } catch (err: any) {
    console.error('[API registrations] Registration error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/registrations
 * Handles administrative actions: Account Activation, Trial Extension, Suspension, Approval.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { action, organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ success: false, error: 'Organization ID is required.' }, { status: 400 });
    }

    const dbPath = getDiskDbPath();
    const SQL = await getSqlInstance();
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ success: false, error: 'Database file not found.' }, { status: 404 });
    }

    const fileBuf = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuf);
    const now = new Date().toISOString();

    if (action === 'ACTIVATE') {
      const {
        planCode = 'STARTER',
        planName = 'Starter',
        startDate = now,
        expiryDate,
        username,
        password,
        adminId = 'super_admin',
        paymentReference = 'BANK_TRANSFER_VERIFIED',
      } = body;

      const passwordHash = password ? bcrypt.hashSync(password, 10) : '';

      // 1. Update customer_registrations
      db.run(
        `UPDATE customer_registrations
         SET status = 'ACTIVE',
             selected_plan_code = ?,
             payment_status = 'VERIFIED',
             payment_reference = ?,
             password_hash = COALESCE(NULLIF(?, ''), password_hash),
             notes = ?,
             email_verified_at = COALESCE(email_verified_at, ?),
             updated_at = ?
         WHERE organization_id = ?`,
        [planCode, paymentReference, passwordHash, `Activated credentials: ${username}`, now, now, organizationId]
      );

      // 2. Update or insert into subscriptions
      const subCheck = db.prepare(`SELECT id FROM subscriptions WHERE organization_id = :orgId LIMIT 1`);
      subCheck.bind({ ':orgId': organizationId });
      let hasSub = subCheck.step();
      subCheck.free();

      if (hasSub) {
        db.run(
          `UPDATE subscriptions
           SET status = 'ACTIVE',
               plan_id = ?,
               current_period_start = ?,
               current_period_end = ?,
               updated_at = ?
           WHERE organization_id = ?`,
          [planCode, startDate, expiryDate, now, organizationId]
        );
      } else {
        const subId = `sub-${Date.now()}`;
        db.run(
          `INSERT INTO subscriptions (id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_started_at, trial_ends_at, trial_used, created_at, updated_at)
           VALUES (?, ?, ?, 'ACTIVE', 'MONTHLY', ?, ?, ?, ?, 1, ?, ?)`,
          [subId, organizationId, planCode, startDate, expiryDate, startDate, expiryDate, now, now]
        );
      }

      // 3. Update or insert merchant cashier user credentials
      if (username) {
        // Fetch registration info
        const regStmt = db.prepare(`SELECT email, full_name, business_name FROM customer_registrations WHERE organization_id = :orgId LIMIT 1`);
        regStmt.bind({ ':orgId': organizationId });
        let customerEmail = '';
        let customerFullName = username;
        if (regStmt.step()) {
          const obj = regStmt.getAsObject();
          customerEmail = (obj.email as string) || '';
          customerFullName = (obj.full_name as string) || (obj.business_name as string) || username;
        }
        regStmt.free();

        const userStmt = db.prepare(`SELECT id FROM users WHERE username = :u OR (email = :e AND email != '') LIMIT 1`);
        userStmt.bind({ ':u': username, ':e': customerEmail });
        let existingUserId = '';
        if (userStmt.step()) existingUserId = (userStmt.getAsObject().id as string) || '';
        userStmt.free();

        if (existingUserId) {
          db.run(
            `UPDATE users
             SET username = ?, email = COALESCE(NULLIF(?, ''), email),
                 password_hash = COALESCE(NULLIF(?, ''), password_hash),
                 full_name = ?, is_active = 1, status = 'ACTIVE', updated_at = ?
             WHERE id = ?`,
            [username, customerEmail, passwordHash, customerFullName, now, existingUserId]
          );
        } else {
          const newUserId = `usr-${Date.now()}`;
          db.run(
            `INSERT INTO users (id, business_id, branch_id, role_id, username, email, password_hash, full_name, status, is_active, created_at, updated_at)
             VALUES (?, 'biz-001', 'branch-001', 'role-admin', ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)`,
            [newUserId, username, customerEmail, passwordHash, customerFullName, now, now]
          );
        }
      }

      // 4. Log Audit
      try {
        const auditId = `aud-${Date.now()}`;
        db.run(
          `INSERT INTO admin_audit_logs (id, admin_user_id, admin_email, admin_role, action, entity_type, entity_id, target_org_id, reason, created_at)
           VALUES (?, ?, ?, 'SUPER_ADMIN', 'ACTIVATION_APPROVED', 'SUBSCRIPTION', ?, ?, ?, ?)`,
          [auditId, adminId, adminId, organizationId, organizationId, `Activated ${planName} plan until ${expiryDate}`, now]
        );
      } catch {}

      // Save back to disk
      const exported = db.export();
      fs.writeFileSync(dbPath, Buffer.from(exported));
      console.log(`[API registrations] Successfully activated organization ${organizationId} on ${planCode} plan!`);

      // 5. Sync to Supabase Cloud
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('customer_registrations').update({
            status: 'ACTIVE',
            selected_plan_code: planCode,
            payment_status: 'VERIFIED',
            payment_reference: paymentReference,
            notes: `Activated credentials: ${username}`,
            updated_at: now,
          }).eq('organization_id', organizationId);

          await supabase.from('subscriptions').update({
            status: 'ACTIVE',
            plan_id: planCode,
            current_period_start: startDate,
            current_period_end: expiryDate,
            updated_at: now,
          }).eq('organization_id', organizationId);
        } catch (sbErr) {
          console.warn('[Supabase Cloud Activation Sync]:', sbErr);
        }
      }

      return NextResponse.json({ success: true, message: `Activated on ${planCode} plan successfully.` });
    }

    if (action === 'EXTEND') {
      const { days = 14, adminId = 'super_admin', reason = 'Extended by Super Admin' } = body;
      const numDays = Number(days) || 14;

      // Extend subscriptions and customer_registrations
      const subStmt = db.prepare(`SELECT current_period_end, trial_ends_at FROM subscriptions WHERE organization_id = :orgId LIMIT 1`);
      subStmt.bind({ ':orgId': organizationId });
      let currentEnd = '';
      if (subStmt.step()) {
        const obj = subStmt.getAsObject();
        currentEnd = (obj.current_period_end as string) || (obj.trial_ends_at as string) || '';
      }
      subStmt.free();

      const baseDate = currentEnd && new Date(currentEnd) > new Date() ? new Date(currentEnd) : new Date();
      baseDate.setDate(baseDate.getDate() + numDays);
      const newExpiry = baseDate.toISOString();

      db.run(
        `UPDATE subscriptions
         SET current_period_end = ?, trial_ends_at = ?, updated_at = ?
         WHERE organization_id = ?`,
        [newExpiry, newExpiry, now, organizationId]
      );

      // Audit log
      try {
        db.run(
          `INSERT INTO admin_audit_logs (id, admin_user_id, admin_email, admin_role, action, entity_type, entity_id, target_org_id, reason, created_at)
           VALUES (?, ?, ?, 'SUPER_ADMIN', 'TRIAL_EXTENDED', 'SUBSCRIPTION', ?, ?, ?, ?)`,
          [`aud-${Date.now()}`, adminId, adminId, organizationId, organizationId, reason, now]
        );
      } catch {}

      const exported = db.export();
      fs.writeFileSync(dbPath, Buffer.from(exported));

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('subscriptions').update({
            current_period_end: newExpiry,
            trial_ends_at: newExpiry,
            updated_at: now,
          }).eq('organization_id', organizationId);
        } catch {}
      }

      return NextResponse.json({ success: true, newExpiry, message: `Extended by ${numDays} days.` });
    }

    if (action === 'SUSPEND') {
      const { reason = 'Suspended by Super Admin', adminId = 'super_admin' } = body;
      db.run(`UPDATE customer_registrations SET status = 'SUSPENDED', notes = ?, updated_at = ? WHERE organization_id = ?`, [reason, now, organizationId]);
      db.run(`UPDATE subscriptions SET status = 'SUSPENDED', updated_at = ? WHERE organization_id = ?`, [now, organizationId]);

      try {
        db.run(
          `INSERT INTO admin_audit_logs (id, admin_user_id, admin_email, admin_role, action, entity_type, entity_id, target_org_id, reason, created_at)
           VALUES (?, ?, ?, 'SUPER_ADMIN', 'ORGANIZATION_SUSPENDED', 'ORGANIZATION', ?, ?, ?, ?)`,
          [`aud-${Date.now()}`, adminId, adminId, organizationId, organizationId, reason, now]
        );
      } catch {}

      const exported = db.export();
      fs.writeFileSync(dbPath, Buffer.from(exported));

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('customer_registrations').update({ status: 'SUSPENDED', notes: reason, updated_at: now }).eq('organization_id', organizationId);
          await supabase.from('subscriptions').update({ status: 'SUSPENDED', updated_at: now }).eq('organization_id', organizationId);
        } catch {}
      }

      return NextResponse.json({ success: true, message: 'Organization suspended.' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
  } catch (err: any) {
    console.error('[API registrations PATCH error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

