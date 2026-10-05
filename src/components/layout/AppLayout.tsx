'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Receipt, 
  Package, 
  Layers, 
  Users, 
  Truck, 
  ShoppingBag as PurchaseIcon, 
  DollarSign, 
  BarChart3, 
  Lock, 
  UserCheck, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  ChefHat,
  Calculator
} from 'lucide-react';
import { AuthService, UserSession } from '@/features/auth/AuthService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DesktopTitleBar } from '@/components/desktop/DesktopTitleBar';
import { isDesktopApp } from '@/lib/electronBridge';
import { AppSplashLoader } from '@/components/desktop/AppSplashLoader';

import { UserSwitchModal } from '@/components/auth/UserSwitchModal';
import { UserCheck as UserSwitchIcon } from 'lucide-react';

import { defaultSettingsService } from '@/services/settings/SettingsService';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [enableKOTDisplay, setEnableKOTDisplay] = useState(true);

  useEffect(() => {
    setUser(AuthService.getActiveSession());
    setIsOnline(navigator.onLine);

    const refreshSettings = () => {
      setUser(AuthService.getActiveSession());
      defaultSettingsService.getSettings().then((s) => {
        setEnableKOTDisplay(s.enableKOTDisplay !== false);
      });
    };

    refreshSettings();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('settings-updated', refreshSettings);
    window.addEventListener('permissions-updated', refreshSettings);

    let unbindQuickAction: (() => void) | undefined;
    if (isDesktopApp() && window.electronAPI) {
      unbindQuickAction = window.electronAPI.onQuickAction((action) => {
        if (action === 'nav-dashboard') router.push('/dashboard');
        else if (action === 'nav-pos' || action === 'new-sale') router.push('/pos');
        else if (action === 'nav-sales') router.push('/sales');
        else if (action === 'nav-products') router.push('/products');
        else if (action === 'nav-shifts') router.push('/shifts');
        else if (action === 'print-receipt') {
          if (typeof window !== 'undefined') window.print();
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('settings-updated', refreshSettings);
      window.removeEventListener('permissions-updated', refreshSettings);
      if (unbindQuickAction) unbindQuickAction();
    };
  }, [router]);

  const cleanPath = (pathname || '').replace(/\/$/, '');

  if (cleanPath === '/login') {
    return (
      <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">
        <AppSplashLoader />
        <DesktopTitleBar />
        <main className="flex-1 overflow-y-auto bg-slate-100">
          {children}
        </main>
      </div>
    );
  }

  const handleLogout = () => {
    AuthService.logout();
    router.push('/login');
  };

  const handleUserSwitched = (newSession: UserSession) => {
    setUser(newSession);
    window.location.reload();
  };

  const hasPerm = (requiredPerm?: string | string[]) => {
    if (!requiredPerm) return true;
    if (!user) return false;
    const roleUpper = (user.roleName || '').toUpperCase();
    if (
      roleUpper === 'SUPER_ADMIN' ||
      roleUpper === 'ADMIN_MANAGER' ||
      roleUpper === 'ADMIN' ||
      roleUpper === 'STORE_ADMIN' ||
      roleUpper.includes('ADMIN') ||
      roleUpper.includes('SUPER')
    ) {
      return true;
    }

    // Cashier roles ALWAYS receive default POS Checkout Access
    if (roleUpper.includes('CASHIER')) {
      const isPosCheck = Array.isArray(requiredPerm)
        ? requiredPerm.some((p) => p === 'pos.access' || p === 'orders.create')
        : requiredPerm === 'pos.access' || requiredPerm === 'orders.create';
      if (isPosCheck) return true;
    }

    const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
    if (Array.isArray(requiredPerm)) {
      return requiredPerm.some((p) => userPerms.includes(p));
    }
    return userPerms.includes(requiredPerm);
  };

  const mainNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
    { href: '/pos', label: 'Point of Sale', icon: ShoppingBag, permission: ['pos.access', 'orders.create'] },
    ...(enableKOTDisplay ? [{ href: '/kitchen', label: 'Kitchen Display', icon: ChefHat, permission: ['kitchen.view', 'kitchen.update_status'] }] : []),
    { href: '/sales', label: 'Sales History', icon: Receipt, permission: ['orders.view', 'orders.edit', 'orders.create'] },
    { href: '/products', label: 'Products', icon: Package, permission: ['products.view', 'products.create', 'products.edit'] },
    { href: '/inventory', label: 'Inventory Ledger', icon: Layers, permission: ['inventory.view', 'inventory.adjust'] },
    { href: '/customers', label: 'Customers', icon: Users, permission: ['customers.view', 'customers.manage'] },
    { href: '/suppliers', label: 'Suppliers', icon: Truck, permission: ['suppliers.manage', 'suppliers.view'] },
    { href: '/purchases', label: 'Purchases', icon: PurchaseIcon, permission: ['purchasing.view', 'purchasing.create', 'purchasing.receive'] },
    { href: '/expenses', label: 'Expenses', icon: DollarSign, permission: ['reports.financial', 'expenses.view'] },
    { href: '/accounting', label: 'Accounting', icon: Calculator, permission: ['accounting.view', 'reports.financial'] },
    { href: '/reports', label: 'Reports', icon: BarChart3, permission: ['reports.view', 'reports.financial', 'reports.export'] },
  ];

  const managementNavItems = [
    { href: '/shifts', label: 'Cash Register', icon: Lock, permission: ['cash_register.open', 'cash_register.close', 'shift.view'] },
    { href: '/users', label: 'Users & Roles', icon: UserCheck, permission: ['users.view', 'users.manage', 'roles.view', 'roles.manage'] },
    { href: '/settings', label: 'Settings', icon: Settings, permission: ['settings.view', 'settings.manage'] },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden select-none">
      <AppSplashLoader />
      <DesktopTitleBar />
      <UserSwitchModal
        isOpen={isSwitchModalOpen}
        onClose={() => setIsSwitchModalOpen(false)}
        onSwitched={handleUserSwitched}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* PERSISTENT SIDEBAR */}
        <aside
          className={`${
            isSidebarCollapsed ? 'w-16' : 'w-56'
          } bg-white border-r border-slate-200 flex flex-col justify-between z-30 shrink-0 transition-all duration-200 shadow-xs`}
        >
          <div className="flex flex-col h-full overflow-hidden">
            {/* Brand Header */}
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <img src="/Assets/Icon.png" alt="TRIWYN Logo" className="h-8 w-8 object-contain shrink-0" />
                {!isSidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="font-black text-sm tracking-wide text-slate-900 leading-tight truncate">
                      TRIWYN POS
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      Commercial POS
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* Navigation Lists */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {/* MAIN SECTION */}
              {mainNavItems.filter((item) => hasPerm(item.permission)).length > 0 && (
                <div>
                  {!isSidebarCollapsed && (
                    <div className="px-2 pb-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      MAIN MODULES
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {mainNavItems
                      .filter((item) => hasPerm(item.permission))
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive =
                          cleanPath === item.href || (item.href !== '/dashboard' && cleanPath.startsWith(item.href));

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            title={isSidebarCollapsed ? item.label : undefined}
                            className={`relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                              isActive
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isActive && (
                                <span className="absolute left-0 top-2 bottom-2 w-1 bg-amber-500 rounded-r" />
                              )}
                              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                            </div>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* MANAGEMENT SECTION */}
              {managementNavItems.filter((item) => hasPerm(item.permission)).length > 0 && (
                <div>
                  {!isSidebarCollapsed && (
                    <div className="px-2 pb-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      MANAGEMENT
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {managementNavItems
                      .filter((item) => hasPerm(item.permission))
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive =
                          cleanPath === item.href || (item.href !== '/dashboard' && cleanPath.startsWith(item.href));

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            title={isSidebarCollapsed ? item.label : undefined}
                            className={`relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                              isActive
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isActive && (
                                <span className="absolute left-0 top-2 bottom-2 w-1 bg-amber-500 rounded-r" />
                              )}
                              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                            </div>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Profile & Quick Switch Footer */}
          <div className="p-2.5 border-t border-slate-200 bg-slate-50 space-y-2 shrink-0">
            {user && (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  {!isSidebarCollapsed && (
                    <div className="min-w-0 pr-1">
                      <div className="text-xs font-extrabold text-slate-900 truncate">{user.fullName}</div>
                      <div className="text-[10px] text-emerald-700 font-black uppercase tracking-wider flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {user.roleName}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsSwitchModalOpen(true)}
                      title="Quick Switch User / Role"
                      className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors"
                    >
                      <UserSwitchIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      title="Logout Session"
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs font-bold pt-1">
              {isOnline ? (
                <span className="flex items-center gap-1.5 text-emerald-700 text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {!isSidebarCollapsed && 'Server Synced'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-700 text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {!isSidebarCollapsed && 'Offline Local'}
                </span>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN BODY AREA */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100">
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}

