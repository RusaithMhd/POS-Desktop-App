'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2, Users, Search, Filter, Shield, Ban, CheckCircle2,
  RefreshCw, ChevronRight, Settings, Phone, Mail, Globe, Calendar,
  ArrowUpDown, PlusCircle, Key, MessageCircle, Award, Monitor,
  Download, Sparkles, Volume2, VolumeX, Eye
} from 'lucide-react';
import { AdminAuthGuard, AdminHeader } from '@/components/auth/AdminAuthGuard';
import { AdminAuthService } from '@/services/auth/AdminAuthService';
import { CustomerRegistrationService, PLAN_CATALOG } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { AdminNotificationService } from '@/services/notifications/AdminNotificationService';
import { LiveNotificationToast } from '@/components/superadmin/LiveNotificationToast';
import { LicenseCertificateModal } from '@/components/superadmin/LicenseCertificateModal';
import { HardwareDevicesModal } from '@/components/superadmin/HardwareDevicesModal';

export default function CustomersManagementPage() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Selected customer for modal
  const [activeOrg, setActiveOrg] = useState<any | null>(null);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showHardwareModal, setShowHardwareModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDays, setExtendDays] = useState(14);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const list = CustomerRegistrationService.listAllRegistrations();
      setRegistrations(list);
      AdminNotificationService.scanRegistrations(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

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

  const handleExtendTrial = () => {
    if (!activeOrg) return;
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    CustomerRegistrationService.extendTrial(activeOrg.organization_id, extendDays, adminId, 'Extended in Customers Directory');
    setActionNotice(`Trial extended by ${extendDays} days.`);
    setTimeout(() => setActionNotice(null), 3500);
    setShowExtendModal(false);
    setActiveOrg(null);
    loadData();
  };

  const handleOpenWhatsApp = (customer: any) => {
    const rawPhone = customer?.phone || '94770802365';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const phoneToUse = cleanPhone.startsWith('94') ? cleanPhone : '94' + cleanPhone.replace(/^0/, '');
    const bName = customer?.business_name || 'TRIWYN POS Merchant';
    const text = encodeURIComponent(
      `Hello ${customer?.full_name || bName}, this is TRIWYN POS Super Admin regarding your account for ${bName} (Org: ${customer?.organization_id}). How can we assist your business operations today?`
    );
    window.open(`https://wa.me/${phoneToUse}?text=${text}`, '_blank');
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
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans">
        
        {/* Floating Realtime Toasts */}
        <LiveNotificationToast
          onQuickExtend={(orgId) => {
            const row = registrations.find((r) => r.organization_id === orgId);
            if (row) {
              setActiveOrg(row);
              setShowExtendModal(true);
            }
          }}
          onOpenWhatsApp={(name, orgId) => {
            const row = registrations.find((r) => r.business_name === name || r.organization_id === orgId);
            if (row) handleOpenWhatsApp(row);
          }}
        />

        <AdminHeader
          title="Customer & Organization Management"
          subtitle="Directory of all registered tenant organizations, plans, and access controls"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          }
        />

        <main className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          {actionNotice && (
            <div className="p-4 bg-emerald-950/90 border border-emerald-500/60 rounded-2xl text-emerald-300 text-sm font-bold flex items-center gap-2 shadow-2xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl">
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {[
                { id: 'ALL', label: 'All Organizations' },
                { id: 'ACTIVE', label: 'Active Paid' },
                { id: 'TRIALING', label: 'Free Trials' },
                { id: 'SUBSCRIPTION_PENDING_APPROVAL', label: 'Pending Review' },
                { id: 'SUSPENDED', label: 'Suspended' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === st.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search business, owner, email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Customer Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-3xl space-y-2">
                <Building2 className="h-10 w-10 text-slate-700 mx-auto" />
                <div className="font-bold text-slate-400 text-sm">No organizations found</div>
                <p className="text-xs text-slate-600">Try modifying your filter or search query</p>
              </div>
            ) : (
              filtered.map((org) => {
                const isSuspended = org.status === 'SUSPENDED';
                const isActive = org.status === 'ACTIVE';
                const isTrial = org.status === 'TRIALING' || org.selected_plan_code === 'FREE_TRIAL';
                const initial = (org.business_name || 'P').charAt(0).toUpperCase();

                let remainingDays = 0;
                if (org.trial_ends_at) {
                  remainingDays = Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86400000));
                }

                return (
                  <div
                    key={org.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4 transition-all group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center font-black text-amber-400 text-sm shadow-md">
                            {initial}
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white leading-tight group-hover:text-amber-400 transition-colors">
                              {org.business_name}
                            </h3>
                            <span className="text-[10px] text-slate-500 font-mono">Org: {org.organization_id}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
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

                      <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/50 p-3 rounded-2xl border border-slate-850">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Users className="h-3.5 w-3.5 text-slate-500" />
                          <span>Owner: <strong className="text-slate-200">{org.full_name}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <Mail className="h-3.5 w-3.5 text-slate-500" />
                          <span className="truncate">{org.email}</span>
                        </div>
                        {org.phone && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            <span>{org.phone}</span>
                          </div>
                        )}
                        {isTrial && (
                          <div className="flex items-center gap-2 text-cyan-400 font-bold pt-0.5">
                            <Calendar className="h-3.5 w-3.5 text-cyan-500" />
                            <span>Trial: {remainingDays} day(s) remaining</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Plan Tier</span>
                          <span className="font-bold text-amber-400 text-xs">{org.selected_plan_code}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Billing Cycle</span>
                          <span className="font-bold text-slate-300 text-xs capitalize">{org.billing_cycle || 'monthly'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Toolbar */}
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {isTrial && (
                          <button
                            onClick={() => {
                              setActiveOrg(org);
                              setShowExtendModal(true);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Extend trial days"
                          >
                            <PlusCircle className="h-3 w-3" />
                            <span>+Days</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenWhatsApp(org)}
                          className="p-1.5 rounded-xl bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800 text-xs transition-colors cursor-pointer"
                          title="WhatsApp merchant"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setActiveOrg(org);
                            setShowCertificateModal(true);
                          }}
                          className="p-1.5 rounded-xl bg-amber-950/60 text-amber-300 hover:bg-amber-900 border border-amber-800/80 text-xs transition-colors cursor-pointer"
                          title="View Official License Certificate"
                        >
                          <Award className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setActiveOrg(org);
                            setShowHardwareModal(true);
                          }}
                          className="p-1.5 rounded-xl bg-purple-950/60 text-purple-300 hover:bg-purple-900 border border-purple-800/80 text-xs transition-colors cursor-pointer"
                          title="Authorized Terminals"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleToggleSuspend(org)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                          isSuspended
                            ? 'bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border-emerald-800'
                            : 'bg-slate-900 text-slate-400 hover:text-red-400 hover:bg-red-950/60 border-slate-800'
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

        {/* Certificate Modal */}
        {showCertificateModal && activeOrg && (
          <LicenseCertificateModal
            customer={activeOrg}
            onClose={() => {
              setShowCertificateModal(false);
              setActiveOrg(null);
            }}
          />
        )}

        {/* Hardware Devices Modal */}
        {showHardwareModal && activeOrg && (
          <HardwareDevicesModal
            organizationId={activeOrg.organization_id}
            businessName={activeOrg.business_name}
            onClose={() => {
              setShowHardwareModal(false);
              setActiveOrg(null);
            }}
          />
        )}

        {/* Extend Trial Modal */}
        {showExtendModal && activeOrg && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-cyan-400" /> Extend Free Trial
              </h3>
              <p className="text-xs text-slate-400">
                Grant extra trial days for {activeOrg.business_name}.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Days to Add</label>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setExtendDays(d)}
                      className={`h-9 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
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
                  className="flex-1 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtendTrial}
                  className="flex-1 h-9 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
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
