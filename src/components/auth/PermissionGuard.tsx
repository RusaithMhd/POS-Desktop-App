'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { AuthService, UserSession } from '@/features/auth/AuthService';
import { Button } from '@/components/ui/button';

interface PermissionGuardProps {
  permission?: string | string[];
  moduleName?: string;
  children: React.ReactNode;
}

export function PermissionGuard({ permission, moduleName, children }: PermissionGuardProps) {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    const userSession = AuthService.getActiveSession();
    setSession(userSession);

    if (!userSession) {
      router.push('/login');
      return;
    }

    if (permission) {
      const roleUpper = (userSession.roleName || '').toUpperCase();
      if (
        roleUpper === 'SUPER_ADMIN' ||
        roleUpper === 'ADMIN_MANAGER' ||
        roleUpper === 'ADMIN' ||
        roleUpper === 'STORE_ADMIN' ||
        roleUpper.includes('ADMIN') ||
        roleUpper.includes('SUPER')
      ) {
        setHasAccess(true);
      } else {
        // Cashiers ALWAYS have default POS checkout access
        const isPosCheck = Array.isArray(permission)
          ? permission.some((p) => p === 'pos.access' || p === 'orders.create')
          : permission === 'pos.access' || permission === 'orders.create';

        if (roleUpper.includes('CASHIER') && isPosCheck) {
          setHasAccess(true);
          setIsChecking(false);
          return;
        }

        const userPerms = Array.isArray(userSession.permissions) ? userSession.permissions : [];
        const allowed = Array.isArray(permission)
          ? permission.some((p) => userPerms.includes(p))
          : userPerms.includes(permission);

        setHasAccess(allowed);
        if (!allowed && typeof window !== 'undefined') {
          // Smart Auto-redirect for cashiers landing on restricted dashboard
          if (userPerms.includes('pos.access') || userPerms.includes('orders.create')) {
            router.push('/pos');
            return;
          } else if (userPerms.includes('kitchen.view')) {
            router.push('/kitchen');
            return;
          }
        }
      }
    } else {
      setHasAccess(true);
    }

    setIsChecking(false);
  }, [permission, router]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white rounded-xl border border-slate-200 shadow-lg text-center space-y-5 select-none">
        <div className="inline-flex p-4 rounded-full bg-rose-50 text-rose-600">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-1">
            Your current role (<span className="font-bold text-slate-900">{session?.roleName || 'Cashier'}</span>) does not have permission to access the <span className="font-bold text-slate-900">{moduleName || permission}</span> module.
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200 text-left space-y-1 font-mono">
          <div>• Required Permission: <span className="text-rose-600 font-bold">{Array.isArray(permission) ? permission.join(' / ') : permission}</span></div>
          <div>• Logged in User: <span className="font-bold">{session?.fullName} ({session?.username})</span></div>
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <Button onClick={() => router.push('/pos')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> Return to POS Checkout
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
