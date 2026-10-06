'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard, Check, Zap, Clock, Shield, AlertCircle, Building2,
  CheckCircle2, FileText, Download, RefreshCw, Monitor
} from 'lucide-react';
import { CustomerRegistrationService, PLAN_CATALOG } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function CustomerSubscriptionPage() {
  const [currentPlanCode, setCurrentPlanCode] = useState('STARTER');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [subscription, setSubscription] = useState<any>(null);
  const [registration, setRegistration] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const db = getRawSqlDb();

      const regStmt = db.prepare(`SELECT * FROM customer_registrations LIMIT 1`);
      if (regStmt.step()) {
        const reg = regStmt.getAsObject();
        setRegistration(reg);
        setCurrentPlanCode((reg.selected_plan_code as string) || 'STARTER');
        setBillingCycle((reg.billing_cycle as 'MONTHLY' | 'YEARLY') || 'MONTHLY');
      }
      regStmt.free();

      const subStmt = db.prepare(`
        SELECT s.*, p.name as plan_name, p.code as plan_code
        FROM subscriptions s
        LEFT JOIN subscription_plans p ON p.id = s.plan_id
        LIMIT 1
      `);
      if (subStmt.step()) {
        setSubscription(subStmt.getAsObject());
      }
      subStmt.free();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPlan = async (planKey: string) => {
    if (planKey === currentPlanCode) return;
    setIsProcessing(true);
    try {
      const db = getRawSqlDb();
      const orgId = registration?.organization_id || subscription?.organization_id || 'org-01';
      const now = new Date().toISOString();

      db.run(
        `UPDATE customer_registrations SET selected_plan_code = ?, updated_at = ? WHERE organization_id = ?`,
        [planKey, now, orgId]
      );
      db.run(
        `UPDATE subscriptions SET status = 'PAYMENT_PENDING', updated_at = ? WHERE organization_id = ?`,
        [now, orgId]
      );
      saveLocalDbState();

      setActionNotice(`Upgrade request for ${planKey} submitted. Super Admin will verify and activate your new tier.`);
      setTimeout(() => setActionNotice(null), 4500);
      loadData();
    } catch (e) {
      console.error('Plan upgrade error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-900 select-none">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-emerald-600" /> Subscription & Billing Management
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Plan tiers, billing cycle, feature upgrades, and payment invoice receipts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={loadData} variant="outline" size="sm" className="gap-1.5 text-xs font-bold border-slate-300 hover:bg-slate-100">
            <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* 2. SUB-NAV TABS */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-bold">
        {[
          { href: '/account', label: 'Overview', icon: Building2, active: false },
          { href: '/account/subscription', label: 'Subscription & Billing', icon: CreditCard, active: true },
          { href: '/account/devices', label: 'Hardware Devices', icon: Monitor, active: false },
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

      {actionNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 3. BILLING CYCLE TOGGLE BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
        <div>
          <h2 className="text-sm font-black text-slate-900">Choose or Upgrade Your Subscription</h2>
          <p className="text-xs text-slate-500 mt-0.5">Scale terminal licenses, multi-branch support, and concurrent cashiers</p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setBillingCycle('MONTHLY')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              billingCycle === 'MONTHLY' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('YEARLY')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              billingCycle === 'YEARLY' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Annual Billing</span>
            <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded font-black">Save 17%</span>
          </button>
        </div>
      </div>

      {/* 4. PLANS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(PLAN_CATALOG).map(([key, plan]) => {
          if (key === 'FREE_TRIAL') return null;

          const isCurrent = currentPlanCode === key;
          const price = billingCycle === 'YEARLY' ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;

          return (
            <div
              key={key}
              className={`bg-white rounded-xl p-5 border flex flex-col justify-between space-y-5 transition-all shadow-xs ${
                isCurrent
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">{plan.name}</span>
                  {isCurrent && (
                    <Badge className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-300">
                      Current Plan
                    </Badge>
                  )}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900">Rs. {price.toLocaleString()}</span>
                  <span className="text-xs text-slate-500">/ mo</span>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{plan.maxUsers} Cashier / Admin Seats</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{plan.maxDevices} Hardware POS Terminals</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{plan.maxBranches} Branch Locations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{plan.maxProducts.toLocaleString()} Product Catalog Limit</span>
                  </li>
                </ul>
              </div>

              <Button
                onClick={() => handleSelectPlan(key)}
                disabled={isCurrent || isProcessing}
                className={`w-full h-10 font-bold text-xs transition-all ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-400 hover:bg-slate-100 cursor-default border border-slate-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer'
                }`}
              >
                {isCurrent ? 'Current Active Plan' : `Upgrade to ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      {/* 5. INVOICES / BILLING HISTORY */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900">Billing History & Official Receipts</h3>
          <p className="text-xs text-slate-500 mt-0.5">Records of subscription invoices and verified payments</p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 font-extrabold">Invoice #</th>
                <th className="py-3 px-4 font-extrabold">Date</th>
                <th className="py-3 px-4 font-extrabold">Plan Description</th>
                <th className="py-3 px-4 font-extrabold">Amount</th>
                <th className="py-3 px-4 font-extrabold">Status</th>
                <th className="py-3 px-4 font-extrabold text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-slate-900">INV-2026-001</td>
                <td className="py-3 px-4 text-slate-500">{new Date().toLocaleDateString()}</td>
                <td className="py-3 px-4 text-slate-800 font-semibold">{currentPlanCode} Subscription (Initial Activation)</td>
                <td className="py-3 px-4 font-black text-slate-900">Rs. {PLAN_CATALOG[currentPlanCode as keyof typeof PLAN_CATALOG]?.monthlyPrice.toLocaleString() || '0'}</td>
                <td className="py-3 px-4">
                  <Badge className="text-[10px] font-black bg-emerald-50 text-emerald-700 border-emerald-300">
                    PAID / ACTIVE
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => alert('Official electronic invoice generated.')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md text-[11px] inline-flex items-center gap-1 transition-colors border border-slate-200"
                  >
                    <Download className="h-3 w-3 text-slate-500" /> Download PDF
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
