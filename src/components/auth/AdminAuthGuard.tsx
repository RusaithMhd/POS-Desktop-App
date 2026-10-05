'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Shield, Crown, Loader2, Lock, AlertTriangle } from 'lucide-react';
import { SuperAdminNotificationCenter } from '@/components/superadmin/SuperAdminNotificationCenter';
import { AdminAuthService, AdminSession, AdminRole } from '@/services/auth/AdminAuthService';
import { getRawSqlDb, getLocalDb } from '@/infrastructure/database/sqlite/db';
import { ensureAdminTables } from '@/services/auth/AdminAuthService';

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN AUTH GUARD — wraps all /superadmin/* pages
// ─────────────────────────────────────────────────────────────────────────────

interface AdminAuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: AdminRole;
}

export function AdminAuthGuard({ children, requiredPermission, requiredRole }: AdminAuthGuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        await getLocalDb();
        const db = getRawSqlDb();
        ensureAdminTables(db);
      } catch { /* DB may not be ready */ }

      const adminSession = AdminAuthService.getActiveSession();

      if (!adminSession) {
        router.push('/superadmin/login');
        return;
      }

      // Check specific permission if required
      if (requiredPermission) {
        const hasAccess = AdminAuthService.hasPermission(adminSession, requiredPermission);
        if (!hasAccess) {
          setAccessDenied(true);
          setChecking(false);
          return;
        }
      }

      // Check specific role if required
      if (requiredRole && adminSession.role !== requiredRole && adminSession.role !== 'SUPER_ADMIN') {
        setAccessDenied(true);
        setChecking(false);
        return;
      }

      setSession(adminSession);
      setChecking(false);
    };

    check();
  }, [router, requiredPermission, requiredRole]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-3">
          <div className="p-3 bg-slate-800 rounded-xl inline-block">
            <Crown className="h-6 w-6 text-amber-400 animate-pulse" />
          </div>
          <p className="text-slate-400 text-sm font-semibold">Verifying admin credentials…</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden">
          <div className="bg-red-50 px-6 pt-6 pb-4 border-b border-red-200 flex items-center gap-3">
            <div className="p-2.5 bg-white rounded-xl border border-red-200">
              <Lock className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Access Denied</h2>
              <p className="text-xs text-slate-500 mt-0.5">Insufficient admin privileges</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">Your admin account does not have permission to access this section.</p>
            {session && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                <span className="font-bold">Your role: </span>{session.role}
              </div>
            )}
            <button
              onClick={() => router.push('/superadmin')}
              className="w-full h-9 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN HEADER (shared across all super admin pages)
// ─────────────────────────────────────────────────────────────────────────────

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, actions }: AdminHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    setSession(AdminAuthService.getActiveSession());
  }, []);

  const handleLogout = () => {
    AdminAuthService.logout();
    router.push('/superadmin/login');
  };

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-6 py-3.5 sticky top-0 z-30 backdrop-blur-md bg-slate-900/95">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4">
            <div className="p-1.5 bg-amber-500/20 rounded-lg">
              <Crown className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <span className="text-xs font-black text-amber-400 uppercase tracking-widest block leading-tight">Super Admin</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-mono text-emerald-400 font-bold tracking-wider">LIVE SYNC</span>
              </div>
            </div>
          </div>
          <div className="border-l border-slate-600 pl-4 hidden sm:block">
            <h1 className="text-sm font-bold text-white">{title}</h1>
            {subtitle && <p className="text-[11px] text-slate-400 truncate max-w-md">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {actions}
          
          {/* Real-time Notification Center */}
          <SuperAdminNotificationCenter />

          {session && (
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-700">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-white">{session.fullName}</div>
                <div className="text-[10px] text-slate-400">{session.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-red-900/50 border border-slate-600 hover:border-red-500/50 rounded-lg text-xs font-bold text-slate-300 hover:text-red-400 transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="max-w-screen-xl mx-auto flex items-center gap-1.5 mt-3 overflow-x-auto pb-0.5">
        {[
          { href: '/superadmin',               label: 'Overview' },
          { href: '/superadmin/customers',     label: 'Customers' },
          { href: '/superadmin/subscriptions', label: 'Subscriptions' },
          { href: '/superadmin/trials',        label: 'Trials' },
          { href: '/superadmin/devices',       label: 'Devices' },
          { href: '/superadmin/audit',         label: 'Audit Log' },
        ].map((nav) => {
          const currentClean = (pathname || '').replace(/\/$/, '');
          const navClean = nav.href.replace(/\/$/, '');
          const isActive = currentClean === navClean;
          return (
            <Link
              key={nav.href}
              href={nav.href}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent'
              }`}
            >
              {nav.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
