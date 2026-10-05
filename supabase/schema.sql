-- ============================================================================
-- TRIWYN POS — SUPABASE CLOUD DATABASE SCHEMA
-- Run this script once in your Supabase SQL Editor (https://supabase.com/dashboard)
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

-- ============================================================================
-- ENABLE REALTIME NOTIFICATIONS
-- Allows Supabase to broadcast live events when customers register or trials change
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.registered_devices;

-- ============================================================================
-- INITIAL DEMO SEED DATA
-- ============================================================================
INSERT INTO public.organizations (id, name, code, email, phone)
VALUES 
    ('org-1791213425877-466xxh', 'TFTFTF', 'TFT-1001', 'chlifrost@gmail.com', '0770802365'),
    ('org-1791204899120-881bba', 'Rusaith Retail', 'RUS-2002', 'chlifrost.tl@gmail.com', '0750802353'),
    ('org-1791198421045-992ccd', 'Apex Commercial', 'APX-3003', 'rusairzeck72@gmail.com', '0770802365')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customer_registrations (id, organization_id, email, full_name, business_name, phone, selected_plan_code, billing_cycle, status)
VALUES
    ('reg-demo-1', 'org-1791213425877-466xxh', 'chlifrost@gmail.com', 'Rusaith Muhammathu', 'TFTFTF', '0770802365', 'FREE_TRIAL', 'monthly', 'ACTIVE'),
    ('reg-demo-2', 'org-1791204899120-881bba', 'chlifrost.tl@gmail.com', 'Rusaith Muhammathu', 'Rusaith Retail', '0750802353', 'FREE_TRIAL', 'monthly', 'TRIALING'),
    ('reg-demo-3', 'org-1791198421045-992ccd', 'rusairzeck72@gmail.com', 'Muhammathu Rusaith', 'Apex Commercial', '0770802365', 'STARTER', 'yearly', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.subscriptions (id, organization_id, status, billing_cycle, trial_ends_at)
VALUES
    ('sub-demo-1', 'org-1791213425877-466xxh', 'ACTIVE', 'monthly', NOW() + INTERVAL '12 days'),
    ('sub-demo-2', 'org-1791204899120-881bba', 'TRIALING', 'monthly', NOW() + INTERVAL '14 days'),
    ('sub-demo-3', 'org-1791198421045-992ccd', 'ACTIVE', 'yearly', NOW() + INTERVAL '355 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.registered_devices (id, organization_id, device_name, device_type, terminal_code, status)
VALUES
    ('dev-demo-1', 'org-1791213425877-466xxh', 'POS Counter 01 - Windows NSIS', 'DESKTOP_POS', 'TERM-01', 'ACTIVE'),
    ('dev-demo-2', 'org-1791198421045-992ccd', 'Front Cashier - Main Terminal', 'DESKTOP_POS', 'TERM-02', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;
