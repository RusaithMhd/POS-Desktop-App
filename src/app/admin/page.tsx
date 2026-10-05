'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Monitor, Users, CreditCard, CheckCircle2, XCircle,
  AlertTriangle, Clock, RefreshCw, Ban, Trash2, Building2,
  ChevronRight, Activity, TrendingUp, Package, Hash, Globe,
  Eye, EyeOff, Crown, Loader2, AlertCircle, CheckCheck,
  ToggleLeft, ToggleRight, Settings, LogOut, Zap
} from 'lucide-react';
import { getRawSqlDb, getLocalDb } from '@/infrastructure/database/sqlite/db';
import { DeviceLicenseService, DeviceLicense, DeviceRegistrationRequest, getOrCreateDeviceFingerprint } from '@/services/licensing/DeviceLicenseService';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE HELPER
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    ACTIVE:           { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Active' },
    PENDING_APPROVAL: { cls: 'bg-blue-100 text-blue-800 border-blue-200',         label: 'Pending' },
    SUSPENDED:        { cls: 'bg-amber-100 text-amber-800 border-amber-200',       label: 'Suspended' },
    REVOKED:          { cls: 'bg-red-100 text-red-800 border-red-200',             label: 'Revoked' },
    EXPIRED:          { cls: 'bg-slate-100 text-slate-600 border-slate-200',       label: 'Expired' },
    PENDING:          { cls: 'bg-blue-100 text-blue-800 border-blue-200',          label: 'Pending' },
    APPROVED:         { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Approved' },
    REJECTED:         { cls: 'bg-red-100 text-red-800 border-red-200',             label: 'Rejected' },
    TRIALING:         { cls: 'bg-purple-100 text-purple-800 border-purple-200',    label: 'Trial' },
    PAST_DUE:         { cls: 'bg-amber-100 text-amber-800 border-amber-200',       label: 'Past Due' },
    CANCELLED:        { cls: 'bg-slate-100 text-slate-600 border-slate-200',       label: 'Cancelled' },
    GRACE_PERIOD:     { cls: 'bg-orange-100 text-orange-800 border-orange-200',    label: 'Grace' },
  };
  const c = cfg[status] ?? { cls: 'bg-slate-100 text-slate-600 border-slate-200', label: status };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${c.cls}`}>{c.label}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border bg-white p-4 space-y-2 shadow-xs hover:shadow-sm transition-shadow`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        {sub && <span className="text-[10px] text-slate-400 font-semibold">{sub}</span>}
      </div>
      <div>
        <div className="text-2xl font-black text-slate-900">{value}</div>
        <div className="text-xs text-slate-500 font-medium">{label}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm font-bold text-slate-900">{message}</p>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional: reason for this action…"
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 h-9 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onConfirm(reason)} className="flex-1 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  return (
    <PermissionGuard permission={['settings.manage', 'admin.superadmin']} moduleName="Super Admin Dashboard">
      <SuperAdminContent />
    </PermissionGuard>
  );
}

type Tab = 'overview' | 'devices' | 'requests' | 'subscriptions' | 'audit';

function SuperAdminContent() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Data
  const [deviceStats, setDeviceStats] = useState({ totalActive: 0, totalPending: 0, totalSuspended: 0, totalRevoked: 0, byOrg: [] as any[] });
  const [allDevices, setAllDevices] = useState<DeviceLicense[]>([]);
  const [pendingRequests, setPendingRequests] = useState<DeviceRegistrationRequest[]>([]);
  const [allRequests, setAllRequests] = useState<DeviceRegistrationRequest[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [currentDeviceFp, setCurrentDeviceFp] = useState('');

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: (reason: string) => void } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const svc = new DeviceLicenseService(raw);

      setDeviceStats(svc.getDeviceStats());
      setAllDevices(svc.listAllDevices());
      setPendingRequests(svc.listPendingRequests());
      setAllRequests(svc.listAllRequests());
      setCurrentDeviceFp(getOrCreateDeviceFingerprint());

      // Load subscriptions with org + plan info
      const subStmt = raw.prepare(`
        SELECT s.id, s.status, s.billing_cycle, s.current_period_start, s.current_period_end,
               s.trial_ends_at, s.grace_period_ends_at, s.cancel_at_period_end,
               o.name as org_name, o.id as org_id,
               p.name as plan_name, p.max_devices, p.max_users, p.monthly_price
        FROM subscriptions s
        JOIN organizations o ON o.id = s.organization_id
        JOIN subscription_plans p ON p.id = s.plan_id
        ORDER BY s.created_at DESC
      `);
      const subs: any[] = [];
      while (subStmt.step()) subs.push(subStmt.getAsObject());
      subStmt.free();
      setSubscriptions(subs);

      // Load recent audit logs (device-related)
      const auditStmt = raw.prepare(`
        SELECT id, timestamp, action, entity_type, entity_id, reason, user_name, created_at
        FROM audit_logs
        WHERE entity_type = 'DEVICE_LICENSE' OR action LIKE 'DEVICE_%'
        ORDER BY created_at DESC
        LIMIT 50
      `);
      const logs: any[] = [];
      while (auditStmt.step()) logs.push(auditStmt.getAsObject());
      auditStmt.free();
      setAuditLogs(logs);
    } catch (err) {
      console.error('Super admin data load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── ACTIONS ──

  const approveDevice = (device: DeviceLicense) => {
    const raw = getRawSqlDb();
    const svc = new DeviceLicenseService(raw);
    const ok = svc.approveDevice(device.id, 'super-admin');
    if (ok) { showToast('success', `✓ Device "${device.deviceName}" approved.`); loadData(); }
    else showToast('error', 'Approval failed. Check logs.');
  };

  const suspendDevice = (device: DeviceLicense) => {
    setConfirmDialog({
      message: `Suspend device "${device.deviceName}"? Users on this device will be blocked immediately.`,
      onConfirm: (reason) => {
        setConfirmDialog(null);
        const raw = getRawSqlDb();
        const svc = new DeviceLicenseService(raw);
        svc.suspendDevice(device.id, reason || 'Suspended by admin', 'super-admin');
        showToast('success', `Device "${device.deviceName}" suspended.`);
        loadData();
      },
    });
  };

  const revokeDevice = (device: DeviceLicense) => {
    setConfirmDialog({
      message: `Permanently REVOKE device "${device.deviceName}"? This cannot be undone without re-registration.`,
      onConfirm: (reason) => {
        setConfirmDialog(null);
        const raw = getRawSqlDb();
        const svc = new DeviceLicenseService(raw);
        svc.revokeDevice(device.id, reason || 'Revoked by admin', 'super-admin');
        showToast('success', `Device "${device.deviceName}" revoked.`);
        loadData();
      },
    });
  };

  const reactivateDevice = (device: DeviceLicense) => {
    const raw = getRawSqlDb();
    const svc = new DeviceLicenseService(raw);
    svc.approveDevice(device.id, 'super-admin');
    showToast('success', `Device "${device.deviceName}" reactivated.`);
    loadData();
  };

  const TABS: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: 'overview',       label: 'Overview',      icon: Activity },
    { id: 'devices',        label: 'Devices',        icon: Monitor,   badge: deviceStats.totalActive },
    { id: 'requests',       label: 'Requests',       icon: Clock,     badge: pendingRequests.length },
    { id: 'subscriptions',  label: 'Subscriptions',  icon: CreditCard },
    { id: 'audit',          label: 'Audit Log',      icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-xl">
              <Crown className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900">Super Admin Console</h1>
              <p className="text-[11px] text-slate-500">Device Licensing · Subscriptions · Access Control</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pendingRequests.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-700 animate-pulse">
                <AlertCircle className="h-3.5 w-3.5" />
                {pendingRequests.length} pending approval{pendingRequests.length !== 1 ? 's' : ''}
              </div>
            )}
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold animate-in slide-in-from-right duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
          {toast.msg}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-xs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white text-slate-900' : 'bg-red-500 text-white'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* ─── OVERVIEW TAB ─── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stat Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={Monitor}        label="Active Devices"    value={deviceStats.totalActive}    color="bg-emerald-600" />
                  <StatCard icon={Clock}           label="Pending Approvals" value={deviceStats.totalPending}   color="bg-blue-600"    sub={deviceStats.totalPending > 0 ? 'ACTION NEEDED' : undefined} />
                  <StatCard icon={Ban}             label="Suspended"         value={deviceStats.totalSuspended} color="bg-amber-500" />
                  <StatCard icon={XCircle}         label="Revoked"           value={deviceStats.totalRevoked}   color="bg-red-600" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pending Requests Quick View */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" /> Pending Device Requests
                      </h3>
                      <button onClick={() => setActiveTab('requests')} className="text-xs text-blue-600 font-bold hover:underline">View All</button>
                    </div>
                    {pendingRequests.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 text-xs font-semibold">
                        <CheckCheck className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                        All caught up — no pending requests
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {pendingRequests.slice(0, 5).map((req) => (
                          <div key={req.id} className="flex items-center justify-between px-5 py-3">
                            <div>
                              <div className="text-xs font-bold text-slate-800">{req.deviceName}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{req.deviceFingerprint.slice(0, 16)}…</div>
                            </div>
                            <button
                              onClick={() => {
                                const lic = allDevices.find((d) => d.deviceFingerprint === req.deviceFingerprint);
                                if (lic) approveDevice(lic);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Approve
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Per-Org Device Usage */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" /> Device Quota by Organization
                      </h3>
                    </div>
                    {deviceStats.byOrg.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 text-xs">No organizations found</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {deviceStats.byOrg.map((org) => (
                          <div key={org.orgId} className="px-5 py-3 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                              <span>{org.orgName}</span>
                              <span className={org.active >= org.maxAllowed ? 'text-red-600' : 'text-emerald-600'}>
                                {org.active} / {org.maxAllowed}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${org.active >= org.maxAllowed ? 'bg-red-500' : org.active / org.maxAllowed > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, (org.active / Math.max(1, org.maxAllowed)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── DEVICES TAB ─── */}
            {activeTab === 'devices' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-slate-500" /> All Registered Devices
                    <span className="text-slate-400 font-normal">({allDevices.length})</span>
                  </h3>
                </div>

                {allDevices.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs font-semibold">No devices registered yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {allDevices.map((device) => {
                      const isThisDevice = device.deviceFingerprint === currentDeviceFp;
                      return (
                        <div key={device.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${isThisDevice ? 'bg-emerald-50/50' : ''}`}>
                          <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                            device.status === 'ACTIVE'           ? 'bg-emerald-100' :
                            device.status === 'PENDING_APPROVAL' ? 'bg-blue-100' :
                            device.status === 'SUSPENDED'        ? 'bg-amber-100' : 'bg-red-100'
                          }`}>
                            <Monitor className={`h-4 w-4 ${
                              device.status === 'ACTIVE'           ? 'text-emerald-600' :
                              device.status === 'PENDING_APPROVAL' ? 'text-blue-600' :
                              device.status === 'SUSPENDED'        ? 'text-amber-600' : 'text-red-600'
                            }`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900">{device.deviceName}</span>
                              <StatusBadge status={device.status} />
                              {isThisDevice && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">This Device</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">{device.deviceFingerprint.slice(0, 20)}…</span>
                              <span className="text-[11px] text-slate-400">{device.deviceType.replace('_', ' ')}</span>
                              {device.hostname && <span className="text-[11px] text-slate-400">{device.hostname}</span>}
                            </div>
                            {device.lastSeenAt && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Last seen: {new Date(device.lastSeenAt).toLocaleString()}
                              </div>
                            )}
                            {device.suspendedReason && (
                              <div className="text-[10px] text-amber-600 mt-0.5 font-semibold">Reason: {device.suspendedReason}</div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {device.status === 'PENDING_APPROVAL' && (
                              <button
                                onClick={() => approveDevice(device)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Approve
                              </button>
                            )}
                            {(device.status === 'SUSPENDED' || device.status === 'REVOKED') && (
                              <button
                                onClick={() => reactivateDevice(device)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                              >
                                <ToggleRight className="h-3 w-3" /> Reactivate
                              </button>
                            )}
                            {device.status === 'ACTIVE' && !isThisDevice && (
                              <button
                                onClick={() => suspendDevice(device)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-colors"
                              >
                                <ToggleLeft className="h-3 w-3" /> Suspend
                              </button>
                            )}
                            {device.status !== 'REVOKED' && !isThisDevice && (
                              <button
                                onClick={() => revokeDevice(device)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                              >
                                <Ban className="h-3 w-3" /> Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ─── REQUESTS TAB ─── */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
                {/* Pending Banner */}
                {pendingRequests.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-bold text-blue-900">{pendingRequests.length} device{pendingRequests.length !== 1 ? 's' : ''} awaiting approval</p>
                        <p className="text-xs text-blue-600">Users on these devices are blocked from logging in until approved.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        pendingRequests.forEach((req) => {
                          const lic = allDevices.find((d) => d.deviceFingerprint === req.deviceFingerprint);
                          if (lic && lic.status === 'PENDING_APPROVAL') approveDevice(lic);
                        });
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      <CheckCheck className="h-4 w-4" /> Approve All Pending
                    </button>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900">Registration Request History</h3>
                  </div>
                  {allRequests.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-xs">No registration requests yet.</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="text-left px-5 py-3 font-bold text-slate-600">Device Name</th>
                          <th className="text-left px-5 py-3 font-bold text-slate-600">Fingerprint</th>
                          <th className="text-left px-5 py-3 font-bold text-slate-600">Requested By</th>
                          <th className="text-left px-5 py-3 font-bold text-slate-600">Status</th>
                          <th className="text-left px-5 py-3 font-bold text-slate-600">Date</th>
                          <th className="text-left px-5 py-3 font-bold text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allRequests.map((req) => {
                          const lic = allDevices.find((d) => d.deviceFingerprint === req.deviceFingerprint);
                          return (
                            <tr key={req.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3 font-bold text-slate-800">{req.deviceName}</td>
                              <td className="px-5 py-3 font-mono text-slate-400">{req.deviceFingerprint.slice(0, 14)}…</td>
                              <td className="px-5 py-3 text-slate-600">{req.requestedBy}</td>
                              <td className="px-5 py-3"><StatusBadge status={req.status} /></td>
                              <td className="px-5 py-3 text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</td>
                              <td className="px-5 py-3">
                                {req.status === 'PENDING' && lic && (
                                  <div className="flex gap-1.5">
                                    <button onClick={() => approveDevice(lic)} className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700">Approve</button>
                                    <button onClick={() => suspendDevice(lic)} className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700">Reject</button>
                                  </div>
                                )}
                                {req.status !== 'PENDING' && (
                                  <span className="text-slate-400 font-semibold">
                                    {req.reviewedBy ? `By ${req.reviewedBy}` : 'System'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ─── SUBSCRIPTIONS TAB ─── */}
            {activeTab === 'subscriptions' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-slate-500" /> Active Subscriptions
                  </h3>
                </div>
                {subscriptions.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs">No subscriptions found.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {subscriptions.map((sub) => (
                      <div key={sub.id} className="px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              <Building2 className="h-4 w-4 text-slate-600" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900">{sub.org_name}</div>
                              <div className="text-xs text-slate-500">{sub.plan_name} · {sub.billing_cycle}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={sub.status} />
                            <span className="text-xs font-bold text-slate-700">
                              LKR {Number(sub.monthly_price || 0).toLocaleString()}/mo
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-[11px]">
                          <div className="bg-slate-50 rounded-lg p-2.5">
                            <div className="text-slate-400 font-semibold">Period Ends</div>
                            <div className="font-bold text-slate-800 mt-0.5">
                              {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2.5">
                            <div className="text-slate-400 font-semibold">Max Devices</div>
                            <div className="font-bold text-slate-800 mt-0.5">{sub.max_devices}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2.5">
                            <div className="text-slate-400 font-semibold">Max Users</div>
                            <div className="font-bold text-slate-800 mt-0.5">{sub.max_users}</div>
                          </div>
                        </div>
                        {sub.trial_ends_at && sub.status === 'TRIALING' && (
                          <div className="text-[11px] text-purple-600 font-semibold bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                            Trial ends: {new Date(sub.trial_ends_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── AUDIT LOG TAB ─── */}
            {activeTab === 'audit' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-500" /> Device License Audit Log
                  </h3>
                </div>
                {auditLogs.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs">No device audit logs found.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-5 py-3 font-bold text-slate-600">Timestamp</th>
                        <th className="text-left px-5 py-3 font-bold text-slate-600">Action</th>
                        <th className="text-left px-5 py-3 font-bold text-slate-600">Performed By</th>
                        <th className="text-left px-5 py-3 font-bold text-slate-600">Entity ID</th>
                        <th className="text-left px-5 py-3 font-bold text-slate-600">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 text-slate-500 font-mono">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`font-bold ${
                              log.action?.includes('APPROVED')  ? 'text-emerald-700' :
                              log.action?.includes('SUSPENDED') ? 'text-amber-700' :
                              log.action?.includes('REVOKED')   ? 'text-red-700' : 'text-slate-700'
                            }`}>{log.action}</span>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{log.user_name || '—'}</td>
                          <td className="px-5 py-3 font-mono text-slate-400 text-[10px]">{(log.entity_id || '').slice(0, 20)}…</td>
                          <td className="px-5 py-3 text-slate-500 italic">{log.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
