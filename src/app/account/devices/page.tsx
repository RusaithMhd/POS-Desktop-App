'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Monitor, Laptop, Smartphone, Terminal, Shield, Check, X,
  Trash2, PlusCircle, RefreshCw, CheckCircle2, AlertCircle,
  Building2, CreditCard
} from 'lucide-react';
import { DeviceLicenseService, DeviceLicense, collectDeviceInfo, getOrCreateDeviceFingerprint } from '@/services/licensing/DeviceLicenseService';
import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
    if (type === 'MOBILE') return <Smartphone className="h-5 w-5 text-blue-600" />;
    if (type === 'ADMIN_WORKSTATION') return <Laptop className="h-5 w-5 text-purple-600" />;
    return <Terminal className="h-5 w-5 text-emerald-600" />;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-900 select-none">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Monitor className="h-6 w-6 text-emerald-600" /> Hardware Terminal Licenses
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage registered POS registers, billing stations, and workstation computer fingerprints
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={loadData} variant="outline" size="sm" className="gap-1.5 text-xs font-bold border-slate-300 hover:bg-slate-100">
            <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Devices
          </Button>
        </div>
      </div>

      {/* 2. SUB-NAV TABS */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-bold">
        {[
          { href: '/account', label: 'Overview', icon: Building2, active: false },
          { href: '/account/subscription', label: 'Subscription & Billing', icon: CreditCard, active: false },
          { href: '/account/devices', label: `Hardware Devices (${activeCount})`, icon: Monitor, active: true },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg transition-colors cursor-pointer whitespace-nowrap ${
                t.active
                  ? 'bg-slate-900 text-white font-extrabold shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 ${t.active ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>

      {actionNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 3. DEVICE CAPACITY METER */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900">Hardware Terminal Capacity</h2>
            <p className="text-xs text-slate-500">
              Your active plan permits <strong className="text-slate-800">{maxAllowed}</strong> simultaneous POS register terminals.
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-600">{activeCount}</span>
            <span className="text-xs font-bold text-slate-500"> / {maxAllowed} terminals active</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              activeCount >= maxAllowed ? 'bg-amber-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${Math.min(100, (activeCount / maxAllowed) * 100)}%` }}
          />
        </div>

        {activeCount >= maxAllowed && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>
              Terminal limit reached. To add more cash registers,{' '}
              <Link href="/account/subscription" className="underline font-bold text-amber-900">
                upgrade your plan
              </Link>{' '}
              or deregister an unused workstation.
            </span>
          </p>
        )}
      </div>

      {/* 4. DEVICES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((dev) => {
          const isThisDevice = dev.deviceFingerprint === currentFp;
          const isActive = dev.status === 'ACTIVE';

          return (
            <div
              key={dev.id}
              className={`bg-white rounded-xl p-5 border shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                isThisDevice
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 shadow-2xs">
                      {getDeviceIcon(dev.deviceType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-black text-slate-900">{dev.deviceName}</h3>
                        {isThisDevice && (
                          <Badge className="text-[9px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.2 border border-emerald-300">
                            This PC
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">{dev.deviceType}</span>
                    </div>
                  </div>

                  <Badge
                    className={`text-[9px] font-black uppercase px-2 py-0.5 ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-rose-50 text-rose-700 border-rose-300'
                    }`}
                  >
                    {dev.status}
                  </Badge>
                </div>

                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span className="font-medium">Platform / OS</span>
                    <span className="font-bold text-slate-800">{dev.osInfo || 'Browser/Desktop'}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span className="font-medium">Registered On</span>
                    <span className="font-bold text-slate-800">{new Date(dev.registeredAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-mono text-[10px]">
                    <span className="font-sans font-medium text-xs">Fingerprint</span>
                    <span className="text-slate-400">{dev.deviceFingerprint.slice(0, 12)}…</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  {isThisDevice ? 'Current Active Terminal' : 'Remote Cashier PC'}
                </span>

                {isActive && !isThisDevice && (
                  <Button
                    onClick={() => handleDeregister(dev.id)}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Deregister
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
