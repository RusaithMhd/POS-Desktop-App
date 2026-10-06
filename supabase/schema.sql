-- ============================================================================
-- TRIWYN POS — SUPABASE CLOUD DATABASE SCHEMA FOR SUPERADMIN & CLIENT MANAGEMENT
-- Run this script once in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hbjtqraanglrutvcoimt/sql/new
-- ============================================================================

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    phone TEXT,
    timezone TEXT DEFAULT 'Asia/Colombo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Customer Registrations Table
CREATE TABLE IF NOT EXISTS public.customer_registrations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    business_name TEXT NOT NULL,
    phone TEXT,
    country TEXT DEFAULT 'Sri Lanka',
    password_hash TEXT,
    selected_plan_code TEXT DEFAULT 'FREE_TRIAL',
    billing_cycle TEXT DEFAULT 'monthly',
    status TEXT DEFAULT 'TRIALING',
    payment_status TEXT DEFAULT 'PENDING',
    payment_reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id TEXT,
    status TEXT DEFAULT 'TRIALING',
    billing_cycle TEXT DEFAULT 'monthly',
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    trial_started_at TIMESTAMPTZ DEFAULT NOW(),
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    trial_used INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Authorized POS Terminals / Devices Table
CREATE TABLE IF NOT EXISTS public.registered_devices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_type TEXT DEFAULT 'DESKTOP_POS',
    terminal_code TEXT DEFAULT 'TERM-01',
    status TEXT DEFAULT 'ACTIVE',
    registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Super Admin Audit Activity Logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL,
    admin_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT DEFAULT 'ORGANIZATION',
    entity_id TEXT,
    target_org_id TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Super Admin Users Table
CREATE TABLE IF NOT EXISTS public.admin_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Super Administrator',
    role TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    is_active INT NOT NULL DEFAULT 1,
    mfa_enabled INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable Row Level Security and allow access for public anon & authenticated
-- ============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on organizations" ON public.organizations;
CREATE POLICY "Allow anon all on organizations" ON public.organizations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on customer_registrations" ON public.customer_registrations;
CREATE POLICY "Allow anon all on customer_registrations" ON public.customer_registrations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on subscriptions" ON public.subscriptions;
CREATE POLICY "Allow anon all on subscriptions" ON public.subscriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on registered_devices" ON public.registered_devices;
CREATE POLICY "Allow anon all on registered_devices" ON public.registered_devices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on admin_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "Allow anon all on admin_audit_logs" ON public.admin_audit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on admin_users" ON public.admin_users;
CREATE POLICY "Allow anon all on admin_users" ON public.admin_users FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- ENABLE REALTIME NOTIFICATIONS
-- Broadcast live changes when customers register, subscribe, or devices connect
-- ============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_registrations;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.registered_devices;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_audit_logs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
