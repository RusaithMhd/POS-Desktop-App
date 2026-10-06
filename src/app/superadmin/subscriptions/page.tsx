'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard, Check, X, Clock, Shield, AlertCircle, RefreshCw,
  Search, CheckCircle2, ChevronRight, Ban, FileText, UserCheck,
  Calendar, Key, Copy, CheckCheck, Loader2
} from 'lucide-react';
import { AdminAuthGuard, AdminHeader } from '@/components/auth/AdminAuthGuard';
import { AdminAuthService } from '@/services/auth/AdminAuthService';
import { CustomerRegistrationService, PLAN_CATALOG } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';

export default function SubscriptionsApprovalPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Activation Modal State (Rules 21 - 23)
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activeTargetSub, setActiveTargetSub] = useState<any | null>(null);
  const [selectedPlanDuration, setSelectedPlanDuration] = useState<'1_MONTH' | '3_MONTHS' | '6_MONTHS' | '1_YEAR' | 'CUSTOM'>('1_MONTH');
  const [planName, setPlanName] = useState('Standard Monthly');
  const [planPrice, setPlanPrice] = useState(4500);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 30 * 86400_000).toISOString().split('T')[0]
  );
  const [assignUsername, setAssignUsername] = useState('');
  const [assignPassword, setAssignPassword] = useState('Store@2026!');
  const [paymentRef, setPaymentRef] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activatedCredentials, setActivatedCredentials] = useState<{
    business: string;
    username: string;
    pass: string;
    plan: string;
    expiry: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const list = await CustomerRegistrationService.listAllRegistrations();
      setSubscriptions(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openActivationModal = (sub: any) => {
    setActiveTargetSub(sub);
    const code = sub.business_name ? sub.business_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : 'posadmin';
    setAssignUsername(code || 'owner');
    setAssignPassword(`Pos@${Math.floor(1000 + Math.random() * 9000)}!`);
    setStartDate(new Date().toISOString().split('T')[0]);
    handleDurationChange('1_MONTH');
    setPaymentRef(`BANK-${Date.now().toString().slice(-6)}`);
    setShowActivateModal(true);
  };

  const handleDurationChange = (dur: '1_MONTH' | '3_MONTHS' | '6_MONTHS' | '1_YEAR' | 'CUSTOM') => {
    setSelectedPlanDuration(dur);
    const start = new Date(startDate);
    let days = 30;
    let name = 'Monthly Plan';
    let price = 4500;

    if (dur === '1_MONTH') {
      days = 30;
      name = 'Monthly Plan';
      price = 4500;
    } else if (dur === '3_MONTHS') {
      days = 90;
      name = 'Quarterly Plan (3 Months)';
      price = 12500;
    } else if (dur === '6_MONTHS') {
      days = 180;
      name = 'Bi-Annual Plan (6 Months)';
      price = 24000;
    } else if (dur === '1_YEAR') {
      days = 365;
      name = 'Annual Enterprise Plan (1 Year)';
      price = 45000;
    }

    setPlanName(name);
    setPlanPrice(price);
    const end = new Date(start.getTime() + days * 86400_000);
    setExpiryDate(end.toISOString().split('T')[0]);
  };

  const handleConfirmActivation = async () => {
    if (!activeTargetSub) return;
    if (!assignUsername.trim() || !assignPassword.trim()) {
      alert('Please specify both username and password to assign to the customer.');
      return;
    }

    setIsActivating(true);
    try {
      const adminSession = AdminAuthService.getActiveSession();
      const adminId = adminSession?.id || 'superadmin';

      await CustomerRegistrationService.activatePaidAccount({
        organizationId: activeTargetSub.organization_id,
        planName,
        planCode: selectedPlanDuration,
        monthlyPrice: planPrice,
        startDate,
        expiryDate,
        username: assignUsername.trim(),
        password: assignPassword.trim(),
        adminId,
        paymentReference: paymentRef.trim() || 'BANK_TRANSFER_VERIFIED',
      });

      setActivatedCredentials({
        business: activeTargetSub.business_name,
        username: assignUsername.trim(),
        pass: assignPassword.trim(),
        plan: planName,
        expiry: expiryDate,
      });

      setShowActivateModal(false);
      setActionNotice(`Customer ${activeTargetSub.business_name} activated successfully!`);
      setTimeout(() => setActionNotice(null), 5000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to activate account.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleReject = async (orgId: string) => {
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    const ok = await CustomerRegistrationService.suspendOrganization(orgId, 'Subscription request rejected by administrator', adminId);
    if (ok) {
      setActionNotice('Subscription request rejected.');
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
    }
  };

  const pending = subscriptions.filter(
    (s) =>
      s.status === 'SUBSCRIPTION_PENDING_APPROVAL' ||
      s.status === 'PAYMENT_PENDING' ||
      s.status === 'PAYMENT_RECEIVED' ||
      s.status === 'REGISTERED' ||
      s.status === 'TRIALING'
  );

  const active = subscriptions.filter((s) => s.status === 'ACTIVE');

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
        <AdminHeader
          title="Subscription Approvals & Activation Portal"
          subtitle="Verify bank transfer payments, assign POS credentials, and activate customer licenses"
          actions={
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          }
        />

        <main className="max-w-screen-xl mx-auto px-6 pt-6 space-y-6">
          {actionNotice && (
            <div className="p-4 bg-emerald-950/80 border border-emerald-600/50 rounded-xl text-emerald-300 text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Activated Credentials Banner (Ready to copy for WhatsApp) */}
          {activatedCredentials && (
            <div className="p-6 bg-slate-900 border-2 border-emerald-500 rounded-3xl space-y-4 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                    <Key className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Paid Account Activated for {activatedCredentials.business}!</h3>
                    <p className="text-xs text-slate-300">Copy these credentials to send to the customer on WhatsApp:</p>
                  </div>
                </div>
                <button
                  onClick={() => setActivatedCredentials(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-slate-200 space-y-1.5">
                <div>🎉 *TRIWYN POS Commercial License Activated*</div>
                <div>🏢 *Business:* {activatedCredentials.business}</div>
                <div>📦 *Plan:* {activatedCredentials.plan}</div>
                <div>📅 *Valid Until:* {activatedCredentials.expiry}</div>
                <div>👤 *Username:* <strong className="text-emerald-400">{activatedCredentials.username}</strong></div>
                <div>🔑 *Password:* <strong className="text-emerald-400">{activatedCredentials.pass}</strong></div>
                <div>💻 Launch your Desktop POS and sign in with these credentials.</div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const text = `🎉 *TRIWYN POS Commercial License Activated*\n🏢 Business: ${activatedCredentials.business}\n📦 Plan: ${activatedCredentials.plan}\n📅 Valid Until: ${activatedCredentials.expiry}\n👤 Username: ${activatedCredentials.username}\n🔑 Password: ${activatedCredentials.pass}\n\nLaunch your Desktop POS and sign in with these credentials.`;
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy WhatsApp Message'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Pending Approvals & Trial Customers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-black text-white">Customers Awaiting Activation / Trials ({pending.length})</h2>
              </div>
              <span className="text-xs text-slate-400">Select any customer to verify payment & activate</span>
            </div>

            {pending.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 space-y-2">
                <Clock className="h-8 w-8 text-amber-500/80 mx-auto" />
                <p className="text-sm font-black text-white uppercase tracking-wide">NO PENDING ACTIVATIONS</p>
                <p className="text-xs text-slate-400">Customers awaiting subscription approval or trial activation will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pending.map((sub) => {
                  const isTrial = sub.status === 'TRIALING';
                  return (
                    <div
                      key={sub.id}
                      className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-xl space-y-4 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            isTrial ? 'bg-cyan-950 text-cyan-400 border-cyan-800' : 'bg-amber-950 text-amber-400 border-amber-800'
                          }`}>
                            {sub.status.replace(/_/g, ' ')}
                          </span>
                          <h3 className="text-base font-black text-white mt-1.5">{sub.business_name}</h3>
                          <p className="text-xs text-slate-400">{sub.email} • {sub.full_name}</p>
                          {sub.phone && <p className="text-xs text-slate-400">Phone: {sub.phone}</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono text-slate-500 block">ID: {sub.id.slice(0, 14)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => handleReject(sub.organization_id)}
                          className="flex-1 h-9 rounded-xl bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <X className="h-4 w-4" /> Reject / Suspend
                        </button>
                        <button
                          onClick={() => openActivationModal(sub)}
                          className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/40 cursor-pointer"
                        >
                          <Check className="h-4 w-4" /> Verify & Activate Account
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Subscriptions List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mt-6">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Active Paid Accounts ({active.length})</h3>
                <p className="text-xs text-slate-400 mt-0.5">Commercial customers authorized to operate desktop POS</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-5 font-bold">Business Name</th>
                    <th className="py-3 px-4 font-bold">Plan</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold">Activated On</th>
                    <th className="py-3 px-5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {active.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 space-y-2">
                        <CreditCard className="h-8 w-8 text-emerald-500/80 mx-auto" />
                        <div className="text-sm font-black text-white uppercase tracking-wide">NO ACTIVE SUBSCRIPTIONS</div>
                        <div className="text-xs text-slate-400">Activated customer subscriptions will appear here.</div>
                      </td>
                    </tr>
                  ) : (
                    active.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-white">
                          <div>{sub.business_name}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{sub.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400">{sub.selected_plan_code}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-800">
                            ACTIVE
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">{new Date(sub.updated_at || sub.created_at).toLocaleDateString()}</td>
                        <td className="py-3.5 px-5 text-right space-x-2">
                          <button
                            onClick={() => openActivationModal(sub)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800 text-[11px] font-bold"
                          >
                            Renew / Change Plan
                          </button>
                          <button
                            onClick={() => {
                              const adminSession = AdminAuthService.getActiveSession();
                              CustomerRegistrationService.suspendOrganization(sub.organization_id, 'Suspended by admin', adminSession?.id || 'admin');
                              loadData();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 text-[11px] font-bold border border-slate-700 transition-colors"
                          >
                            Suspend
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

        {/* ───────────────────────────────────────────────────────────────────
            MANUAL ACTIVATION MODAL (Rules 21 - 23)
            ─────────────────────────────────────────────────────────────────── */}
        {showActivateModal && activeTargetSub && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Activate Customer Account</h3>
                    <p className="text-xs text-slate-400">{activeTargetSub.business_name}</p>
                  </div>
                </div>
                <button onClick={() => setShowActivateModal(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Step 1: Select Plan Duration (Rule 22) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Select Activation Plan Duration</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: '1_MONTH', label: '1 Month', days: 30 },
                    { id: '3_MONTHS', label: '3 Months', days: 90 },
                    { id: '6_MONTHS', label: '6 Months', days: 180 },
                    { id: '1_YEAR', label: '1 Year', days: 365 },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleDurationChange(p.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                        selectedPlanDuration === p.id
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div>{p.label}</div>
                      <div className="text-[10px] opacity-75 font-normal">{p.days} Days</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates & Pricing */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Step 2: Assign Username & Password (Rule 23) */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <Key className="h-3.5 w-3.5" /> Assign POS User Credentials (Rule 23)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Assigned Username</label>
                    <input
                      type="text"
                      required
                      value={assignUsername}
                      onChange={(e) => setAssignUsername(e.target.value)}
                      placeholder="e.g. metro_admin"
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Assigned Password</label>
                    <input
                      type="text"
                      required
                      value={assignPassword}
                      onChange={(e) => setAssignPassword(e.target.value)}
                      placeholder="e.g. Store@2026!"
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-400 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  These credentials will be assigned to this customer so they can sign in to their desktop POS.
                </p>
              </div>

              {/* Payment Verification Proof */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">Bank Transfer Reference / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Slip verified on WhatsApp / Ref #TX-8491"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowActivateModal(false)}
                  className="flex-1 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isActivating}
                  onClick={handleConfirmActivation}
                  className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/40 cursor-pointer disabled:opacity-50"
                >
                  {isActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>Activate & Issue License</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </AdminAuthGuard>
  );
}
