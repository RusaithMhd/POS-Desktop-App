'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ShieldCheck, Loader2 } from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import { AuthService } from '@/features/auth/AuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('pin');
  const [username, setUsername] = useState('cashier');
  const [password, setPassword] = useState('Cashier@123');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    getLocalDb().then(() => setIsDbReady(true));
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await AuthService.loginWithPassword(username, password);
      router.push('/pos');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinPress = async (digit: string) => {
    if (pin.length >= 4 || isLoading) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    if (newPin.length === 4) {
      setIsLoading(true);
      try {
        await AuthService.loginWithPin(newPin);
        router.push('/pos');
      } catch (err: any) {
        setError(err.message || 'Invalid PIN code.');
        setPin('');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePinBackspace = () => {
    if (isLoading) return;
    setPin(pin.slice(0, -1));
  };

  const fillQuickAuth = (role: 'admin' | 'cashier') => {
    if (role === 'admin') {
      setUsername('admin');
      setPassword('Admin@123');
      setPin('1234');
    } else {
      setUsername('cashier');
      setPassword('Cashier@123');
      setPin('9999');
    }
  };

  return (
    <div
      className="min-h-full py-8 relative flex flex-col items-center justify-center p-4 bg-cover bg-center bg-no-repeat overflow-hidden select-none"
      style={{ backgroundImage: "url('/Assets/Start_page_Bg.png')" }}
    >
      {/* Background Dim Overlay */}
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs z-0" />

      {/* Main Glass Container */}
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
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md">TRIWYN POS</h1>
          <p className="text-xs text-slate-200 font-medium flex items-center justify-center gap-1.5 drop-shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Commercial Offline-First Terminal
          </p>
        </div>

        {/* Glassmorphism Card */}
        <Card className="border border-white/30 bg-white/85 backdrop-blur-2xl shadow-2xl shadow-black/40 rounded-2xl overflow-hidden transition-all">
          <CardHeader className="text-center pb-2 pt-5 px-5">
            <div className="grid grid-cols-2 gap-1 bg-slate-900/10 p-1 rounded-xl border border-slate-900/10 backdrop-blur-md">
              <button
                type="button"
                onClick={() => { if (!isLoading) { setLoginMode('pin'); setError(''); } }}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  loginMode === 'pin'
                    ? 'bg-white text-slate-900 shadow-md scale-[1.02]'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                PIN Pad Login
              </button>
              <button
                type="button"
                onClick={() => { if (!isLoading) { setLoginMode('password'); setError(''); } }}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  loginMode === 'password'
                    ? 'bg-white text-slate-900 shadow-md scale-[1.02]'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                Password Mode
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-5 pb-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-800 text-xs font-bold text-center animate-in fade-in zoom-in duration-200">
                {error}
              </div>
            )}

            {/* Small Authenticating Loader Display */}
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 text-xs font-semibold rounded-xl animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Authenticating terminal user...</span>
              </div>
            )}

            {!isDbReady ? (
              <div className="text-center py-6 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Initializing Local SQLite Engine...</span>
              </div>
            ) : loginMode === 'pin' ? (
              <div className="space-y-4">
                <div className="flex justify-center gap-3 py-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                        pin.length > idx
                          ? 'bg-emerald-600 border-emerald-600 scale-110 shadow-md shadow-emerald-600/30'
                          : 'border-slate-300 bg-white/60'
                      }`}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      disabled={isLoading}
                      onClick={() => handlePinPress(digit)}
                      className="h-12 rounded-xl bg-white/70 hover:bg-white border border-slate-200/80 text-lg font-bold text-slate-800 transition-all hover:scale-105 active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setPin('')}
                    className="h-12 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200 text-xs font-bold text-slate-600 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handlePinPress('0')}
                    className="h-12 rounded-xl bg-white/70 hover:bg-white border border-slate-200/80 text-lg font-bold text-slate-800 transition-all hover:scale-105 active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handlePinBackspace}
                    className="h-12 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200 text-xs font-bold text-slate-600 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    ⌫
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePasswordLogin} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Username</label>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    required
                    className="bg-white/80 border-slate-300/80 focus:bg-white transition-all rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="bg-white/80 border-slate-300/80 focus:bg-white transition-all rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            )}

            <div className="pt-3 border-t border-slate-900/10 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => fillQuickAuth('cashier')}
                className="flex-1 text-xs font-semibold text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/80 border-emerald-200/80 rounded-xl"
              >
                Cashier (PIN 9999)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => fillQuickAuth('admin')}
                className="flex-1 text-xs font-semibold text-blue-800 bg-blue-50/60 hover:bg-blue-100/80 border-blue-200/80 rounded-xl"
              >
                Admin (PIN 1234)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

