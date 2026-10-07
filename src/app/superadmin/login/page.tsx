'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Crown,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  SendHorizontal,
  Sparkles,
} from 'lucide-react';
import { AdminAuthService } from '@/services/auth/AdminAuthService';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';

export default function SuperAdminLoginPage() {
  const router = useRouter();

  // Form State
  const [email, setEmail] = useState('rusa.rock72@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isDbReady, setIsDbReady] = useState(false);

  // 2FA OTP State
  const [step, setStep] = useState<'CREDENTIALS' | 'OTP_VERIFICATION'>('CREDENTIALS');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtpBadge, setDevOtpBadge] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Check existing superadmin session
    const session = AdminAuthService.getActiveSession();
    if (session) {
      router.push('/superadmin');
      return;
    }

    getLocalDb()
      .then(() => setIsDbReady(true))
      .catch((err) => {
        console.error('DB init error:', err);
        setIsDbReady(true);
      });
  }, [router]);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Auto-focus first OTP input on step change
  useEffect(() => {
    if (step === 'OTP_VERIFICATION') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // ── Step 1: Verify Credentials & Request OTP ─────────────────────────────
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password.trim()) {
        throw new Error('Please enter both master email and security password.');
      }

      let data: any = null;
      if (typeof window !== 'undefined' && window.electronAPI?.sendAdminOtp) {
        data = await window.electronAPI.sendAdminOtp({ email: cleanEmail, password: password.trim() });
      } else {
        const res = await fetch('/api/admin/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: password.trim() }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          throw new Error(`Server returned ${res.status}: API route unavailable. Please check backend deployment.`);
        }
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Authentication failed. Please verify credentials.');
      }

      setStep('OTP_VERIFICATION');
      setResendCooldown(60);
      setInfoMessage(`Security OTP dispatched to ${cleanEmail}. Please enter the 6-digit code.`);

      if (data.fallbackOtp) {
        setDevOtpBadge(data.fallbackOtp);
      } else {
        setDevOtpBadge(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: Verify OTP & Issue Super Admin Session ───────────────────────
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullCode = otpDigits.join('').trim();
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of your security code.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      let data: any = null;
      if (typeof window !== 'undefined' && window.electronAPI?.verifyAdminOtp) {
        data = await window.electronAPI.verifyAdminOtp({ email: cleanEmail, otp: fullCode });
      } else {
        const res = await fetch('/api/admin/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, otp: fullCode }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          throw new Error(`Server returned ${res.status}: API route unavailable. Please check backend deployment.`);
        }
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Invalid security verification code.');
      }

      // Establish client Super Admin session
      await AdminAuthService.login(cleanEmail, password.trim());
      router.push('/superadmin');
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP digit changes
  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric characters
    const cleanVal = value.replace(/[^0-9]/g, '');
    if (!cleanVal) {
      const nextDigits = [...otpDigits];
      nextDigits[index] = '';
      setOtpDigits(nextDigits);
      return;
    }

    // Support pasting multi-digit code
    if (cleanVal.length > 1) {
      const pasteDigits = cleanVal.slice(0, 6).split('');
      const nextDigits = [...otpDigits];
      pasteDigits.forEach((digit, i) => {
        if (i < 6) nextDigits[i] = digit;
      });
      setOtpDigits(nextDigits);
      const nextFocus = Math.min(pasteDigits.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const nextDigits = [...otpDigits];
    nextDigits[index] = cleanVal[0];
    setOtpDigits(nextDigits);

    // Auto-advance to next input
    if (index < 5 && cleanVal) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none font-sans">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Left Navigation Link */}
      <div className="absolute top-6 left-6 z-20">
        <a
          href="/login"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to POS Register
        </a>
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 shadow-lg shadow-amber-500/10 mb-1">
            <Crown className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-extrabold uppercase tracking-widest text-amber-400 mb-2">
              <Shield className="h-3 w-3" /> Master Super Admin Console
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {step === 'CREDENTIALS' ? 'Authorized Master Login' : 'Two-Factor Verification'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {step === 'CREDENTIALS'
                ? 'Secured commercial console for licensing, client activations, and hardware management.'
                : 'A single-use 6-digit verification code has been dispatched to your authorized master email.'}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-5">
          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Access Denied</p>
                <p className="text-red-300/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Info Banner */}
          {infoMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-emerald-300/90">{infoMessage}</p>
            </div>
          )}

          {/* Dev/Fallback Badge if Gmail SMTP App Password not configured yet */}
          {devOtpBadge && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Security Code Ready (Quick Setup):</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-base font-black tracking-widest text-white bg-slate-950/80 px-2.5 py-1 rounded-lg border border-amber-500/40">
                  {devOtpBadge}
                </span>
                <span className="text-[10px] text-amber-400/80">Configure Gmail App Password in .env for inbox delivery</span>
              </div>
            </div>
          )}

          {/* STEP 1: CREDENTIALS */}
          {step === 'CREDENTIALS' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Authorized Master Email</span>
                  <span className="text-[10px] text-amber-400 font-semibold">Protected Address</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="rusa.rock72@gmail.com"
                    disabled={isLoading}
                    autoComplete="email"
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Master Security Password</span>
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
                    autoComplete="current-password"
                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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
                    <span>Verifying & Sending OTP…</span>
                  </>
                ) : (
                  <>
                    <SendHorizontal className="h-4 w-4" />
                    <span>Authenticate & Request Security OTP</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: 2FA OTP ENTRY */}
          {step === 'OTP_VERIFICATION' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Enter 6-Digit Verification Code</label>
                  <span className="text-[11px] text-amber-400 font-mono">10 min validity</span>
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      disabled={isLoading}
                      className="h-12 w-full text-center text-xl font-mono font-black rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white outline-none transition-all shadow-inner"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('CREDENTIALS');
                    setOtpDigits(['', '', '', '', '', '']);
                    setError('');
                  }}
                  className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Change Credentials
                </button>

                <button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  disabled={isLoading || resendCooldown > 0}
                  className="text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpDigits.join('').length !== 6}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 text-sm transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                    <span>Verifying Security Code…</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    <span>Verify Code & Enter Master Console</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Security Disclaimers */}
        <div className="text-center space-y-1 text-[11px] text-slate-500">
          <p className="flex items-center justify-center gap-1.5">
            <Lock className="h-3 w-3 text-slate-600" />
            256-bit encrypted session. Master Super Admin activity is audited.
          </p>
          <p>Super Admin access is strictly restricted to rusa.rock72@gmail.com.</p>
        </div>
      </div>
    </div>
  );
}
