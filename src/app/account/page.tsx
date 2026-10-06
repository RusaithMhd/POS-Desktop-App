'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, User, Mail, Phone, Globe, Shield, CreditCard,
  Monitor, ArrowRight, CheckCircle2, Clock, Zap, RefreshCw,
  Layers, Users, Check, Sparkles, ExternalLink
} from 'lucide-react';
import { AuthService } from '@/features/auth/AuthService';
import { CustomerRegistrationService, PLAN_CATALOG } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function CustomerAccountPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [registration, setRegistration] = useState<any>(null);
  const [deviceCount, setDeviceCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = AuthService.getActiveSession();
      if (!user) {
        router.push('/login');
        return;
      }
      setCurrentUser(user);

      await getLocalDb();
      const db = getRawSqlDb();

      // 1. Get org
      const orgStmt = db.prepare(`SELECT * FROM organizations LIMIT 1`);
      let org: any = null;
      if (orgStmt.step()) org = orgStmt.getAsObject();
      orgStmt.free();
      setOrganization(org);

      // 2. Get customer registration
      const regStmt = db.prepare(`SELECT * FROM customer_registrations LIMIT 1`);
      let reg: any = null;
      if (regStmt.step()) reg = regStmt.getAsObject();
      regStmt.free();
      setRegistration(reg);

      // 3. Get subscription
      const subStmt = db.prepare(`
        SELECT s.*, p.name as plan_name, p.code as plan_code, p.max_users, p.max_devices, p.max_branches, p.monthly_price
        FROM subscriptions s
        LEFT JOIN subscription_plans p ON p.id = s.plan_id
        LIMIT 1
      `);
      let sub: any = null;
      if (subStmt.step()) sub = subStmt.getAsObject();
      subStmt.free();
      setSubscription(sub);

      // 4. Get device count
      try {
        const devStmt = db.prepare(`SELECT COUNT(*) as cnt FROM device_licenses WHERE status = 'ACTIVE'`);
        if (devStmt.step()) setDeviceCount((devStmt.getAsObject().cnt as number) || 0);
        devStmt.free();
      } catch { /* devices */ }
    } catch (err) {
      console.error('Account load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [router]);

  const status = (subscription?.status || registration?.status || 'ACTIVE').toUpperCase();
  const isTrial = status === 'TRIALING' || status === 'TRIAL';
  const isActive = status === 'ACTIVE';

  let daysRemaining = 0;
  if (subscription?.trial_ends_at) {
    daysRemaining = Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000));
  }

  const planCode = subscription?.plan_code || registration?.selected_plan_code || 'STARTER';
  const planDetails = PLAN_CATALOG[planCode as keyof typeof PLAN_CATALOG] || PLAN_CATALOG.STARTER;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-900 select-none">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-emerald-600" /> Subscription & Organization
            </h1>
            <Badge
              variant="outline"
              className={`text-xs font-black uppercase px-2.5 py-0.5 ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : isTrial
                  ? 'bg-cyan-50 text-cyan-700 border-cyan-300'
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}
            >
              {status}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Commercial license status, business details, plan quotas, and hardware terminal authorizations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={loadData} variant="outline" size="sm" className="gap-1.5 text-xs font-bold border-slate-300 hover:bg-slate-100">
            <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Details
          </Button>
          <Link href="/account/subscription">
            <Button size="sm" className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              <Zap className="h-3.5 w-3.5" /> Manage Plan
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. SUB-NAV TABS (matching Accounting & Settings tab aesthetic) */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-bold">
        {[
          { href: '/account', label: 'Overview', icon: Building2, active: true },
          { href: '/account/subscription', label: 'Subscription & Billing', icon: CreditCard, active: false },
          { href: '/account/devices', label: `Hardware Devices (${deviceCount})`, icon: Monitor, active: false },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg transition-colors cursor-pointer whitespace-nowrap ${
                t.active
                  ? 'bg-slate-900 text-white font-extrabold shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 ${t.active ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>

      {/* 3. TRIAL NOTICE BANNER (if trial) */}
      {isTrial && (
        <div className="bg-gradient-to-r from-cyan-900 to-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-cyan-800">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black flex items-center gap-2">
                Free Trial Active <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-black">{daysRemaining} Days Left</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Your business is evaluating TRIWYN POS. Upgrade before expiration for continuous offline checkout.
              </p>
            </div>
          </div>
          <Link
            href="/account/subscription"
            className="px-3.5 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <Zap className="h-3.5 w-3.5" /> Upgrade Plan
          </Link>
        </div>
      )}

      {/* 4. MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CURRENT PLAN CARD */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Current Plan</span>
            <Badge
              className={`text-[10px] font-black uppercase px-2 py-0.5 ${
                isActive
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-cyan-100 text-cyan-800 border-cyan-200'
              }`}
            >
              {status}
            </Badge>
          </div>

          <div>
            <div className="text-2xl font-black text-slate-900">{subscription?.plan_name || planDetails.name}</div>
            <div className="text-xs font-bold text-slate-500 mt-1">
              Rs. {planDetails.monthlyPrice.toLocaleString()} / month <span className="font-normal text-slate-400">({registration?.billing_cycle?.toLowerCase() || 'monthly'} billing)</span>
            </div>
          </div>

          {/* Plan Limits & Quotas */}
          <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-slate-400" /> Authorized Devices
              </span>
              <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {deviceCount} of {planDetails.maxDevices} used
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400" /> Max User Seats
              </span>
              <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {planDetails.maxUsers} Cashiers/Managers
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-400" /> Product Capacity
              </span>
              <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {planDetails.maxProducts.toLocaleString()} items
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/account/subscription"
              className="w-full h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs"
            >
              <CreditCard className="h-3.5 w-3.5 text-amber-400" /> Manage Subscription & Invoices
            </Link>
          </div>
        </div>

        {/* BUSINESS PROFILE CARD */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Business Profile</span>
            <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Org ID: {organization?.id || registration?.organization_id || '—'}
            </span>
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900">
              {organization?.name || registration?.business_name || 'My Store'}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Commercial account registration details and contact records</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="p-2 bg-white rounded-md border border-slate-200 text-slate-600 shadow-2xs">
                <User className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Primary Contact</div>
                <div className="font-black text-slate-900 text-xs truncate">
                  {registration?.full_name || currentUser?.fullName || 'Business Owner'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="p-2 bg-white rounded-md border border-slate-200 text-slate-600 shadow-2xs">
                <Mail className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Registered Email</div>
                <div className="font-black text-slate-900 text-xs truncate">
                  {registration?.email || organization?.email || '—'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="p-2 bg-white rounded-md border border-slate-200 text-slate-600 shadow-2xs">
                <Phone className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Phone Number</div>
                <div className="font-black text-slate-900 text-xs truncate">
                  {registration?.phone || 'Not configured'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="p-2 bg-white rounded-md border border-slate-200 text-slate-600 shadow-2xs">
                <Globe className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Timezone / Currency</div>
                <div className="font-black text-slate-900 text-xs truncate">Asia/Colombo (LKR Rs.)</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-medium">Need assistance, custom device limits, or printer integration?</span>
            <Link href="/settings" className="text-emerald-700 font-bold hover:underline flex items-center gap-1">
              Store Configuration Settings <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 5. SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold">Terminal Authorization</div>
            <div className="text-lg font-black text-slate-900 mt-0.5">{deviceCount} Active PCs</div>
          </div>
          <Link href="/account/devices" className="text-xs font-bold text-emerald-600 hover:underline">
            Manage &rarr;
          </Link>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold">Offline Database</div>
            <div className="text-lg font-black text-emerald-700 mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Local SQLite Synced
            </div>
          </div>
          <Link href="/settings" className="text-xs font-bold text-emerald-600 hover:underline">
            Backup &rarr;
          </Link>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold">Billing Cycle</div>
            <div className="text-lg font-black text-slate-900 mt-0.5 capitalize">
              {registration?.billing_cycle?.toLowerCase() || 'Monthly'} Renewals
            </div>
          </div>
          <Link href="/account/subscription" className="text-xs font-bold text-emerald-600 hover:underline">
            Invoices &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
