'use client';

import React, { useState, useEffect } from 'react';
import {
  Monitor, Shield, Check, X, Ban, RefreshCw, Search,
  CheckCircle2, AlertTriangle, Clock, Laptop, Smartphone, Terminal
} from 'lucide-react';
import { AdminAuthGuard, AdminHeader } from '@/components/auth/AdminAuthGuard';
import { AdminAuthService } from '@/services/auth/AdminAuthService';
import { DeviceLicenseService, DeviceLicense, DeviceRegistrationRequest } from '@/services/licensing/DeviceLicenseService';
import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';

export default function DevicesManagementPage() {
  const [devices, setDevices] = useState<DeviceLicense[]>([]);
  const [pendingRequests, setPendingRequests] = useState<DeviceRegistrationRequest[]>([]);
  const [stats, setStats] = useState<any>({ totalActive: 0, totalPending: 0, totalSuspended: 0, totalRevoked: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const svc = new DeviceLicenseService(raw);

      const allDevs = svc.listAllDevices();
      const reqs = svc.listPendingRequests();
      const st = svc.getDeviceStats();

      setDevices(allDevs);
      setPendingRequests(reqs);
      setStats(st);
    } catch (e) {
      console.error('Failed to load device licensing data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = (devId: string) => {
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.email || 'superadmin';
    const raw = getRawSqlDb();
    const svc = new DeviceLicenseService(raw);
    const ok = svc.approveDevice(devId, adminId);
    if (ok) {
      saveLocalDbState();
      setActionNotice('Device authorized and activated.');
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
    }
  };

  const handleSuspend = (devId: string) => {
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.email || 'superadmin';
    const raw = getRawSqlDb();
    const svc = new DeviceLicenseService(raw);
    const ok = svc.suspendDevice(devId, 'Suspended by Super Admin', adminId);
    if (ok) {
      saveLocalDbState();
      setActionNotice('Device suspended.');
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
    }
  };

  const handleRevoke = (devId: string) => {
    const adminSession = AdminAuthService.getActiveSession();
    const adminId = adminSession?.email || 'superadmin';
    const raw = getRawSqlDb();
    const svc = new DeviceLicenseService(raw);
    const ok = svc.revokeDevice(devId, 'Permanent revocation by Super Admin', adminId);
    if (ok) {
      saveLocalDbState();
      setActionNotice('Device license revoked.');
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
    }
  };

  const filteredDevices = devices.filter((d) => {
    const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      (d.deviceName || '').toLowerCase().includes(q) ||
      (d.organizationId || '').toLowerCase().includes(q) ||
      (d.deviceFingerprint || '').toLowerCase().includes(q) ||
      (d.osInfo || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const getDeviceIcon = (type: string) => {
    if (type === 'MOBILE') return <Smartphone className="h-4 w-4 text-cyan-400" />;
    if (type === 'ADMIN_WORKSTATION') return <Laptop className="h-4 w-4 text-purple-400" />;
    return <Terminal className="h-4 w-4 text-amber-400" />;
  };

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
        <AdminHeader
          title="Device License & Hardware Authorization"
          subtitle="Enforce device boundaries per subscription tier, approve POS hardware terminals, and revoke compromised devices"
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

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Active Devices</span>
              <div className="text-2xl font-black text-emerald-400">{stats.totalActive}</div>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Pending Authorization</span>
              <div className="text-2xl font-black text-amber-400">{pendingRequests.length}</div>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Suspended</span>
              <div className="text-2xl font-black text-red-400">{stats.totalSuspended}</div>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Revoked</span>
              <div className="text-2xl font-black text-slate-400">{stats.totalRevoked}</div>
            </div>
          </div>

          {/* Pending Device Requests Section */}
          {pendingRequests.length > 0 && (
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-black text-white">
                  Pending Hardware Authorizations ({pendingRequests.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(req.deviceType)}
                        <span className="font-bold text-white text-xs truncate">{req.deviceName}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        Org: {req.organizationId} • By: {req.requestedBy}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">
                        FP: {req.deviceFingerprint.slice(0, 16)}…
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          const matched = devices.find((d) => d.deviceFingerprint === req.deviceFingerprint);
                          if (matched) handleApprove(matched.id);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <Check className="h-3.5 w-3.5" /> Authorize
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              {['ALL', 'ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'REVOKED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === st
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
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
                placeholder="Search device name, org, OS…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          {/* Devices Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-5 font-bold">Device Name & Type</th>
                    <th className="py-3 px-4 font-bold">Organization</th>
                    <th className="py-3 px-4 font-bold">Hardware Fingerprint</th>
                    <th className="py-3 px-4 font-bold">OS / Platform</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold">Registered</th>
                    <th className="py-3 px-5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDevices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No registered devices found.
                      </td>
                    </tr>
                  ) : (
                    filteredDevices.map((d) => {
                      const isActive = d.status === 'ACTIVE';
                      const isPending = d.status === 'PENDING_APPROVAL';
                      const isSuspended = d.status === 'SUSPENDED';

                      return (
                        <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-5 font-bold text-white">
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(d.deviceType)}
                              <span>{d.deviceName}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{d.deviceType}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            {d.organizationId}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                            {d.deviceFingerprint ? `${d.deviceFingerprint.slice(0, 14)}…` : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 text-xs">
                            {d.osInfo || 'Browser/Desktop'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${
                                isActive
                                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                  : isPending
                                  ? 'bg-amber-950 text-amber-400 border-amber-800'
                                  : isSuspended
                                  ? 'bg-red-950 text-red-400 border-red-800'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-xs">
                            {new Date(d.registeredAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-5 text-right space-x-1.5 whitespace-nowrap">
                            {!isActive ? (
                              <button
                                onClick={() => handleApprove(d.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] transition-colors"
                              >
                                Authorize
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSuspend(d.id)}
                                className="px-2 py-1 bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 font-bold rounded-lg text-[11px] border border-slate-700 transition-colors"
                              >
                                Suspend
                              </button>
                            )}

                            {d.status !== 'REVOKED' && (
                              <button
                                onClick={() => handleRevoke(d.id)}
                                className="px-2 py-1 bg-red-950/60 hover:bg-red-900 text-red-400 font-bold rounded-lg text-[11px] border border-red-900 transition-colors"
                              >
                                Revoke
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
        </main>
      </div>
    </AdminAuthGuard>
  );
}
