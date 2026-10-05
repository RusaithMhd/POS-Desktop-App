'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2, Users, Search, Filter, Shield, Ban, CheckCircle2,
  RefreshCw, ChevronRight, Settings, Phone, Mail, Globe, Calendar,
  ArrowUpDown
} from 'lucide-react';
import { AdminAuthGuard, AdminHeader } from '@/components/auth/AdminAuthGuard';
import { AdminAuthService } from '@/services/auth/AdminAuthService';
import { CustomerRegistrationService, PLAN_CATALOG } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';

export default function CustomersManagementPage() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Selected customer for modal
  const [activeOrg, setActiveOrg] = useState<any | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState('STARTER');
  const [showPlanModal, setShowPlanModal] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const list = CustomerRegistrationService.listAllRegistrations();
      setRegistrations(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePlanChange = () => {
    if (!activeOrg) return;
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    const ok = CustomerRegistrationService.changeOrganizationPlan(activeOrg.organization_id, selectedPlanCode, adminId);
    if (ok) {
      setActionNotice(`Plan changed to ${selectedPlanCode} successfully.`);
      setTimeout(() => setActionNotice(null), 3500);
      setShowPlanModal(false);
      setActiveOrg(null);
      loadData();
    }
  };

  const handleToggleSuspend = (org: any) => {
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    const isSuspended = org.status === 'SUSPENDED';

    if (isSuspended) {
      CustomerRegistrationService.activateOrganization(org.organization_id, adminId);
      setActionNotice('Organization reactivated.');
    } else {
      CustomerRegistrationService.suspendOrganization(org.organization_id, 'Super Admin Manual Suspension', adminId);
      setActionNotice('Organization suspended.');
    }
    setTimeout(() => setActionNotice(null), 3500);
    loadData();
  };

  const filtered = registrations.filter((r) => {
    const matchStatus = statusFilter === 'ALL' || (r.status || '').toUpperCase() === statusFilter;
    const matchSearch =
      (r.business_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.organization_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
        <AdminHeader
          title="Customer & Organization Management"
          subtitle="Directory of all registered tenant organizations, plans, and access controls"
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

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {['ALL', 'ACTIVE', 'TRIALING', 'SUBSCRIPTION_PENDING_APPROVAL', 'SUSPENDED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === st
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search business, owner, email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Customer Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                No organizations found matching your criteria.
              </div>
            ) : (
              filtered.map((org) => {
                const isSuspended = org.status === 'SUSPENDED';
                const isActive = org.status === 'ACTIVE';
                const isTrial = org.status === 'TRIALING';

                return (
                  <div
                    key={org.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                            <Building2 className="h-5 w-5 text-amber-400" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white leading-tight">{org.business_name}</h3>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {org.organization_id}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                              : isTrial
                              ? 'bg-cyan-950/80 text-cyan-400 border-cyan-800'
                              : isSuspended
                              ? 'bg-red-950/80 text-red-400 border-red-800'
                              : 'bg-amber-950/80 text-amber-400 border-amber-800'
                          }`}
                        >
                          {org.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Users className="h-3.5 w-3.5 text-slate-500" />
                          <span>Owner: {org.full_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <Mail className="h-3.5 w-3.5 text-slate-500" />
                          <span>{org.email}</span>
                        </div>
                        {org.phone && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            <span>{org.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Assigned Plan</span>
                          <span className="font-bold text-white text-xs">{org.selected_plan_code}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Billing</span>
                          <span className="font-bold text-slate-300 text-xs lowercase">{org.billing_cycle}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveOrg(org);
                          setSelectedPlanCode(org.selected_plan_code || 'STARTER');
                          setShowPlanModal(true);
                        }}
                        className="flex-1 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition-colors"
                      >
                        Change Plan
                      </button>

                      <button
                        onClick={() => handleToggleSuspend(org)}
                        className={`px-3 h-8 rounded-lg text-[11px] font-bold border transition-colors ${
                          isSuspended
                            ? 'bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border-emerald-800'
                            : 'bg-red-950/60 text-red-400 hover:bg-red-900/60 border-red-800/80'
                        }`}
                      >
                        {isSuspended ? 'Reactivate' : 'Suspend'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>

        {/* Change Plan Modal */}
        {showPlanModal && activeOrg && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white">Override Plan for {activeOrg.business_name}</h3>
              <p className="text-xs text-slate-400">
                Immediately updates the organization's tier, hardware limits, and system capabilities.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Select New Plan Tier</label>
                <select
                  value={selectedPlanCode}
                  onChange={(e) => setSelectedPlanCode(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                >
                  {Object.keys(PLAN_CATALOG).map((code) => (
                    <option key={code} value={code}>
                      {code} — Rs. {PLAN_CATALOG[code as keyof typeof PLAN_CATALOG].monthlyPrice}/mo
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="flex-1 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlanChange}
                  className="flex-1 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black"
                >
                  Apply Change
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminAuthGuard>
  );
}
