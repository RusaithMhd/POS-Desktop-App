'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  ShoppingBag, 
  Package, 
  Layers, 
  Receipt, 
  DollarSign, 
  BarChart3, 
  RefreshCw, 
  Settings, 
  LogOut, 
  Wifi, 
  WifiOff, 
  User as UserIcon,
  Clock
} from 'lucide-react';
import { AuthService, UserSession } from '@/features/auth/AuthService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    setUser(AuthService.getActiveSession());

    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = () => {
    AuthService.logout();
    router.push('/login');
  };

  const navLinks = [
    { href: '/pos', label: 'POS Checkout', icon: ShoppingBag },
    { href: '/products', label: 'Products', icon: Package },
    { href: '/inventory', label: 'Inventory Ledger', icon: Layers },
    { href: '/sales', label: 'Sales History', icon: Receipt },
    { href: '/shifts', label: 'Cash Register', icon: DollarSign },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/sync', label: 'Sync Queue', icon: RefreshCw },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  if (pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800 backdrop-blur-md px-4 py-2.5">
      <div className="flex items-center justify-between gap-4">
        {/* Brand & Connection State */}
        <div className="flex items-center gap-4">
          <Link href="/pos" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              T
            </div>
            <div>
              <div className="font-extrabold text-lg tracking-wider text-slate-100 flex items-center gap-1.5">
                TRIWYN <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">POS</span>
              </div>
              <div className="text-[10px] text-slate-400 -mt-1 font-medium">Offline-First Engine v1.0</div>
            </div>
          </Link>

          {/* Network State Badge */}
          <div className="hidden md:flex items-center">
            {isOnline ? (
              <Badge variant="online" className="gap-1.5 py-1 px-3">
                <Wifi className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                <span>Online — Cloud Connected</span>
              </Badge>
            ) : (
              <Badge variant="offline" className="gap-1.5 py-1 px-3">
                <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                <span>Offline Mode — Sales Saved Locally</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (pathname?.startsWith(`${link.href}/`) ?? false);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-slate-200">{user.fullName}</div>
                <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                  {user.roleName}
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <UserIcon className="h-4 w-4" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Logout"
                className="text-slate-400 hover:text-red-400 hover:bg-slate-900"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
