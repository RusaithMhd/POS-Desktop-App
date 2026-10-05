'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, User, Mail, Phone, Globe, Shield, CreditCard,
  Monitor, LogOut, ArrowRight, CheckCircle2, Clock, Zap, ArrowLeft
} from 'lucide-react';
import { AuthService } from '@/features/auth/AuthService';
import { CustomerRegistrationService, PLAN_CATALOG } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';

export default function CustomerAccountPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [registration, setRegistration] = useState<any>(null);
  const [deviceCount, setDeviceCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = AuthService.getActiveSession();
    if (!user) {
      router.push('/login');
      return;
    }
    setCurrentUser(user);

    getLocalDb().then(() => {
      try {
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
    });
  }, [router]);

  const handleLogout = () => {
    AuthService.logout();
    router.push('/login');
  };

  const status = subscription?.status || registration?.status || 'TRIALING';
  const isTrial = status === 'TRIALING';
  const isActive = status === 'ACTIVE';

  let daysRemaining = 0;
  if (subscription?.trial_ends_at) {
    daysRemaining = Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000));
  }

  const planCode = subscription?.plan_code || registration?.selected_plan_code || 'STARTER';
  const planDetails = PLAN_CATALOG[planCode as keyof typeof PLAN_CATALOG] || PLAN_CATALOG.STARTER;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to POS
            </Link>
            <div className="border-l border-slate-700 pl-3">
              <h1 className="text-sm font-black text-white">Customer Account Portal</h1>
              <p className="text-[11px] text-slate-400">
                {organization?.name || 'Organization Profile'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">
              Signed in as <strong className="text-white">{currentUser?.fullName || currentUser?.username}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-red-950/60 hover:text-red-400 rounded-lg text-xs font-bold text-slate-300 border border-slate-700 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="max-w-screen-xl mx-auto flex items-center gap-2 mt-4 pt-1 overflow-x-auto">
          <Link
            href="/account"
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          >
            Overview
          </Link>
          <Link
            href="/account/subscription"
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Subscription & Billing
          </Link>
          <Link
            href="/account/devices"
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Hardware Devices ({deviceCount})
          </Link>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 pt-6 space-y-6">
        {/* Trial or Status Banner */}
        {isTrial && (
          <div className="bg-gradient-to-r from-cyan-950/80 via-blue-950/60 to-slate-900 border border-cyan-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Free Trial Active ({daysRemaining} days remaining)</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  You are evaluating TRIWYN POS. Upgrade before your trial expires to avoid terminal interruption.
                </p>
              </div>
            </div>
            <Link
              href="/account/subscription"
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-cyan-500/20"
            >
              <Zap className="h-4 w-4" /> Upgrade Plan
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Subscription Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Plan</span>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isActive
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : isTrial
                    ? 'bg-cyan-950 text-cyan-400 border-cyan-800'
                    : 'bg-amber-950 text-amber-400 border-amber-800'
                }`}
              >
                {status}
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">{subscription?.plan_name || planDetails.name}</h2>
              <p className="text-xs text-slate-400 mt-1">
                Rs. {planDetails.monthlyPrice.toLocaleString()} / month (billed {registration?.billing_cycle?.toLowerCase() || 'monthly'})
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Authorized Devices</span>
                <span className="font-bold text-white">
                  {deviceCount} of {planDetails.maxDevices} used
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Max User Seats</span>
                <span className="font-bold text-white">{planDetails.maxUsers} Cashiers/Managers</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Product Capacity</span>
                <span className="font-bold text-white">{planDetails.maxProducts.toLocaleString()} items</span>
              </div>
            </div>

            <Link
              href="/account/subscription"
              className="w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <CreditCard className="h-4 w-4" /> Manage Subscription
            </Link>
          </div>

          {/* Business Details Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Business Profile</span>
              <span className="text-[11px] font-mono text-slate-500">Org ID: {organization?.id || '—'}</span>
            </div>

            <div>
              <h2 className="text-xl font-black text-white">{organization?.name || registration?.business_name || 'My Company'}</h2>
              <p className="text-xs text-slate-400 mt-0.5">Commercial account registration details</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
                <User className="h-4 w-4 text-slate-400" />
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Primary Contact</div>
                  <div className="font-bold text-white">{registration?.full_name || currentUser?.fullName}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
                <Mail className="h-4 w-4 text-slate-400" />
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Registered Email</div>
                  <div className="font-bold text-white">{registration?.email || organization?.email || '—'}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
                <Phone className="h-4 w-4 text-slate-400" />
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Phone Number</div>
                  <div className="font-bold text-white">{registration?.phone || 'Not configured'}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
                <Globe className="h-4 w-4 text-slate-400" />
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Timezone / Currency</div>
                  <div className="font-bold text-white">Asia/Colombo (LKR Rs.)</div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
              <span>Need help or want to request custom plan features?</span>
              <a href="mailto:support@triwyn.com" className="text-emerald-400 font-bold hover:underline">
                Contact Enterprise Support →
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
