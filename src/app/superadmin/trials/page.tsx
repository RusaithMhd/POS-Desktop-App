'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock, Shield, PlusCircle, CheckCircle2, AlertTriangle,
  RefreshCw, Search, ArrowRight, Zap, Check
} from 'lucide-react';
import { AdminAuthGuard, AdminHeader } from '@/components/auth/AdminAuthGuard';
import { AdminAuthService } from '@/services/auth/AdminAuthService';
import { CustomerRegistrationService } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';

export default function TrialsManagementPage() {
  const [trials, setTrials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Extend trial modal
  const [targetOrg, setTargetOrg] = useState<any | null>(null);
  const [daysToAdd, setDaysToAdd] = useState(14);
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const list = await CustomerRegistrationService.listAllRegistrations();
      // Filter those that have trial_ends_at or are in TRIALING status
      const trialList = list.filter(
        (item) => item.status === 'TRIALING' || item.selected_plan_code === 'FREE_TRIAL' || item.trial_ends_at
      );
      setTrials(trialList);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExtendSubmit = async () => {
    if (!targetOrg) return;
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    const ok = await CustomerRegistrationService.extendTrial(
      targetOrg.organization_id,
      daysToAdd,
      adminId,
      `Super Admin trial extension of +${daysToAdd} days`
    );
    if (ok) {
      setActionNotice(`Extended trial for ${targetOrg.business_name} by ${daysToAdd} days.`);
      setTimeout(() => setActionNotice(null), 3500);
      setShowModal(false);
      setTargetOrg(null);
      loadData();
    }
  };

  const handleConvertToPaid = (org: any) => {
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    // Upgrade to STARTER and approve
    CustomerRegistrationService.changeOrganizationPlan(org.organization_id, 'STARTER', adminId);
    CustomerRegistrationService.approveSubscription(org.organization_id, adminId);
    setActionNotice(`Converted ${org.business_name} to Starter plan successfully.`);
    setTimeout(() => setActionNotice(null), 3500);
    loadData();
  };

  const filtered = trials.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      (t.business_name || '').toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q) ||
      (t.full_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
        <AdminHeader
          title="Free Trial Management"
          subtitle="Monitor active evaluation periods, extend trials for high-value leads, or convert directly to paid plans"
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

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="text-xs text-slate-400">
              Showing <span className="font-bold text-white">{filtered.length}</span> organizations in trial/evaluation state
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search business, owner…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-2">
                <Clock className="h-8 w-8 text-cyan-400/80 mx-auto" />
                <div className="text-sm font-black text-white uppercase tracking-wide">NO TRIAL CUSTOMERS YET</div>
                <div className="text-xs text-slate-400">Customers who register for the free trial will appear here.</div>
              </div>
            ) : (
              filtered.map((item) => {
                const trialEnds = item.trial_ends_at ? new Date(item.trial_ends_at) : null;
                const now = new Date();
                const daysLeft = trialEnds ? Math.ceil((trialEnds.getTime() - now.getTime()) / 86400000) : 0;
                const isExpired = daysLeft <= 0;

                return (
                  <div
                    key={item.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-black text-white">{item.business_name}</h3>
                          <p className="text-[11px] text-slate-400">{item.email} • {item.full_name}</p>
                        </div>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            isExpired
                              ? 'bg-red-950/80 text-red-400 border-red-800'
                              : daysLeft <= 3
                              ? 'bg-amber-950/80 text-amber-400 border-amber-800'
                              : 'bg-cyan-950/80 text-cyan-400 border-cyan-800'
                          }`}
                        >
                          {isExpired ? 'Expired' : `${daysLeft}d Remaining`}
                        </span>
                      </div>

                      <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/60 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Expires On</span>
                          <span className="font-bold text-white">
                            {trialEnds ? trialEnds.toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Created On</span>
                          <span className="text-slate-300">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setTargetOrg(item);
                          setDaysToAdd(14);
                          setShowModal(true);
                        }}
                        className="flex-1 h-8 rounded-lg bg-cyan-950 text-cyan-400 hover:bg-cyan-900 border border-cyan-800 text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <PlusCircle className="h-3 w-3" /> Extend Trial
                      </button>

                      <button
                        onClick={() => handleConvertToPaid(item)}
                        className="flex-1 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <Zap className="h-3 w-3" /> Convert to Paid
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>

        {/* Extend Modal */}
        {showModal && targetOrg && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white">Extend Trial for {targetOrg.business_name}</h3>
              <p className="text-xs text-slate-400">
                Grant extra evaluation time. The customer can immediately continue testing the POS.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Days to Extend</label>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDaysToAdd(d)}
                      className={`h-9 rounded-xl text-xs font-bold border transition-all ${
                        daysToAdd === d
                          ? 'bg-cyan-600 border-cyan-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      +{d} Days
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtendSubmit}
                  className="flex-1 h-9 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminAuthGuard>
  );
}
