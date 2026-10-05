'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ShieldCheck, Loader2, HelpCircle, X, MessageCircle } from 'lucide-react';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { AuthService } from '@/features/auth/AuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { DeviceLicenseService, collectDeviceInfo, DeviceLimitCheck, DeviceInfo } from '@/services/licensing/DeviceLicenseService';
import { DeviceRegistrationModal } from '@/components/licensing/DeviceRegistrationModal';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Device licensing state
  const [deviceLimitCheck, setDeviceLimitCheck] = useState<DeviceLimitCheck | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string>('');
  const [deviceProcessing, setDeviceProcessing] = useState(false);

  useEffect(() => {
    // Check if session already exists (Rule 27: Maintain session without re-login)
    const existingSession = AuthService.getActiveSession();
    if (existingSession) {
      router.replace('/pos');
      return;
    }

    // Retrieve saved username if Remember Me was selected previously
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('triwyn_remembered_user');
      if (savedUser) {
        setUsername(savedUser);
      }
    }

    getLocalDb().then(() => {
      setIsDbReady(true);
      runDeviceCheck();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runDeviceCheck = async () => {
    try {
      const raw = getRawSqlDb();
      const svc = new DeviceLicenseService(raw);

      const orgId = svc.ensureDefaultOrgAndSubscription();
      setCurrentOrgId(orgId);

      const info = collectDeviceInfo();
      setDeviceInfo(info);

      const check = svc.checkDeviceAccess(orgId, info.fingerprint);

      if (check.reason === 'OK') {
        svc.registerDevice(orgId, info, 'SYSTEM', true);
        setDeviceLimitCheck(null);
      } else if (check.reason === 'ALREADY_REGISTERED') {
        setDeviceLimitCheck(null);
      } else {
        setDeviceLimitCheck(check);
      }
    } catch (err) {
      console.warn('Device license check non-fatal error:', err);
      setDeviceLimitCheck(null);
    }
  };

  const handleRegisterRequest = async (deviceName: string, notes: string) => {
    setDeviceProcessing(true);
    try {
      const raw = getRawSqlDb();
      const svc = new DeviceLicenseService(raw);
      const info = collectDeviceInfo();
      info.name = deviceName;
      svc.registerDevice(currentOrgId, info, username || 'terminal-user', false);
      const check = svc.checkDeviceAccess(currentOrgId, info.fingerprint);
      setDeviceLimitCheck(check);
    } catch (err) {
      console.error('Device registration request failed:', err);
    } finally {
      setDeviceProcessing(false);
    }
  };

  const handleRefreshDeviceCheck = async () => {
    try {
      const raw = getRawSqlDb();
      const svc = new DeviceLicenseService(raw);
      const info = collectDeviceInfo();
      const check = svc.checkDeviceAccess(currentOrgId, info.fingerprint);

      if (check.reason === 'ALREADY_REGISTERED' || check.reason === 'OK') {
        setDeviceLimitCheck(null);
      } else {
        setDeviceLimitCheck(check);
      }
    } catch (err) {
      console.error('Device check refresh failed:', err);
    }
  };

  const handleCancelAndLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('triwyn_session');
      localStorage.removeItem('triwyn_current_user');
    }
    setDeviceLimitCheck(null);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    try {
      await AuthService.loginWithPassword(username.trim(), password);

      if (rememberMe && typeof window !== 'undefined') {
        localStorage.setItem('triwyn_remembered_user', username.trim());
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem('triwyn_remembered_user');
      }

      router.push('/pos');
    } catch (err: any) {
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen py-8 relative flex flex-col items-center justify-center p-4 bg-cover bg-center bg-no-repeat overflow-hidden select-none"
      style={{ backgroundImage: "url('/Assets/Start_page_Bg.png')" }}
    >
      {/* Background Dim Overlay */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs z-0" />

      {/* Device Registration Modal (Blocks terminal if hardware license issue) */}
      {deviceLimitCheck && deviceInfo && (
        <DeviceRegistrationModal
          limitCheck={deviceLimitCheck}
          deviceInfo={deviceInfo}
          onRegisterRequest={handleRegisterRequest}
          onRefreshCheck={handleRefreshDeviceCheck}
          onCancelAndLogout={handleCancelAndLogout}
          isProcessing={deviceProcessing}
        />
      )}

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-sm space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="relative inline-block">
            <img
              src="/Assets/Icon.png"
              alt="TRIWYN Logo"
              className="h-20 w-20 mx-auto object-contain drop-shadow-2xl transition-transform hover:scale-105 duration-300"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-md">
            TRIWYN POS
          </h1>
          <p className="text-xs text-slate-300 font-medium">
            Commercial Offline Point of Sale
          </p>
        </div>

        {/* Clean Login Card */}
        <Card className="border border-white/20 bg-white/90 backdrop-blur-2xl shadow-2xl shadow-black/50 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-2 pt-6 px-6">
            <h2 className="text-lg font-black text-slate-900">Welcome Back</h2>
            <p className="text-xs text-slate-500">Sign in to open your POS register</p>
          </CardHeader>

          <CardContent className="space-y-4 px-6 pb-6">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-800 text-xs font-bold text-center">
                {error}
              </div>
            )}

            {!isDbReady ? (
              <div className="text-center py-6 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Initializing Local Terminal Engine…</span>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="username"
                      className="pl-9 h-11 bg-white border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="current-password"
                      className="pl-9 h-11 bg-white border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-0"
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-700/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Authenticating…</span>
                    </>
                  ) : (
                    'LOGIN'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-emerald-400" /> Account Recovery
              </h3>
              <button onClick={() => setShowForgotModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              If you forgot your cashier or administrator credentials, please contact your store supervisor or our verification support team:
            </p>

            <div className="space-y-2 text-xs">
              <a
                href="https://wa.me/94770802365?text=Hello%20Support%2C%20I%20need%20help%20recovering%20my%20POS%20credentials."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp: 0770802365</span>
              </a>

              <a
                href="https://wa.me/94750802353?text=Hello%20Support%2C%20I%20need%20help%20recovering%20my%20POS%20credentials."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl font-bold flex items-center justify-center gap-2 border border-emerald-500/30 transition-all"
              >
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp: 0750802353</span>
              </a>
            </div>

            <Button
              onClick={() => setShowForgotModal(false)}
              className="w-full h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
            >
              Close
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
