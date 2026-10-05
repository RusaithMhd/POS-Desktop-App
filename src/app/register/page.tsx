'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Shield, CheckCircle2, Loader2, Eye, EyeOff, ArrowRight,
  Building2, User, Mail, Phone, Globe, Lock, Zap, AlertCircle,
  Clock, CreditCard
} from 'lucide-react';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { CustomerRegistrationService, PLAN_CATALOG } from '@/services/registration/CustomerRegistrationService';
import { ensureAdminTables } from '@/services/auth/AdminAuthService';

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ['Account', 'Plan', 'Confirm'];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = step > idx;
        const active = step === idx;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                done ? 'bg-emerald-600 text-white' : active ? 'bg-white text-slate-900 ring-2 ring-emerald-500' : 'bg-white/10 text-slate-400'
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : idx}
              </div>
              <span className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 rounded-full ${done ? 'bg-emerald-600' : 'bg-white/10'}`} style={{ width: 48 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function SuccessScreen({ email, isTrial, trialEndsAt, planName, organizationId }: {
  email: string; isTrial: boolean; trialEndsAt?: string; planName: string; organizationId: string;
}) {
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  // For offline desktop: auto-verify email
  const handleAutoVerify = async () => {
    setVerifying(true);
    try {
      await getLocalDb();
      CustomerRegistrationService.autoVerifyForDesktop(email);
      setVerified(true);
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400_000))
    : 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-black text-white">Account Created!</h2>
        <p className="text-sm text-slate-400">{planName} Plan · {email}</p>
      </div>

      {/* Status checklist */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        {[
          { label: 'Organization created', done: true },
          { label: isTrial ? 'Free trial activated' : 'Account registered', done: !isTrial },
          { label: 'Email verification', done: verified, pending: !verified },
          { label: isTrial ? `${daysLeft}-day trial started` : 'Awaiting subscription approval', done: verified && isTrial, pending: !verified || !isTrial },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            ) : item.pending ? (
              <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-slate-600 flex-shrink-0" />
            )}
            <span className={`text-sm ${item.done ? 'text-white font-semibold' : 'text-slate-400'}`}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Trial info */}
      {isTrial && daysLeft > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center">
          <div className="text-3xl font-black text-emerald-400">{daysLeft}</div>
          <div className="text-xs text-emerald-400 font-bold">Days Remaining in Free Trial</div>
        </div>
      )}

      {/* For offline mode: simulate email verification */}
      {!verified && (
        <div className="space-y-3">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300 text-center">
            <strong>Offline Mode:</strong> In production, a verification email is sent to {email}.<br />
            For this offline desktop build, click below to activate your account instantly.
          </div>
          <button
            onClick={handleAutoVerify}
            disabled={verifying}
            className="w-full h-11 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60"
          >
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {verifying ? 'Activating…' : 'Verify Email & Activate Account'}
          </button>
        </div>
      )}

      {verified && (
        <a
          href="/login"
          className="w-full h-11 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all"
        >
          <ArrowRight className="h-4 w-4" /> Go to POS Login
        </a>
      )}

      <p className="text-center text-xs text-slate-500">
        Already have an account? <a href="/login" className="text-emerald-400 font-bold hover:underline">Sign in</a>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION FORM (inner, uses useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────

function RegisterForm() {
  const searchParams = useSearchParams();
  const planParam = (searchParams.get('plan') || 'FREE_TRIAL') as keyof typeof PLAN_CATALOG;
  const billingParam = (searchParams.get('billing') || 'monthly') as 'monthly' | 'yearly';

  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLAN_CATALOG>(planParam);
  const [billing, setBilling] = useState<'MONTHLY' | 'YEARLY'>(billingParam === 'yearly' ? 'YEARLY' : 'MONTHLY');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationResult, setRegistrationResult] = useState<any>(null);

  // Form fields
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Sri Lanka');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const planDetails = PLAN_CATALOG[selectedPlan] || PLAN_CATALOG['FREE_TRIAL'];
  const isTrial = selectedPlan === 'FREE_TRIAL';

  const validateStep1 = (): boolean => {
    if (!businessName.trim()) { setError('Business name is required.'); return false; }
    if (!fullName.trim()) { setError('Your full name is required.'); return false; }
    if (!email.trim() || !email.includes('@')) { setError('Valid email address is required.'); return false; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return false; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return false; }
    if (!agreedToTerms) { setError('Please agree to the Terms & Conditions.'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    setError('');
    if (!validateStep1()) return;
    setIsLoading(true);
    try {
      await getLocalDb();
      const db = getRawSqlDb();
      ensureAdminTables(db); // Ensure admin tables exist on first run

      if (selectedPlan === 'FREE_TRIAL') {
        const trialRes = await CustomerRegistrationService.registerFreeTrial({
          businessName: businessName.trim(),
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          country: country || 'Sri Lanka',
        });
        window.location.href = `/download-trial?trialId=${trialRes.trialId}&business=${encodeURIComponent(trialRes.businessName)}&expiry=${encodeURIComponent(trialRes.expiryDate)}`;
        return;
      }

      const result = await CustomerRegistrationService.register({
        businessName: businessName.trim(),
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        country: country || undefined,
        password,
        selectedPlanCode: selectedPlan as any,
        billingCycle: billing,
      });

      setRegistrationResult(result);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show success screen
  if (registrationResult) {
    return (
      <SuccessScreen
        email={email}
        isTrial={isTrial}
        trialEndsAt={registrationResult.trialEndsAt}
        planName={planDetails.name}
        organizationId={registrationResult.organizationId}
      />
    );
  }

  const PLAN_OPTS: Array<keyof typeof PLAN_CATALOG> = ['FREE_TRIAL', 'STARTER', 'PROFESSIONAL', 'BUSINESS'];
  const PLAN_COLORS: Record<string, string> = {
    FREE_TRIAL: 'border-slate-500 bg-slate-500/10 text-slate-200',
    STARTER: 'border-blue-500 bg-blue-500/10 text-blue-200',
    PROFESSIONAL: 'border-emerald-500 bg-emerald-500/10 text-emerald-200',
    BUSINESS: 'border-violet-500 bg-violet-500/10 text-violet-200',
  };

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Account Details */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Business Information</h3>

          <div className="space-y-3">
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Business / Organization Name *"
                className="w-full h-11 pl-10 pr-4 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your Full Name *"
                className="w-full h-11 pl-10 pr-4 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address *"
                className="w-full h-11 pl-10 pr-4 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="w-full h-11 pl-10 pr-4 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                >
                  {['Sri Lanka', 'India', 'United Kingdom', 'United States', 'Australia', 'Canada', 'Singapore', 'UAE', 'Other'].map((c) => (
                    <option key={c} value={c} className="bg-slate-800">{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 8 characters) *"
                className="w-full h-11 pl-10 pr-12 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password *"
                className="w-full h-11 pl-10 pr-4 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded text-emerald-500 bg-white/10 border-white/30"
              />
              <span className="text-xs text-slate-400">
                I agree to the <span className="text-emerald-400 font-bold hover:underline cursor-pointer">Terms of Service</span> and{' '}
                <span className="text-emerald-400 font-bold hover:underline cursor-pointer">Privacy Policy</span>
              </span>
            </label>
          </div>

          <button
            onClick={() => { if (validateStep1()) { setError(''); setStep(2); } }}
            className="w-full h-11 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            Next: Select Plan <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step 2: Plan Selection */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Choose Your Plan</h3>

          <div className="grid grid-cols-2 gap-3">
            {PLAN_OPTS.map((code) => {
              const p = PLAN_CATALOG[code];
              const isSelected = selectedPlan === code;
              const clr = PLAN_COLORS[code] || PLAN_COLORS['STARTER'];
              return (
                <button
                  key={code}
                  onClick={() => setSelectedPlan(code)}
                  className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected ? clr : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="text-sm font-black">{p.name}</div>
                  <div className="text-xs font-semibold">
                    {code === 'FREE_TRIAL' ? `${p.trialDays}-day free trial` : `LKR ${p.monthlyPrice.toLocaleString()}/mo`}
                  </div>
                  <div className="text-[10px] opacity-70">
                    {p.maxUsers} users · {p.maxDevices} devices
                  </div>
                </button>
              );
            })}
          </div>

          {selectedPlan !== 'FREE_TRIAL' && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
              {(['MONTHLY', 'YEARLY'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${billing === b ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {b === 'MONTHLY' ? 'Pay Monthly' : 'Pay Yearly (Save 17%)'}
                </button>
              ))}
            </div>
          )}

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-sm text-emerald-300 font-bold text-center">
            {isTrial ? '✓ No credit card required — 14 days free' : `${planDetails.name} · LKR ${(billing === 'MONTHLY' ? planDetails.monthlyPrice : planDetails.yearlyPrice).toLocaleString()}/${billing === 'MONTHLY' ? 'mo' : 'yr'}`}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setStep(1)} className="h-11 bg-white/10 hover:bg-white/15 text-white rounded-xl font-bold text-sm transition-all">← Back</button>
            <button onClick={() => setStep(3)} className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all">
              Review →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm & Submit */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Confirm & Create Account</h3>

          <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/10">
            {[
              { label: 'Business', value: businessName },
              { label: 'Contact', value: fullName },
              { label: 'Email', value: email },
              { label: 'Plan', value: planDetails.name },
              { label: 'Billing', value: isTrial ? '14-Day Free Trial' : billing },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3 text-xs">
                <span className="text-slate-400 font-semibold">{row.label}</span>
                <span className="text-white font-bold truncate max-w-[180px]">{row.value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full h-12 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating Account…</>
              : isTrial
              ? <><Zap className="h-4 w-4" /> Start Free Trial Now</>
              : <><CreditCard className="h-4 w-4" /> Create Account & Continue to Payment</>
            }
          </button>
          <button onClick={() => setStep(2)} className="w-full h-10 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-xs font-bold transition-all">← Back</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <Shield className="h-6 w-6 text-emerald-400" />
            </div>
            <span className="text-xl font-black text-white">TRIWYN POS</span>
          </div>
          <h1 className="text-2xl font-black text-white">Create Your Account</h1>
          <p className="text-xs text-slate-400">Start with a 14-day free trial. No credit card needed.</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-2xl">
          <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-400" /></div>}>
            <RegisterForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-slate-500">
          Already have an account?{' '}
          <a href="/login" className="text-emerald-400 font-bold hover:underline">Sign in</a>
          &nbsp;·&nbsp;
          <a href="/pricing" className="text-slate-400 hover:text-white">View Plans</a>
        </p>
      </div>
    </div>
  );
}
