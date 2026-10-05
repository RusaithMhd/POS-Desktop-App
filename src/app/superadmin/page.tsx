'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2, Users, CreditCard, Shield, Clock, Monitor,
  AlertTriangle, CheckCircle2, ChevronRight, TrendingUp,
  RefreshCw, Search, ArrowUpRight, Ban, PlusCircle, Check
} from 'lucide-react';
import { AdminAuthGuard, AdminHeader } from '@/components/auth/AdminAuthGuard';
import { AdminAuthService } from '@/services/auth/AdminAuthService';
import { CustomerRegistrationService, PLAN_CATALOG } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';

interface DashboardStats {
  totalOrgs: number;
  activeSubs: number;
  trialingOrgs: number;
  pendingApprovals: number;
  suspendedOrgs: number;
  totalDevices: number;
  activeDevices: number;
  pendingDevices: number;
  estimatedMrr: number;
}

interface RegistrationRow {
  id: string;
  organization_id: string;
  business_name: string;
  full_name: string;
  email: string;
  selected_plan_code: string;
  billing_cycle: string;
  status: string;
  sub_status?: string;
  trial_ends_at?: string;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrgs: 0,
    activeSubs: 0,
    trialingOrgs: 0,
    pendingApprovals: 0,
    suspendedOrgs: 0,
    totalDevices: 0,
    activeDevices: 0,
    pendingDevices: 0,
    estimatedMrr: 0,
  });

  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modal states
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(14);
  const [suspendReason, setSuspendReason] = useState('');
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const db = getRawSqlDb();

      // Load all registrations
      const regs = (CustomerRegistrationService.listAllRegistrations() as unknown) as RegistrationRow[];
      setRegistrations(regs);

      // Compute stats
      let totalOrgs = 0;
      let activeSubs = 0;
      let trialingOrgs = 0;
      let pendingApprovals = 0;
      let suspendedOrgs = 0;
      let estimatedMrr = 0;

      regs.forEach((r) => {
        totalOrgs++;
        const st = (r.status || '').toUpperCase();
        if (st === 'ACTIVE') {
          activeSubs++;
          const plan = PLAN_CATALOG[r.selected_plan_code as keyof typeof PLAN_CATALOG];
          if (plan) estimatedMrr += plan.monthlyPrice;
        } else if (st === 'TRIALING') {
          trialingOrgs++;
        } else if (st === 'SUBSCRIPTION_PENDING_APPROVAL' || st === 'PAYMENT_PENDING' || st === 'PAYMENT_RECEIVED') {
          pendingApprovals++;
        } else if (st === 'SUSPENDED') {
          suspendedOrgs++;
        }
      });

      // Load device counts
      let totalDevices = 0;
      let activeDevices = 0;
      let pendingDevices = 0;
      try {
        const devStmt = db.prepare(`SELECT status, COUNT(*) as cnt FROM registered_devices GROUP BY status`);
        while (devStmt.step()) {
          const row = devStmt.getAsObject();
          const count = (row.cnt as number) || 0;
          totalDevices += count;
          if (row.status === 'ACTIVE') activeDevices += count;
          if (row.status === 'PENDING') pendingDevices += count;
        }
        devStmt.free();
      } catch { /* devices table may be empty */ }

      // Load recent audit logs
      const logs: any[] = [];
      try {
        const logStmt = db.prepare(`SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 6`);
        while (logStmt.step()) {
          logs.push(logStmt.getAsObject());
        }
        logStmt.free();
      } catch { /* logs table */ }
      setAuditLogs(logs);

      setStats({
        totalOrgs,
        activeSubs,
        trialingOrgs,
        pendingApprovals,
        suspendedOrgs,
        totalDevices,
        activeDevices,
        pendingDevices,
        estimatedMrr,
      });
    } catch (err) {
      console.error('Failed to load superadmin overview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = (orgId: string) => {
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    const ok = CustomerRegistrationService.approveSubscription(orgId, adminId);
    if (ok) {
      setActionMessage('Subscription approved successfully!');
      setTimeout(() => setActionMessage(null), 3500);
      loadData();
    }
  };

  const handleExtendSubmit = () => {
    if (!selectedOrgId) return;
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    const ok = CustomerRegistrationService.extendTrial(selectedOrgId, extendDays, adminId, 'Extended by Super Admin');
    if (ok) {
      setActionMessage(`Trial extended by ${extendDays} days!`);
      setTimeout(() => setActionMessage(null), 3500);
      setShowExtendModal(false);
      setSelectedOrgId(null);
      loadData();
    }
  };

  const handleSuspendSubmit = () => {
    if (!selectedOrgId) return;
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    const ok = CustomerRegistrationService.suspendOrganization(selectedOrgId, suspendReason || 'Violation of terms', adminId);
    if (ok) {
      setActionMessage('Organization suspended.');
      setTimeout(() => setActionMessage(null), 3500);
      setShowSuspendModal(false);
      setSelectedOrgId(null);
      setSuspendReason('');
      loadData();
    }
  };

  const filteredRegistrations = registrations.filter((r) => {
    const query = searchQuery.toLowerCase();
    return (
      (r.business_name || '').toLowerCase().includes(query) ||
      (r.email || '').toLowerCase().includes(query) ||
      (r.selected_plan_code || '').toLowerCase().includes(query) ||
      (r.status || '').toLowerCase().includes(query)
    );
  });

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
        <AdminHeader
          title="Super Admin Dashboard"
          subtitle="Platform overview, customer licensing, subscription approvals, and system health"
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
          {/* Action notification toast */}
          {actionMessage && (
            <div className="p-4 bg-emerald-950/80 border border-emerald-600/50 rounded-xl text-emerald-300 text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 animate-in fade-in slide-in-from-top-2 duration-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>{actionMessage}</span>
            </div>
          )}

          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Organizations</span>
                <Building2 className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-white">{stats.totalOrgs}</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">{stats.activeSubs} active</span> •{' '}
                <span className="text-amber-400 font-bold">{stats.trialingOrgs} trialing</span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Pending Approvals</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400">{stats.pendingApprovals}</div>
              <div className="text-[11px] text-slate-400">
                {stats.pendingApprovals > 0 ? (
                  <Link href="/superadmin/subscriptions" className="text-amber-400 font-bold hover:underline flex items-center gap-1">
                    Needs review <ChevronRight className="h-3 w-3" />
                  </Link>
                ) : (
                  'All requests cleared'
                )}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Active Trials</span>
                <Shield className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-cyan-400">{stats.trialingOrgs}</div>
              <div className="text-[11px] text-slate-400">
                <Link href="/superadmin/trials" className="text-cyan-400 font-bold hover:underline flex items-center gap-1">
                  Manage trials <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Devices</span>
                <Monitor className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-white">{stats.totalDevices}</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">{stats.activeDevices} active</span> •{' '}
                <span className="text-amber-400 font-bold">{stats.pendingDevices} pending</span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Estimated MRR</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400">
                Rs. {stats.estimatedMrr.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400">Monthly Recurring Revenue</div>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/superadmin/subscriptions"
              className="flex items-center justify-between p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Subscription Queue</div>
                  <div className="text-[10px] text-slate-400">Approve & verify plans</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </Link>

            <Link
              href="/superadmin/trials"
              className="flex items-center justify-between p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Trial Management</div>
                  <div className="text-[10px] text-slate-400">Extend & convert trials</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            </Link>

            <Link
              href="/superadmin/devices"
              className="flex items-center justify-between p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/50 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20">
                  <Monitor className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Device Licenses</div>
                  <div className="text-[10px] text-slate-400">Authorizations & hardware</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
            </Link>

            <Link
              href="/superadmin/customers"
              className="flex items-center justify-between p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">All Organizations</div>
                  <div className="text-[10px] text-slate-400">Manage customer accounts</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
            </Link>
          </div>

          {/* Customer Organizations Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-white">Registered Organizations & Subscriptions</h2>
                <p className="text-xs text-slate-400 mt-0.5">Live view of customer accounts, trial countdowns, and subscription states</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search organizations…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 pr-3 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 w-52 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-5 font-bold">Business / Owner</th>
                    <th className="py-3 px-4 font-bold">Plan & Cycle</th>
                    <th className="py-3 px-4 font-bold">Account Status</th>
                    <th className="py-3 px-4 font-bold">Trial / Expiry</th>
                    <th className="py-3 px-4 font-bold">Registered</th>
                    <th className="py-3 px-5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No organizations found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRegistrations.map((r) => {
                      const st = (r.status || 'REGISTERED').toUpperCase();
                      const isPending = st === 'SUBSCRIPTION_PENDING_APPROVAL' || st === 'PAYMENT_PENDING' || st === 'PAYMENT_RECEIVED';
                      const isTrial = st === 'TRIALING';
                      const isActive = st === 'ACTIVE';
                      const isSuspended = st === 'SUSPENDED';

                      let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
                      if (isActive) badgeClass = 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80';
                      else if (isTrial) badgeClass = 'bg-cyan-950/80 text-cyan-400 border-cyan-800/80';
                      else if (isPending) badgeClass = 'bg-amber-950/80 text-amber-400 border-amber-800/80';
                      else if (isSuspended) badgeClass = 'bg-red-950/80 text-red-400 border-red-800/80';

                      return (
                        <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="font-bold text-white text-xs">{r.business_name}</div>
                            <div className="text-[11px] text-slate-400">{r.email} • {r.full_name}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-xs">{r.selected_plan_code}</div>
                            <div className="text-[10px] text-slate-400 lowercase">{r.billing_cycle}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${badgeClass}`}>
                              {st}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 text-xs">
                            {r.trial_ends_at ? (
                              <div>
                                <span>{new Date(r.trial_ends_at).toLocaleDateString()}</span>
                                {isTrial && (
                                  <div className="text-[10px] text-cyan-400">
                                    {Math.max(0, Math.ceil((new Date(r.trial_ends_at).getTime() - Date.now()) / 86400000))}d remaining
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-xs">
                            {new Date(r.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-5 text-right space-x-1.5 whitespace-nowrap">
                            {isPending && (
                              <button
                                onClick={() => handleApprove(r.organization_id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1 shadow-sm shadow-emerald-700/50"
                              >
                                <Check className="h-3 w-3" /> Approve
                              </button>
                            )}

                            {isTrial && (
                              <button
                                onClick={() => {
                                  setSelectedOrgId(r.organization_id);
                                  setShowExtendModal(true);
                                }}
                                className="px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1"
                              >
                                <PlusCircle className="h-3 w-3" /> Extend
                              </button>
                            )}

                            {!isSuspended ? (
                              <button
                                onClick={() => {
                                  setSelectedOrgId(r.organization_id);
                                  setShowSuspendModal(true);
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 font-bold rounded-lg text-[11px] border border-slate-700 transition-colors"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  const adminSession = AdminAuthService.getActiveSession();
                                  CustomerRegistrationService.activateOrganization(r.organization_id, adminSession?.id || 'admin');
                                  loadData();
                                }}
                                className="px-2 py-1 bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800 font-bold rounded-lg text-[11px] transition-colors"
                              >
                                Reactivate
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Activity */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Recent Super Admin Audit Activity</h3>
              </div>
              <Link href="/superadmin/audit" className="text-xs text-amber-400 hover:underline">
                View all logs →
              </Link>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No admin actions recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[10px] text-amber-400/90 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900/60">
                        {log.action}
                      </span>
                      <span className="text-slate-300 font-semibold">{log.admin_email}</span>
                      {log.target_org_id && <span className="text-slate-500 text-[11px]">org: {log.target_org_id}</span>}
                    </div>
                    <span className="text-[11px] text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Extend Trial Modal */}
        {showExtendModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-cyan-400" /> Extend Free Trial
              </h3>
              <p className="text-xs text-slate-400">
                Grant additional trial days to allow the customer to continue evaluating TRIWYN POS.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Days to Add</label>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setExtendDays(d)}
                      className={`h-9 rounded-xl text-xs font-bold border transition-all ${
                        extendDays === d
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
                  onClick={() => setShowExtendModal(false)}
                  className="flex-1 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtendSubmit}
                  className="flex-1 h-9 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                >
                  Confirm Extension
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Suspend Modal */}
        {showSuspendModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-900/60 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-500" /> Suspend Organization
              </h3>
              <p className="text-xs text-slate-400">
                Suspending an organization immediately blocks all terminal access for its users.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Suspension Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Overdue payment / TOS breach"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowSuspendModal(false)}
                  className="flex-1 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuspendSubmit}
                  className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                >
                  Suspend Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminAuthGuard>
  );
}
