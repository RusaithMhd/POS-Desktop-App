'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Monitor, Laptop, Smartphone, Terminal, Shield, Check, X,
  Trash2, PlusCircle, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';
import { DeviceLicenseService, DeviceLicense, collectDeviceInfo, getOrCreateDeviceFingerprint } from '@/services/licensing/DeviceLicenseService';
import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';

export default function CustomerDevicesPage() {
  const [devices, setDevices] = useState<DeviceLicense[]>([]);
  const [currentFp, setCurrentFp] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [maxAllowed, setMaxAllowed] = useState<number>(2);
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const svc = new DeviceLicenseService(raw);

      const orgId = svc.ensureDefaultOrgAndSubscription();
      setOrganizationId(orgId);

      const fp = getOrCreateDeviceFingerprint();
      setCurrentFp(fp);

      const list = svc.listDevicesForOrg(orgId);
      setDevices(list);

      // Get plan max devices
      try {
        const pStmt = raw.prepare(`
          SELECT p.max_devices
          FROM subscriptions s
          LEFT JOIN subscription_plans p ON p.id = s.plan_id
          WHERE s.organization_id = :orgId LIMIT 1
        `);
        pStmt.bind({ ':orgId': orgId });
        if (pStmt.step()) {
          setMaxAllowed((pStmt.getAsObject().max_devices as number) || 2);
        }
        pStmt.free();
      } catch { /* subscription */ }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeregister = (devId: string) => {
    if (!confirm('Are you sure you want to deregister this device? It will lose access to the POS terminal.')) return;
    try {
      const raw = getRawSqlDb();
      const svc = new DeviceLicenseService(raw);
      svc.revokeDevice(devId, 'Deregistered by customer owner', 'CUSTOMER_OWNER');
      saveLocalDbState();
      setActionNotice('Device deregistered successfully. A license slot has been freed.');
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const activeCount = devices.filter((d) => d.status === 'ACTIVE').length;

  const getDeviceIcon = (type: string) => {
    if (type === 'MOBILE') return <Smartphone className="h-5 w-5 text-cyan-400" />;
    if (type === 'ADMIN_WORKSTATION') return <Laptop className="h-5 w-5 text-purple-400" />;
    return <Terminal className="h-5 w-5 text-emerald-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
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
              <h1 className="text-sm font-black text-white">Hardware Terminal Licenses</h1>
              <p className="text-[11px] text-slate-400">Manage registered POS registers, billing terminals, and workstations</p>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
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
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Subscription & Billing
          </Link>
          <Link
            href="/account/devices"
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          >
            Hardware Devices ({activeCount})
          </Link>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 pt-6 space-y-6">
        {actionNotice && (
          <div className="p-4 bg-emerald-950/80 border border-emerald-600/50 rounded-xl text-emerald-300 text-sm font-bold flex items-center gap-2 shadow-lg">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Device Capacity Meter */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-white">Hardware Terminal Capacity</h2>
              <p className="text-xs text-slate-400">
                Your current plan permits <strong className="text-white">{maxAllowed}</strong> simultaneous POS registers.
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-400">{activeCount}</span>
              <span className="text-sm font-bold text-slate-400"> / {maxAllowed} terminals active</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                activeCount >= maxAllowed ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (activeCount / maxAllowed) * 100)}%` }}
            />
          </div>

          {activeCount >= maxAllowed && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5 pt-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Terminal limit reached. To add more cash registers,{' '}
              <Link href="/account/subscription" className="underline font-bold">
                upgrade your plan
              </Link>{' '}
              or deregister an unused terminal.
            </p>
          )}
        </div>

        {/* Devices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((dev) => {
            const isThisDevice = dev.deviceFingerprint === currentFp;
            const isActive = dev.status === 'ACTIVE';

            return (
              <div
                key={dev.id}
                className={`bg-slate-900/90 rounded-2xl p-5 border shadow-xl flex flex-col justify-between space-y-4 transition-all ${
                  isThisDevice
                    ? 'border-emerald-500/80 ring-1 ring-emerald-500/50'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                        {getDeviceIcon(dev.deviceType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{dev.deviceName}</h3>
                          {isThisDevice && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-extrabold px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                              This Device
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{dev.deviceType}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isActive
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : 'bg-red-950 text-red-400 border-red-800'
                      }`}
                    >
                      {dev.status}
                    </span>
                  </div>

                  <div className="mt-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Platform / OS</span>
                      <span className="text-slate-200">{dev.osInfo || 'Browser/Desktop'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Registered On</span>
                      <span className="text-slate-200">{new Date(dev.registeredAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 font-mono text-[10px]">
                      <span>Fingerprint</span>
                      <span className="text-slate-500">{dev.deviceFingerprint.slice(0, 12)}…</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {isThisDevice ? 'Current Active Register' : 'Remote Terminal'}
                  </span>

                  {isActive && !isThisDevice && (
                    <button
                      onClick={() => handleDeregister(dev.id)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 text-xs font-bold rounded-lg border border-slate-700 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Deregister
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
