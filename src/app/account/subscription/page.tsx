'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard, Check, Zap, Clock, Shield, AlertCircle, ArrowLeft,
  CheckCircle2, FileText, Download, RefreshCw
} from 'lucide-react';
import { CustomerRegistrationService, PLAN_CATALOG } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';

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
      const orgId = registration?.organization_id || subscription?.organization_id;
      if (!orgId) return;

      const now = new Date().toISOString();

      // Submit plan upgrade request
      db.run(
        `UPDATE customer_registrations SET selected_plan_code = ?, status = 'SUBSCRIPTION_PENDING_APPROVAL', updated_at = ? WHERE organization_id = ?`,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Account
            </Link>
            <div className="border-l border-slate-700 pl-3">
              <h1 className="text-sm font-black text-white">Subscription & Billing Management</h1>
              <p className="text-[11px] text-slate-400">Plan tiers, billing cycle, feature upgrades, and payment history</p>
            </div>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="max-w-screen-xl mx-auto flex items-center gap-2 mt-4 pt-1 overflow-x-auto">
          <Link
            href="/account"
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Overview
          </Link>
          <Link
            href="/account/subscription"
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          >
            Subscription & Billing
          </Link>
          <Link
            href="/account/devices"
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Hardware Devices
          </Link>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 pt-6 space-y-8">
        {actionNotice && (
          <div className="p-4 bg-emerald-950/80 border border-emerald-600/50 rounded-xl text-emerald-300 text-sm font-bold flex items-center gap-2 shadow-lg">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Billing Cycle Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <div>
            <h2 className="text-base font-black text-white">Choose or Upgrade Your Subscription</h2>
            <p className="text-xs text-slate-400 mt-0.5">Scale terminal licenses, multi-branch support, and concurrent cashiers</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                billingCycle === 'MONTHLY' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('YEARLY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === 'YEARLY' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] bg-emerald-400/20 text-emerald-300 px-1.5 py-0.2 rounded-full font-bold">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Available Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(PLAN_CATALOG).map(([key, plan]) => {
            if (key === 'FREE_TRIAL') return null; // Don't show trial as upgrade target

            const isCurrent = currentPlanCode === key;
            const price = billingCycle === 'YEARLY' ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;

            return (
              <div
                key={key}
                className={`bg-slate-900/90 rounded-2xl p-5 border flex flex-col justify-between space-y-5 transition-all ${
                  isCurrent
                    ? 'border-emerald-500 shadow-xl shadow-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{plan.name}</span>
                    {isCurrent && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                        Current Plan
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">Rs. {price.toLocaleString()}</span>
                    <span className="text-xs text-slate-400">/ mo</span>
                  </div>

                  <ul className="mt-4 space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{plan.maxUsers} Cashier / Admin Seats</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{plan.maxDevices} Hardware POS Terminals</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{plan.maxBranches} Branch Locations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{plan.maxProducts.toLocaleString()} Product Catalog Limit</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleSelectPlan(key)}
                  disabled={isCurrent || isProcessing}
                  className={`w-full h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                    isCurrent
                      ? 'bg-slate-800 text-slate-500 cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-pointer'
                  }`}
                >
                  {isCurrent ? 'Current Active Plan' : `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Payment History / Invoices Section */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">Billing History & Official Receipts</h3>
              <p className="text-xs text-slate-400 mt-0.5">Records of subscription invoices and verified payments</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 font-bold">Invoice #</th>
                  <th className="py-3 px-4 font-bold">Date</th>
                  <th className="py-3 px-4 font-bold">Plan Description</th>
                  <th className="py-3 px-4 font-bold">Amount</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-white">INV-2026-001</td>
                  <td className="py-3 px-4 text-slate-400">{new Date().toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-slate-200">{currentPlanCode} Subscription (Initial Activation)</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">Rs. {PLAN_CATALOG[currentPlanCode as keyof typeof PLAN_CATALOG]?.monthlyPrice.toLocaleString() || '0'}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-800">
                      PAID / ACTIVE
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => alert('Official electronic invoice generated.')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 transition-colors"
                    >
                      <Download className="h-3 w-3" /> Download PDF
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
