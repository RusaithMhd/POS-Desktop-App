'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Building2, Users, CreditCard, Shield, Clock, Monitor,
  AlertTriangle, CheckCircle2, ChevronRight, TrendingUp,
  RefreshCw, Search, ArrowUpRight, Ban, PlusCircle, Check,
  Zap, MessageCircle, Copy, Key, Sparkles, Volume2, VolumeX,
  ExternalLink, Eye, Calendar, DollarSign, Activity, Bell,
  Award, Download, Laptop, FileText, Filter, Globe
} from 'lucide-react';
import { AdminAuthGuard, AdminHeader } from '@/components/auth/AdminAuthGuard';
import { AdminAuthService } from '@/services/auth/AdminAuthService';
import { CustomerRegistrationService, PLAN_CATALOG } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { AdminNotificationService, AdminNotification } from '@/services/notifications/AdminNotificationService';
import { LiveNotificationToast } from '@/components/superadmin/LiveNotificationToast';
import { RealtimeNotificationManager } from '@/components/superadmin/RealtimeNotificationManager';
import { LicenseCertificateModal } from '@/components/superadmin/LicenseCertificateModal';
import { HardwareDevicesModal } from '@/components/superadmin/HardwareDevicesModal';

interface DashboardStats {
  totalOrgs: number;
  activeSubs: number;
  trialingOrgs: number;
  pendingApprovals: number;
  expiringTrials: number;
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
  phone?: string;
  country?: string;
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
    expiringTrials: 0,
    suspendedOrgs: 0,
    totalDevices: 0,
    activeDevices: 0,
    pendingDevices: 0,
    estimatedMrr: 0,
  });

  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'TRIALING' | 'EXPIRING' | 'PENDING' | 'SUSPENDED'>('ALL');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Modals state
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<RegistrationRow | null>(null);
  const [extendDays, setExtendDays] = useState(14);
  const [suspendReason, setSuspendReason] = useState('');
  
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showHardwareModal, setShowHardwareModal] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  // Activation Form State
  const [activationPlan, setActivationPlan] = useState<'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE'>('STARTER');
  const [activationDurationMonths, setActivationDurationMonths] = useState<number>(1);
  const [activationStartDate, setActivationStartDate] = useState<string>('');
  const [activationExpiryDate, setActivationExpiryDate] = useState<string>('');
  const [assignedUsername, setAssignedUsername] = useState<string>('');
  const [assignedPassword, setAssignedPassword] = useState<string>('');
  const [bankReference, setBankReference] = useState<string>('');
  const [activationSuccessMsg, setActivationSuccessMsg] = useState<string | null>(null);

  // Load Database and Compute Statistics
  const loadData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoading(true);
    try {
      await getLocalDb();
      const db = getRawSqlDb();

      // Load all registrations (Live Supabase Cloud with offline SQLite fallback)
      const regs = (await CustomerRegistrationService.listAllRegistrations() as unknown) as RegistrationRow[];
      setRegistrations(regs);

      // Trigger realtime scanner
      AdminNotificationService.scanRegistrations(regs);

      // Compute stats
      let totalOrgs = 0;
      let activeSubs = 0;
      let trialingOrgs = 0;
      let pendingApprovals = 0;
      let expiringTrials = 0;
      let suspendedOrgs = 0;
      let estimatedMrr = 0;

      const now = Date.now();
      regs.forEach((r) => {
        totalOrgs++;
        const st = (r.status || '').toUpperCase();
        if (st === 'ACTIVE') {
          activeSubs++;
          const plan = PLAN_CATALOG[r.selected_plan_code as keyof typeof PLAN_CATALOG];
          if (plan) estimatedMrr += plan.monthlyPrice;
        } else if (st === 'TRIALING') {
          trialingOrgs++;
          if (r.trial_ends_at) {
            const diffDays = Math.ceil((new Date(r.trial_ends_at).getTime() - now) / 86400000);
            if (diffDays <= 3 && diffDays >= 0) expiringTrials++;
          }
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
      } catch {}

      // Load recent audit logs
      const logs: any[] = [];
      try {
        const logStmt = db.prepare(`SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 6`);
        while (logStmt.step()) {
          logs.push(logStmt.getAsObject());
        }
        logStmt.free();
      } catch {}
      setAuditLogs(logs);

      setStats({
        totalOrgs,
        activeSubs,
        trialingOrgs,
        pendingApprovals,
        expiringTrials,
        suspendedOrgs,
        totalDevices,
        activeDevices,
        pendingDevices,
        estimatedMrr,
      });

      setRecentNotifications(AdminNotificationService.getNotifications().slice(0, 5));
      setUnreadNotifCount(AdminNotificationService.getUnreadCount());
      setLastSyncedTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load superadmin overview:', err);
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  };

  // Real-time polling every 3.5 seconds
  useEffect(() => {
    loadData(true);
    setSoundEnabled(AdminNotificationService.isSoundEnabled());

    const interval = setInterval(() => {
      loadData(false);
    }, 3500);

    const unsubscribe = AdminNotificationService.subscribe(() => {
      setSoundEnabled(AdminNotificationService.isSoundEnabled());
      setRecentNotifications(AdminNotificationService.getNotifications().slice(0, 5));
      setUnreadNotifCount(AdminNotificationService.getUnreadCount());
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  // Quick Action: Open Activation Modal
  const openActivationModal = (customer: RegistrationRow) => {
    setSelectedCustomer(customer);
    setSelectedOrgId(customer.organization_id);

    const start = new Date();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);

    setActivationStartDate(start.toISOString().split('T')[0]);
    setActivationExpiryDate(expiry.toISOString().split('T')[0]);
    setActivationDurationMonths(1);
    setActivationPlan('STARTER');

    // Suggest default username & password
    const cleanBusiness = (customer.business_name || 'pos').toLowerCase().replace(/[^a-z0-9]/g, '');
    setAssignedUsername(`${cleanBusiness}_admin`);
    setAssignedPassword(`Pos@${Math.floor(1000 + Math.random() * 9000)}`);
    setBankReference(`DEP-${Math.floor(100000 + Math.random() * 900000)}`);
    setActivationSuccessMsg(null);
    setShowActivateModal(true);
  };

  const handleDurationChange = (months: number) => {
    setActivationDurationMonths(months);
    const start = new Date(activationStartDate || Date.now());
    const expiry = new Date(start);
    expiry.setMonth(expiry.getMonth() + months);
    setActivationExpiryDate(expiry.toISOString().split('T')[0]);
  };

  const handleConfirmActivation = async () => {
    if (!selectedCustomer) return;
    if (!assignedUsername.trim() || !assignedPassword.trim()) {
      alert('Please provide both username and password.');
      return;
    }

    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';

    try {
      const plan = PLAN_CATALOG[activationPlan as keyof typeof PLAN_CATALOG];
      const ok = await CustomerRegistrationService.activatePaidAccount({
        organizationId: selectedCustomer.organization_id,
        planName: plan?.name || activationPlan,
        planCode: activationPlan,
        monthlyPrice: plan?.monthlyPrice || 2999,
        startDate: activationStartDate,
        expiryDate: activationExpiryDate,
        username: assignedUsername.trim(),
        password: assignedPassword.trim(),
        paymentReference: bankReference.trim(),
        adminId,
      });

      if (ok) {
        AdminNotificationService.addNotification({
          type: 'SUBSCRIPTION_ACTIVATED',
          title: 'Commercial License Activated',
          message: `${selectedCustomer.business_name} activated on ${activationPlan} plan.`,
          priority: 'HIGH',
          metadata: { businessName: selectedCustomer.business_name, orgId: selectedCustomer.organization_id },
        });

        const successText = `🎉 *TRIWYN POS Commercial License Activated*\n\nBusiness: *${selectedCustomer.business_name}*\nPlan: *${activationPlan} (${activationDurationMonths} Months)*\nExpiry: *${activationExpiryDate}*\n\n*OFFICIAL CASHIER LOGIN CREDENTIALS:*\nUsername: \`${assignedUsername.trim()}\`\nPassword: \`${assignedPassword.trim()}\`\n\nDownload Setup: https://triwynpos.com/download-trial\nOfficial Support: 0770802365 / 0750802353`;

        setActivationSuccessMsg(successText);
        loadData(false);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to activate paid account.');
    }
  };

  const handleExtendSubmit = async () => {
    if (!selectedOrgId) return;
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    const ok = await CustomerRegistrationService.extendTrial(selectedOrgId, extendDays, adminId, 'Extended by Super Admin');
    if (ok) {
      setActionMessage(`Trial extended by ${extendDays} days!`);
      setTimeout(() => setActionMessage(null), 3500);
      setShowExtendModal(false);
      setSelectedOrgId(null);
      loadData(false);
    }
  };

  const handleQuickExtendOrg = async (orgId?: string) => {
    if (!orgId) return;
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    const ok = await CustomerRegistrationService.extendTrial(orgId, 14, adminId, 'Quick Extend +14d');
    if (ok) {
      setActionMessage('Trial extended by +14 days!');
      setTimeout(() => setActionMessage(null), 3500);
      loadData(false);
    }
  };

  const handleSuspendSubmit = async () => {
    if (!selectedOrgId) return;
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    const ok = await CustomerRegistrationService.suspendOrganization(selectedOrgId, suspendReason || 'Violation of terms', adminId);
    if (ok) {
      setActionMessage('Organization suspended.');
      setTimeout(() => setActionMessage(null), 3500);
      setShowSuspendModal(false);
      setSelectedOrgId(null);
      setSuspendReason('');
      loadData(false);
    }
  };

  const handleReactivate = async (orgId: string) => {
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.id || 'admin';
    await CustomerRegistrationService.activateOrganization(orgId, adminId);
    setActionMessage('Organization reactivated.');
    setTimeout(() => setActionMessage(null), 3500);
    loadData(false);
  };

  const handleOpenWhatsApp = (customerOrName: RegistrationRow | string | undefined, orgId?: string) => {
    let customer: RegistrationRow | undefined;
    if (typeof customerOrName === 'string') {
      customer = registrations.find((r) => r.business_name === customerOrName || r.organization_id === orgId);
    } else {
      customer = customerOrName;
    }

    const rawPhone = customer?.phone || '94770802365';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const phoneToUse = cleanPhone.startsWith('94') ? cleanPhone : '94' + cleanPhone.replace(/^0/, '');
    const bName = customer?.business_name || 'TRIWYN POS Merchant';
    const oId = customer?.organization_id || orgId || '';

    const text = encodeURIComponent(
      `Hello ${customer?.full_name || bName}, this is TRIWYN POS Super Admin regarding your account for ${bName} (Org: ${oId}). How can our technical support team assist your retail operations today?`
    );
    window.open(`https://wa.me/${phoneToUse}?text=${text}`, '_blank');
  };

  const handleExportCsv = () => {
    if (registrations.length === 0) return;
    const headers = ['Business Name', 'Owner', 'Email', 'Phone', 'Org ID', 'Plan', 'Billing Cycle', 'Status', 'Trial Ends At', 'Registered Date'];
    const rows = registrations.map((r) => [
      `"${r.business_name}"`,
      `"${r.full_name}"`,
      `"${r.email}"`,
      `"${r.phone || ''}"`,
      `"${r.organization_id}"`,
      `"${r.selected_plan_code}"`,
      `"${r.billing_cycle || 'monthly'}"`,
      `"${r.status}"`,
      `"${r.trial_ends_at || ''}"`,
      `"${r.created_at}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TRIWYN_Merchants_Registry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter registrations
  const filteredRegistrations = registrations.filter((r) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      (r.business_name || '').toLowerCase().includes(query) ||
      (r.full_name || '').toLowerCase().includes(query) ||
      (r.email || '').toLowerCase().includes(query) ||
      (r.organization_id || '').toLowerCase().includes(query);

    if (!matchesSearch) return false;

    const st = (r.status || '').toUpperCase();
    if (statusFilter === 'ACTIVE') return st === 'ACTIVE';
    if (statusFilter === 'TRIALING') return st === 'TRIALING';
    if (statusFilter === 'EXPIRING') {
      if (st !== 'TRIALING' || !r.trial_ends_at) return false;
      const days = Math.ceil((new Date(r.trial_ends_at).getTime() - Date.now()) / 86400000);
      return days <= 3 && days >= 0;
    }
    if (statusFilter === 'PENDING') return st === 'SUBSCRIPTION_PENDING_APPROVAL' || st === 'PAYMENT_PENDING' || st === 'PAYMENT_RECEIVED';
    if (statusFilter === 'SUSPENDED') return st === 'SUSPENDED';

    return true;
  });

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans selection:bg-amber-500/30">
        
        {/* Floating Realtime Toast Container */}
        <LiveNotificationToast
          onQuickActivate={(orgId) => {
            const row = registrations.find((r) => r.organization_id === orgId);
            if (row) openActivationModal(row);
          }}
          onQuickExtend={handleQuickExtendOrg}
          onOpenWhatsApp={(name, orgId) => handleOpenWhatsApp(name, orgId)}
        />

        {/* Super Admin Top Header */}
        <AdminHeader
          title="Super Admin Dashboard"
          subtitle="Real-time licensing registry, live subscription approvals, and hardware control"
          actions={
            <div className="flex items-center gap-2">
              
              {/* Notification Manager Trigger Button */}
              <button
                onClick={() => setShowNotificationDrawer(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Manage Live Notifications"
              >
                <div className="relative">
                  <Bell className="h-4 w-4" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-3.5 min-w-[14px] px-1 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center animate-pulse">
                      {unreadNotifCount}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline">Live Alerts</span>
              </button>

              {/* Sound toggle */}
              <button
                onClick={() => {
                  const next = !soundEnabled;
                  AdminNotificationService.setSoundEnabled(next);
                  if (next) AdminNotificationService.playChime('HIGH');
                }}
                className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                  soundEnabled
                    ? 'bg-slate-800 text-emerald-400 border-emerald-500/30 hover:bg-slate-700'
                    : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                }`}
                title={soundEnabled ? 'Mute Alert Chime' : 'Enable Alert Chime'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              {/* Refresh button */}
              <button
                onClick={() => loadData(true)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          }
        />

        <main className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
          
          {/* Action notification toast */}
          {actionMessage && (
            <div className="p-4 bg-emerald-950/90 border border-emerald-500/60 rounded-2xl text-emerald-300 text-sm font-bold flex items-center justify-between shadow-2xl shadow-emerald-950/60 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span>{actionMessage}</span>
              </div>
              <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white text-xs font-bold">
                Dismiss
              </button>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              REALTIME STATUS BAR & LIVE HEARTBEAT
              ─────────────────────────────────────────────────────────────────── */}
          <div className="p-3 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-950/80 border border-emerald-800/80 rounded-lg text-emerald-400 font-bold text-[11px]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>LIVE SYNC ACTIVE</span>
              </div>
              <span className="text-slate-400 text-[11px]">
                Scanning database every 3.5s • Last verified at <span className="font-mono text-slate-300">{lastSyncedTime || 'now'}</span>
              </span>
              {stats.expiringTrials > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-950 border border-amber-800 text-amber-400 font-bold text-[10px] animate-pulse">
                  ⚠️ {stats.expiringTrials} trial(s) expiring soon!
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="Export registered customers to CSV spreadsheet"
              >
                <Download className="h-3 w-3" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────────
              TOP EXECUTIVE METRIC CARDS (Interactive Click-to-Filter)
              ─────────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            
            {/* Organizations */}
            <div
              onClick={() => setStatusFilter('ALL')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                statusFilter === 'ALL'
                  ? 'bg-blue-950/40 border-blue-500/60 shadow-lg shadow-blue-950/40'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Organizations</span>
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white mt-1">{stats.totalOrgs}</div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                <span className="text-emerald-400 font-bold">{stats.activeSubs} active</span> •{' '}
                <span className="text-cyan-400 font-bold">{stats.trialingOrgs} trials</span>
              </div>
            </div>

            {/* Pending Approvals */}
            <div
              onClick={() => setStatusFilter('PENDING')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                stats.pendingApprovals > 0
                  ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-950/40 animate-pulse'
                  : statusFilter === 'PENDING'
                  ? 'bg-amber-950/20 border-amber-500/60'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">Pending Review</span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-amber-400 mt-1">{stats.pendingApprovals}</div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium">
                {stats.pendingApprovals > 0 ? (
                  <span className="text-amber-400 font-bold">Action Required &rarr;</span>
                ) : (
                  'All requests cleared'
                )}
              </div>
            </div>

            {/* Active Trials */}
            <div
              onClick={() => setStatusFilter('TRIALING')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                statusFilter === 'TRIALING'
                  ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/40'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">Active Trials</span>
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20">
                  <Shield className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-cyan-400 mt-1">{stats.trialingOrgs}</div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium flex items-center justify-between">
                <span>Evaluation licenses</span>
                {stats.expiringTrials > 0 && (
                  <span className="text-amber-400 font-bold">{stats.expiringTrials} expiring</span>
                )}
              </div>
            </div>

            {/* Hardware Terminals */}
            <Link
              href="/superadmin/devices"
              className="p-4 bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 rounded-2xl group relative overflow-hidden transition-all"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider text-purple-400">Terminals</span>
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20">
                  <Monitor className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white mt-1">{stats.totalDevices}</div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                <span className="text-emerald-400 font-bold">{stats.activeDevices} active</span> •{' '}
                <span className="text-amber-400 font-bold">{stats.pendingDevices} pending</span>
              </div>
            </Link>

            {/* Estimated MRR */}
            <div
              onClick={() => setStatusFilter('ACTIVE')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden col-span-2 lg:col-span-1 ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/40'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">Monthly Revenue</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                Rs. {stats.estimatedMrr.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium">
                {stats.activeSubs} paid commercial subs
              </div>
            </div>

          </div>

          {/* ───────────────────────────────────────────────────────────────────
              QUICK ACTION TILES
              ─────────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/superadmin/subscriptions"
              className="flex items-center justify-between p-3.5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Subscription Queue</div>
                  <div className="text-[10px] text-slate-400">Approve &amp; verify plans</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </Link>

            <Link
              href="/superadmin/trials"
              className="flex items-center justify-between p-3.5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/40 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Trial Management</div>
                  <div className="text-[10px] text-slate-400">Extend &amp; convert trials</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            </Link>

            <Link
              href="/superadmin/devices"
              className="flex items-center justify-between p-3.5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/40 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20">
                  <Monitor className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Device Licenses</div>
                  <div className="text-[10px] text-slate-400">Terminal authorizations</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
            </Link>

            <Link
              href="/superadmin/audit"
              className="flex items-center justify-between p-3.5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Security Audit Log</div>
                  <div className="text-[10px] text-slate-400">Compliance &amp; history</div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </Link>
          </div>

          {/* ───────────────────────────────────────────────────────────────────
              CUSTOMER ORGANIZATIONS & SUBSCRIPTIONS MASTER TABLE
              ─────────────────────────────────────────────────────────────────── */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            
            {/* Table Header with Search & Filter Tabs */}
            <div className="p-5 border-b border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white">Customer Accounts &amp; Commercial Licenses</h2>
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full border border-slate-700">
                      {filteredRegistrations.length} of {registrations.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live database registry • Assign cashier credentials, extend trials, inspect terminals, and WhatsApp support
                  </p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search business, email, org ID…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9 pr-3 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 w-64 transition-all"
                  />
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
                {[
                  { id: 'ALL',       label: 'All Organizations', count: registrations.length },
                  { id: 'ACTIVE',    label: 'Active Paid',       count: stats.activeSubs },
                  { id: 'TRIALING',  label: 'Free Trials',       count: stats.trialingOrgs },
                  { id: 'EXPIRING',  label: 'Expiring Soon (≤3d)', count: stats.expiringTrials },
                  { id: 'PENDING',   label: 'Pending Review',    count: stats.pendingApprovals },
                  { id: 'SUSPENDED', label: 'Suspended',         count: stats.suspendedOrgs },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      statusFilter === tab.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] opacity-70">({tab.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-5 font-bold">Business &amp; Owner</th>
                    <th className="py-3 px-4 font-bold">Plan &amp; Billing</th>
                    <th className="py-3 px-4 font-bold">Account Status</th>
                    <th className="py-3 px-4 font-bold">Trial / Expiry</th>
                    <th className="py-3 px-4 font-bold">Registered</th>
                    <th className="py-3 px-5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {registrations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="h-14 w-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto text-amber-400">
                            <Building2 className="h-7 w-7 opacity-80" />
                          </div>
                          <div className="space-y-1">
                            <div className="text-base font-black text-white tracking-wide uppercase">NO CUSTOMERS YET</div>
                            <p className="text-xs text-slate-400">
                              Customers who register for the free trial will appear here.
                            </p>
                          </div>
                          <div className="pt-1">
                            <a
                              href="/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all"
                            >
                              <Globe className="h-3.5 w-3.5" />
                              <span>VIEW WEBSITE</span>
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 space-y-1">
                        <Building2 className="h-8 w-8 mx-auto text-slate-700" />
                        <div className="font-bold text-slate-400">No organizations match your filters</div>
                        <div className="text-[11px] text-slate-600">Try changing your search term or status filter</div>
                      </td>
                    </tr>
                  ) : (
                    filteredRegistrations.map((r) => {
                      const st = (r.status || 'REGISTERED').toUpperCase();
                      const isPending = st === 'SUBSCRIPTION_PENDING_APPROVAL' || st === 'PAYMENT_PENDING' || st === 'PAYMENT_RECEIVED';
                      const isTrial = st === 'TRIALING' || r.selected_plan_code === 'FREE_TRIAL';
                      const isActive = st === 'ACTIVE';
                      const isSuspended = st === 'SUSPENDED';

                      let remainingDays = 0;
                      if (r.trial_ends_at) {
                        remainingDays = Math.max(0, Math.ceil((new Date(r.trial_ends_at).getTime() - Date.now()) / 86400000));
                      }

                      let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
                      if (isActive) badgeClass = 'bg-emerald-950/90 text-emerald-400 border-emerald-800';
                      else if (isTrial) {
                        badgeClass = remainingDays <= 3
                          ? 'bg-amber-950/90 text-amber-400 border-amber-800 animate-pulse'
                          : 'bg-cyan-950/90 text-cyan-400 border-cyan-800';
                      } else if (isPending) badgeClass = 'bg-amber-950/90 text-amber-400 border-amber-800 animate-pulse';
                      else if (isSuspended) badgeClass = 'bg-red-950/90 text-red-400 border-red-800';

                      // Get initials for profile badge
                      const initial = (r.business_name || 'P').charAt(0).toUpperCase();

                      return (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition-colors group">
                          
                          {/* Business & Owner */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center font-black text-amber-400 text-sm shrink-0 shadow-md">
                                {initial}
                              </div>
                              <div className="space-y-0.5">
                                <div className="font-bold text-white text-xs group-hover:text-amber-400 transition-colors">
                                  {r.business_name}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {r.email} • {r.full_name}
                                </div>
                                <div className="text-[9px] font-mono text-slate-500">
                                  Org: {r.organization_id} {r.phone && `• ${r.phone}`}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Plan & Cycle */}
                          <td className="py-3.5 px-4">
                            <span className="font-black text-white text-xs block">{r.selected_plan_code}</span>
                            <div className="text-[10px] text-slate-400 capitalize">
                              {r.billing_cycle || 'monthly'}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider ${badgeClass}`}>
                              {st}
                            </span>
                          </td>

                          {/* Trial / Expiry */}
                          <td className="py-3.5 px-4 text-slate-300 text-xs">
                            {r.trial_ends_at ? (
                              <div className="space-y-0.5">
                                <span className="font-mono text-xs text-white">{new Date(r.trial_ends_at).toLocaleDateString()}</span>
                                {isTrial && (
                                  <div className={`text-[10px] font-bold ${
                                    remainingDays <= 3 ? 'text-amber-400' : 'text-cyan-400'
                                  }`}>
                                    {remainingDays}d remaining
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-emerald-400 font-mono text-xs">Continuous</span>
                            )}
                          </td>

                          {/* Registered */}
                          <td className="py-3.5 px-4 text-slate-400 text-xs font-mono">
                            {new Date(r.created_at).toLocaleDateString()}
                          </td>

                          {/* Action Buttons Toolbar */}
                          <td className="py-3.5 px-5 text-right space-x-1.5 whitespace-nowrap">
                            
                            {/* Activate / Assign Credentials */}
                            <button
                              onClick={() => openActivationModal(r)}
                              className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg text-[11px] transition-all inline-flex items-center gap-1 shadow-md shadow-emerald-950 cursor-pointer"
                              title="Assign Plan, Duration & Cashier Login Credentials"
                            >
                              <Key className="h-3 w-3" />
                              <span>Activate</span>
                            </button>

                            {/* Extend Trial */}
                            {isTrial && (
                              <button
                                onClick={() => {
                                  setSelectedOrgId(r.organization_id);
                                  setShowExtendModal(true);
                                }}
                                className="px-2.5 py-1.5 bg-cyan-900/60 hover:bg-cyan-800 text-cyan-300 border border-cyan-700/80 font-bold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Grant extra trial days"
                              >
                                <PlusCircle className="h-3 w-3" />
                                <span>Extend</span>
                              </button>
                            )}

                            {/* WhatsApp Direct Chat */}
                            <button
                              onClick={() => handleOpenWhatsApp(r)}
                              className="px-2 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/80 font-bold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Chat with merchant on WhatsApp"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </button>

                            {/* Official License Certificate */}
                            <button
                              onClick={() => {
                                setSelectedCustomer(r);
                                setShowCertificateModal(true);
                              }}
                              className="px-2 py-1.5 bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-800/80 font-bold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="View & Print Official License Certificate"
                            >
                              <Award className="h-3 w-3" />
                            </button>

                            {/* Hardware Terminals */}
                            <button
                              onClick={() => {
                                setSelectedCustomer(r);
                                setSelectedOrgId(r.organization_id);
                                setShowHardwareModal(true);
                              }}
                              className="px-2 py-1.5 bg-purple-950/60 hover:bg-purple-900 text-purple-300 border border-purple-800/80 font-bold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Manage Authorized POS Hardware Devices"
                            >
                              <Monitor className="h-3 w-3" />
                            </button>

                            {/* View Account Details */}
                            <button
                              onClick={() => {
                                setSelectedCustomer(r);
                                setShowDetailsModal(true);
                              }}
                              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-[11px] border border-slate-700 transition-colors cursor-pointer"
                              title="View Account Details"
                            >
                              <Eye className="h-3 w-3" />
                            </button>

                            {/* Suspend / Reactivate */}
                            {!isSuspended ? (
                              <button
                                onClick={() => {
                                  setSelectedOrgId(r.organization_id);
                                  setShowSuspendModal(true);
                                }}
                                className="px-2 py-1.5 bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 font-bold rounded-lg text-[11px] border border-slate-700 transition-colors cursor-pointer"
                                title="Suspend merchant access"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(r.organization_id)}
                                className="px-2.5 py-1.5 bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                                title="Reactivate merchant account"
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

          {/* ───────────────────────────────────────────────────────────────────
              BOTTOM ROW: AUDIT LOG FEED & RECENT REALTIME ALERTS
              ─────────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Recent Audit Activity */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Recent Audit Activity</h3>
                    <p className="text-[11px] text-slate-400">Security history and administrative event log</p>
                  </div>
                </div>
                <Link href="/superadmin/audit" className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1">
                  <span>View all</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No admin actions recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900/60 font-bold">
                          {log.action}
                        </span>
                        <span className="text-slate-300 font-medium truncate max-w-[150px]">{log.admin_email || 'Super Admin'}</span>
                        {log.target_org_id && (
                          <span className="text-slate-500 text-[10px] font-mono truncate max-w-[120px]">org: {log.target_org_id}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Realtime Notification Feed Widget */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-white">Live Notification Stream</h3>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <p className="text-[11px] text-slate-400">Real-time alerts for registrations, expirations, and payments</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowNotificationDrawer(true)}
                  className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage all ({unreadNotifCount} unread)</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {recentNotifications.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No alerts in stream.</p>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {recentNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => AdminNotificationService.markAsRead(notif.id)}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-800/30 px-2 rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${notif.read ? 'bg-slate-600' : 'bg-amber-400'}`} />
                        <div className="min-w-0">
                          <span className="font-bold text-white truncate block text-[11px]">{notif.title}</span>
                          <span className="text-slate-400 text-[10px] truncate block">{notif.message}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap shrink-0">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </main>

        {/* ───────────────────────────────────────────────────────────────────
            SLIDE-OVER DRAWER: REALTIME NOTIFICATION MANAGER
            ─────────────────────────────────────────────────────────────────── */}
        <RealtimeNotificationManager
          isOpen={showNotificationDrawer}
          onClose={() => setShowNotificationDrawer(false)}
          onQuickActivate={(orgId) => {
            const row = registrations.find((r) => r.organization_id === orgId);
            if (row) {
              setShowNotificationDrawer(false);
              openActivationModal(row);
            }
          }}
          onQuickExtend={handleQuickExtendOrg}
          onOpenWhatsApp={(name, orgId) => handleOpenWhatsApp(name, orgId)}
        />

        {/* ───────────────────────────────────────────────────────────────────
            MODAL: LICENSE CERTIFICATE VIEWER & PRINTER
            ─────────────────────────────────────────────────────────────────── */}
        {showCertificateModal && selectedCustomer && (
          <LicenseCertificateModal
            customer={selectedCustomer}
            onClose={() => setShowCertificateModal(false)}
          />
        )}

        {/* ───────────────────────────────────────────────────────────────────
            MODAL: HARDWARE POS DEVICES & TERMINALS
            ─────────────────────────────────────────────────────────────────── */}
        {showHardwareModal && selectedCustomer && (
          <HardwareDevicesModal
            organizationId={selectedCustomer.organization_id}
            businessName={selectedCustomer.business_name}
            onClose={() => setShowHardwareModal(false)}
          />
        )}

        {/* ───────────────────────────────────────────────────────────────────
            MODAL: ACTIVATE PAID ACCOUNT & ASSIGN CASHIER CREDENTIALS
            ─────────────────────────────────────────────────────────────────── */}
        {showActivateModal && selectedCustomer && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-5 shadow-2xl">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Activate &amp; Assign Credentials</h3>
                    <p className="text-xs text-slate-400">{selectedCustomer.business_name}</p>
                  </div>
                </div>
                <button onClick={() => setShowActivateModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">
                  ✕
                </button>
              </div>

              {activationSuccessMsg ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-950/80 border border-emerald-500/60 rounded-2xl space-y-2 text-xs text-emerald-200">
                    <div className="font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Account Activated Successfully!</span>
                    </div>
                    <p>Credentials dispatched and active on POS terminal. You can now copy the WhatsApp activation message below:</p>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-slate-400">WhatsApp Dispatch Message</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activationSuccessMsg);
                          alert('Activation message copied to clipboard!');
                        }}
                        className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copy Message</span>
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900 p-3 rounded-xl border border-slate-800">
                      {activationSuccessMsg}
                    </pre>
                  </div>

                  <button
                    onClick={() => {
                      setShowActivateModal(false);
                      setActivationSuccessMsg(null);
                    }}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Done &amp; Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  
                  {/* Select Plan */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300">Select Paid Plan</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE'] as const).map((plan) => (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => setActivationPlan(plan)}
                          className={`h-9 rounded-xl font-bold text-[11px] border transition-all ${
                            activationPlan === plan
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {plan}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300">Duration (Months)</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 3, 6, 12].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleDurationChange(m)}
                          className={`h-9 rounded-xl font-bold text-[11px] border transition-all ${
                            activationDurationMonths === m
                              ? 'bg-amber-600 border-amber-500 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {m === 12 ? '1 Year' : `${m} Month${m > 1 ? 's' : ''}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 text-[11px]">Start Date</label>
                      <input
                        type="date"
                        value={activationStartDate}
                        onChange={(e) => setActivationStartDate(e.target.value)}
                        className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 text-[11px]">Expiry Date</label>
                      <input
                        type="date"
                        value={activationExpiryDate}
                        onChange={(e) => setActivationExpiryDate(e.target.value)}
                        className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Credentials Assignment */}
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                    <div className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-amber-400" />
                      <span>Assign Merchant POS Credentials</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[11px]">Assigned Login Username</label>
                      <input
                        type="text"
                        value={assignedUsername}
                        onChange={(e) => setAssignedUsername(e.target.value)}
                        className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[11px]">Assigned Initial Password</label>
                      <input
                        type="text"
                        value={assignedPassword}
                        onChange={(e) => setAssignedPassword(e.target.value)}
                        className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[11px]">Bank Slip / Transfer Ref Number</label>
                      <input
                        type="text"
                        value={bankReference}
                        onChange={(e) => setBankReference(e.target.value)}
                        placeholder="e.g. TXN-849204"
                        className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => setShowActivateModal(false)}
                      className="flex-1 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmActivation}
                      className="flex-1 h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 cursor-pointer"
                    >
                      Confirm &amp; Activate License
                    </button>
                  </div>

                </div>
              )}

            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────
            MODAL: EXTEND TRIAL
            ─────────────────────────────────────────────────────────────────── */}
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
                  className="flex-1 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtendSubmit}
                  className="flex-1 h-9 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                >
                  Confirm Extension
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────
            MODAL: SUSPEND ORGANIZATION
            ─────────────────────────────────────────────────────────────────── */}
        {showSuspendModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-900/60 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-500" /> Suspend Organization
              </h3>
              <p className="text-xs text-slate-400">
                Suspending an organization immediately blocks all terminal access for its cashier and admin users.
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
                  className="flex-1 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuspendSubmit}
                  className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                >
                  Suspend Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────
            MODAL: CUSTOMER DETAILS INSPECTOR
            ─────────────────────────────────────────────────────────────────── */}
        {showDetailsModal && selectedCustomer && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-white">{selectedCustomer.business_name}</h3>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Organization ID</span>
                  <span className="font-mono text-emerald-400 font-bold">{selectedCustomer.organization_id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Contact Owner</span>
                  <span className="font-bold text-white">{selectedCustomer.full_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-300">{selectedCustomer.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Phone</span>
                  <span className="text-slate-300">{selectedCustomer.phone || 'Not provided'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Country</span>
                  <span className="text-slate-300">{selectedCustomer.country || 'Sri Lanka'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Active Plan</span>
                  <span className="font-bold text-amber-400">{selectedCustomer.selected_plan_code}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Status</span>
                  <span className="font-black text-emerald-400">{selectedCustomer.status}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Registered On</span>
                  <span className="font-mono text-slate-400">{new Date(selectedCustomer.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="w-full h-9 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminAuthGuard>
  );
}
