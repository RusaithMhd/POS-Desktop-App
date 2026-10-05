'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Crown, Lock, Mail, Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';
import { AdminAuthService } from '@/services/auth/AdminAuthService';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@triwyn.com');
  const [password, setPassword] = useState('SuperAdmin@2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    // If already logged in as superadmin, redirect to superadmin dashboard
    const session = AdminAuthService.getActiveSession();
    if (session) {
      router.push('/superadmin');
      return;
    }

    getLocalDb()
      .then(() => setIsDbReady(true))
      .catch((err) => {
        console.error('DB init failed:', err);
        setIsDbReady(true);
      });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await AdminAuthService.login(email, password);
      router.push('/superadmin');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDefaultCredentials = () => {
    setEmail('admin@triwyn.com');
    setPassword('SuperAdmin@2026!');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar Back Link */}
      <div className="absolute top-6 left-6 z-20">
        <a
          href="/login"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to POS Login
        </a>
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 shadow-lg shadow-amber-500/10 mb-1">
            <Crown className="h-8 w-8 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-extrabold uppercase tracking-widest text-amber-400 mb-2">
              <Shield className="h-3 w-3" /> Dedicated Admin Portal
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Super Admin Console</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              SaaS licensing, customer approvals, device management, and platform oversight.
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Access Denied</p>
                <p className="text-red-300/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Admin Email</span>
                <span className="text-[10px] text-slate-500 font-normal">Registered administrator</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@triwyn.com"
                  disabled={isLoading}
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Security Password</span>
                <span className="text-[10px] text-slate-500 font-normal">Encrypted bcrypt</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  disabled={isLoading}
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isDbReady}
              className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 text-sm transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  <span>Verifying Admin Credentials…</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>Authorize Admin Session</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Autofill */}
          <div className="pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={fillDefaultCredentials}
              className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center justify-center gap-2 transition-all"
            >
              <span>Autofill Super Admin Demo Credentials</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-2">
              Default: <code className="text-slate-400 font-mono">admin@triwyn.com</code> / <code className="text-slate-400 font-mono">SuperAdmin@2026!</code>
            </p>
          </div>
        </div>

        {/* Security Disclaimers */}
        <div className="text-center space-y-1 text-[11px] text-slate-500">
          <p className="flex items-center justify-center gap-1.5">
            <Lock className="h-3 w-3 text-slate-600" />
            256-bit internal audit logging enabled. All admin actions are timestamped.
          </p>
          <p>Super Admin sessions expire automatically after 8 hours of inactivity.</p>
        </div>
      </div>
    </div>
  );
}
