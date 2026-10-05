'use client';

import React, { useState, useEffect } from 'react';
import { getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import {
  SubscriptionService,
  SubscriptionOverview,
  PlanDetail,
  SubscriptionInvoiceItem,
} from '@/services/subscription/SubscriptionService';
import { SystemStatusBar } from '@/components/common/SystemStatusBar';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Users,
  Building,
  Package,
  FileText,
  Clock,
  RefreshCw,
  Check,
  X,
  HelpCircle,
  Download,
  AlertCircle,
  Lock,
} from 'lucide-react';

export default function SubscriptionBillingPage() {
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [allPlans, setAllPlans] = useState<PlanDetail[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoiceItem[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const loadSubscriptionData = () => {
    setIsLoading(true);
    try {
      const db = getRawSqlDb();
      const ov = SubscriptionService.getSubscriptionOverview(db, 'org-01');
      setOverview(ov);

      const plans = SubscriptionService.getAllPlans(db);
      setAllPlans(plans);

      const invs = SubscriptionService.getInvoicesHistory(db, 'org-01');
      setInvoices(invs);
    } catch (err: any) {
      console.error('Failed to load subscription data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const handleChangePlan = (planCode: string) => {
    setFeedback(null);
    try {
      const db = getRawSqlDb();
      const res = SubscriptionService.changePlan(db, 'org-01', planCode, selectedCycle);
      setFeedback({
        type: 'success',
        message: `✓ Successfully switched plan to ${res.planName} (${selectedCycle.toLowerCase()} billing).`,
      });
      loadSubscriptionData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to change subscription plan.',
      });
    }
  };

  const handleConfirmCancel = () => {
    try {
      const db = getRawSqlDb();
      SubscriptionService.cancelSubscription(db, 'org-01', 'u-admin', cancellationReason || 'Cost considerations');
      setFeedback({
        type: 'success',
        message: `✓ Subscription cancellation scheduled for end of billing period (${new Date(overview?.currentPeriodEnd || '').toLocaleDateString()}). Your business data remains 100% safe.`,
      });
      setShowCancelModal(false);
      loadSubscriptionData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to schedule cancellation.' });
    }
  };

  const handleReactivate = () => {
    try {
      const db = getRawSqlDb();
      SubscriptionService.reactivateSubscription(db, 'org-01', 'u-admin');
      setFeedback({
        type: 'success',
        message: '✓ Subscription reactivated successfully! Auto-renewal restored.',
      });
      loadSubscriptionData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reactivate subscription.' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Subscription & Billing Portal
              <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
                SaaS Billing
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Manage organization plan, entitlements, billing cycle, usage limits, and invoices.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SystemStatusBar />
          <button
            onClick={loadSubscriptionData}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-md border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-900/90 border-rose-500/30 text-rose-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Trial Banner if Trialing */}
        {overview?.status === 'TRIALING' && (
          <div className="bg-amber-500 text-slate-950 p-4 rounded-xl shadow-sm flex items-center justify-between font-medium">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-5 h-5 text-slate-950 fill-current" />
              <span>
                <strong>14-Day Free Trial Active</strong> — {overview.trialDaysRemaining} days remaining in trial period.
              </span>
            </div>
            <a
              href="#plans-section"
              className="px-3.5 py-1.5 bg-slate-950 text-white rounded-md text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Choose Plan
            </a>
          </div>
        )}

        {/* Subscription & Usage Overview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Active Subscription Summary Card */}
          <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Subscription</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    overview?.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : overview?.status === 'TRIALING'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  ● {overview?.status}
                </span>
              </div>

              <div className="mt-3">
                <h2 className="text-2xl font-black text-slate-900">{overview?.planName}</h2>
                <div className="text-3xl font-extrabold text-slate-900 mt-1">
                  £{overview?.billingCycle === 'YEARLY' ? overview?.yearlyPrice : overview?.monthlyPrice}
                  <span className="text-xs font-normal text-slate-500 ml-1">
                    /{overview?.billingCycle.toLowerCase()}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Organization:</span>
                  <span className="font-semibold text-slate-900">{overview?.organizationName}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Current Period:</span>
                  <span className="font-medium text-slate-900">
                    {overview?.currentPeriodStart ? new Date(overview.currentPeriodStart).toLocaleDateString() : '—'} →{' '}
                    {overview?.currentPeriodEnd ? new Date(overview.currentPeriodEnd).toLocaleDateString() : '—'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Auto Renew:</span>
                  <span className={`font-semibold ${overview?.cancelAtPeriodEnd ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {overview?.cancelAtPeriodEnd ? 'OFF (Cancels at period end)' : 'ON'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-medium text-slate-900">{overview?.paymentMethod}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              {overview?.cancelAtPeriodEnd ? (
                <button
                  onClick={handleReactivate}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  Reactivate Subscription
                </button>
              ) : (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>

          {/* Right: Usage & Entitlements Overview (2 cols) */}
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600" />
                Resource Limits & Entitlements
              </h3>
              <span className="text-xs text-slate-500">Real-time Backend Enforced</span>
            </div>

            {/* Usage Progress Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Users */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" /> Active Users
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {overview?.usage.users.current} / {overview?.usage.users.max}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((overview?.usage.users.current || 1) / (overview?.usage.users.max || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Branches */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" /> Branches & Locations
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {overview?.usage.branches.current} / {overview?.usage.branches.max}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((overview?.usage.branches.current || 1) / (overview?.usage.branches.max || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Products */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-slate-400" /> Products Catalog
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {overview?.usage.products.current.toLocaleString()} / {overview?.usage.products.max.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((overview?.usage.products.current || 1) / (overview?.usage.products.max || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Monthly Transactions */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" /> Monthly Sales Transactions
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {(overview?.usage?.monthlyTransactions?.current ?? 0).toLocaleString()} /{' '}
                    {(overview?.usage?.monthlyTransactions?.max ?? 5000) > 99999
                      ? 'Unlimited'
                      : (overview?.usage?.monthlyTransactions?.max ?? 5000).toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((overview?.usage.monthlyTransactions.current || 1) / (overview?.usage.monthlyTransactions.max || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Active Entitlements Checklist */}
            <div className="pt-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Included Features & Entitlements
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                {overview?.entitlements.map((feat) => (
                  <span
                    key={feat}
                    className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    {feat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Plan Comparison & Pricing Matrix */}
        <div id="plans-section" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Subscription Plans & Entitlements</h2>
              <p className="text-xs text-slate-500">Choose the plan that fits your business scale. Upgrade or downgrade anytime.</p>
            </div>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
              <button
                onClick={() => setSelectedCycle('MONTHLY')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  selectedCycle === 'MONTHLY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setSelectedCycle('YEARLY')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedCycle === 'YEARLY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yearly Billing
                <span className="px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-extrabold text-[10px] rounded-full">
                  Save 17%
                </span>
              </button>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {allPlans.map((plan) => {
              const isCurrent = overview?.planCode === plan.code;
              const price = selectedCycle === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;

              return (
                <div
                  key={plan.code}
                  className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
                    isCurrent
                      ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base text-slate-900">{plan.name}</h3>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                          Current Plan
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 min-h-[32px]">{plan.description}</p>

                    <div>
                      <div className="text-2xl font-black text-slate-900">
                        £{price}
                        <span className="text-xs font-normal text-slate-500">/{selectedCycle.toLowerCase()}</span>
                      </div>
                      {selectedCycle === 'YEARLY' && plan.yearlyPrice > 0 && (
                        <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                          Equivalent to £{(plan.yearlyPrice / 12).toFixed(2)}/mo
                        </div>
                      )}
                    </div>

                    {/* Features Checklist */}
                    <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Up to <strong>{plan.maxUsers} Users</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Up to <strong>{plan.maxBranches} Branch(es)</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Up to <strong>{plan.maxProducts.toLocaleString()} Products</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Support: <strong>{plan.supportLevel}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 mt-4 border-t border-slate-100">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2 bg-slate-100 text-slate-500 font-bold rounded-lg text-xs cursor-default"
                      >
                        Active Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => handleChangePlan(plan.code)}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors"
                      >
                        Select Plan
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Invoices & Billing History Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Billing History & Tax Invoices ({invoices.length})
            </h2>
            <span className="text-xs text-slate-500">Immutable Receipts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Plan / Cycle</th>
                  <th className="px-4 py-3">Billing Period</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No billing invoices recorded yet.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {inv.planName} ({inv.billingCycle.toLowerCase()})
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(inv.periodStart).toLocaleDateString()} → {new Date(inv.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">£{inv.totalAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-600">{inv.paymentMethod}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                          ● {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => alert(`Tax Invoice ${inv.invoiceNumber} downloaded.`)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-[11px] flex items-center gap-1 ml-auto"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Invoice
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">Cancel Subscription</h3>
              <button onClick={() => setShowCancelModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-medium flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Your data is 100% safe.</strong> Cancelled subscriptions remain fully active until{' '}
                  {new Date(overview?.currentPeriodEnd || '').toLocaleDateString()}. After this date, your business data remains protected in read-only mode.
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for cancellation (optional):</label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Tell us how we can improve..."
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  rows={3}
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md text-xs"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md text-xs"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
