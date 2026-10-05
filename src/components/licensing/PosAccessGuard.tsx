'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle, Clock, Ban, CreditCard, Loader2, LogOut, RefreshCw, MessageCircle } from 'lucide-react';
import { AuthService } from '@/features/auth/AuthService';
import { CustomerRegistrationService, SubscriptionAccessCheck } from '@/services/registration/CustomerRegistrationService';
import { getRawSqlDb, getLocalDb } from '@/infrastructure/database/sqlite/db';

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS BLOCKED SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function AccessBlocked({ check, onLogout, onRefresh }: { check: SubscriptionAccessCheck; onLogout: () => void; onRefresh: () => void }) {
  const configs = {
    EXPIRED:          { icon: Clock,         color: 'text-red-500',    bg: 'from-red-50 to-rose-50',    border: 'border-red-200',    title: 'Subscription Expired',          msg: 'Your subscription has expired. Please renew to continue using TRIWYN POS.' },
    SUSPENDED:        { icon: Ban,           color: 'text-red-600',    bg: 'from-red-50 to-rose-50',    border: 'border-red-300',    title: 'Account Suspended',             msg: 'Your account has been suspended. Please contact support for assistance.' },
    PENDING_APPROVAL: { icon: Clock,         color: 'text-blue-500',   bg: 'from-blue-50 to-indigo-50', border: 'border-blue-200',   title: 'Awaiting Subscription Approval', msg: 'Your subscription is being reviewed. You will be notified once approved.' },
    NO_SUBSCRIPTION:  { icon: CreditCard,    color: 'text-slate-500',  bg: 'from-slate-50 to-gray-50',  border: 'border-slate-200',  title: 'No Active Subscription',        msg: 'No subscription found. Please register and select a plan.' },
    EMAIL_NOT_VERIFIED:{ icon: Shield,       color: 'text-amber-500',  bg: 'from-amber-50 to-yellow-50',border: 'border-amber-200',  title: 'Email Not Verified',            msg: 'Please verify your email address to activate your account.' },
    TRIALING:         { icon: Clock,         color: 'text-emerald-500',bg: 'from-emerald-50 to-teal-50',border: 'border-emerald-200',title: 'Free Trial Active',             msg: '' },
    ACTIVE:           { icon: Shield,        color: 'text-emerald-500',bg: 'from-emerald-50 to-teal-50',border: 'border-emerald-200',title: 'Active',                        msg: '' },
  };

  const cfg = configs[check.reason] ?? configs.NO_SUBSCRIPTION;
  const Icon = cfg.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className={`max-w-md w-full bg-white rounded-2xl shadow-2xl border ${cfg.border} overflow-hidden`}>
        <div className={`bg-gradient-to-br ${cfg.bg} px-6 pt-6 pb-4 border-b ${cfg.border}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl bg-white shadow-sm border ${cfg.border}`}>
              <Icon className={`h-6 w-6 ${cfg.color}`} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">{cfg.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{check.planName} Plan</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-700">{cfg.msg}</p>

          {check.reason === 'PENDING_APPROVAL' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-blue-800">What happens next?</p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>Our team reviews your subscription request</li>
                <li>You will receive an email notification upon approval</li>
                <li>Once approved, you can access the full POS</li>
              </ol>
              <button
                onClick={onRefresh}
                className="flex items-center gap-1.5 mt-2 text-xs text-blue-600 font-bold hover:underline"
              >
                <RefreshCw className="h-3 w-3" /> Check status again
              </button>
            </div>
          )}

          {check.reason === 'EXPIRED' && (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                <p className="font-bold">Contact us to activate or renew your POS:</p>
                <p className="text-[11px] text-red-700">Chat with support to receive payment details. Once verified, your terminal will be unlocked immediately.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/94770802365?text=${encodeURIComponent('Hello, I would like to activate my POS.\nPlease provide the payment details.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp: 0770802365
                </a>
                <a
                  href={`https://wa.me/94750802353?text=${encodeURIComponent('Hello, I would like to activate my POS.\nPlease provide the payment details.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 h-10 bg-slate-800 hover:bg-slate-900 text-emerald-400 rounded-xl font-bold text-xs transition-colors border border-slate-700"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp: 0750802353
                </a>
              </div>
              <button
                onClick={onRefresh}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-blue-600 font-bold hover:underline pt-2"
              >
                <RefreshCw className="h-3 w-3" /> Check License Status Now
              </button>
            </div>
          )}

          {check.reason === 'EMAIL_NOT_VERIFIED' && (
            <a
              href="/register"
              className="flex items-center justify-center gap-2 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-colors"
            >
              Complete Registration
            </a>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
          <span className="text-[11px] text-slate-400 font-mono">Protected by Triwyn Licensing</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIAL BANNER (shown inside POS when trial active)
// ─────────────────────────────────────────────────────────────────────────────

export function TrialBanner({ daysRemaining }: { daysRemaining: number }) {
  return (
    <div className={`w-full flex items-center justify-between text-xs font-bold py-2 px-6 shadow-sm ${
      daysRemaining <= 3 ? 'bg-red-600 text-white' : 'bg-slate-900 text-amber-300 border-b border-amber-500/30'
    }`}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-amber-400" />
        <span>
          <strong>FREE TRIAL:</strong> {daysRemaining} DAY{daysRemaining !== 1 ? 'S' : ''} REMAINING
        </span>
      </div>
      <div className="flex items-center gap-3">
        <a
          href={`https://wa.me/94770802365?text=${encodeURIComponent(
            `Hello, I would like to activate my POS.\nTrial Days Remaining: ${daysRemaining}\nPlease provide the payment details.`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-black transition-all shadow"
        >
          <MessageCircle className="h-3.5 w-3.5" /> ACTIVATE POS
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POS ACCESS GUARD
// ─────────────────────────────────────────────────────────────────────────────

interface PosAccessGuardProps {
  children: React.ReactNode;
}

export function PosAccessGuard({ children }: PosAccessGuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accessCheck, setAccessCheck] = useState<SubscriptionAccessCheck | null>(null);

  const runCheck = async () => {
    setChecking(true);
    try {
      // 1. Customer must be logged in
      const session = AuthService.getActiveSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // 2. Get organization ID from session context
      await getLocalDb();
      const db = getRawSqlDb();
      const orgStmt = db.prepare(`SELECT id FROM organizations WHERE id = (SELECT organization_id FROM customer_registrations LIMIT 1) LIMIT 1`);
      let orgId = '';
      if (orgStmt.step()) orgId = (orgStmt.getAsObject().id as string) || '';
      orgStmt.free();

      // Fallback: try to find org from session's business ID
      if (!orgId) {
        const bizStmt = db.prepare(`SELECT id FROM organizations LIMIT 1`);
        if (bizStmt.step()) orgId = (bizStmt.getAsObject().id as string) || '';
        bizStmt.free();
      }

      if (!orgId) {
        // No organization found — allow access for fresh/unregistered installs (B2B premise mode)
        setAccessCheck({ allowed: true, reason: 'ACTIVE', planName: 'Direct', status: 'ACTIVE', organizationId: '' });
        setChecking(false);
        return;
      }

      // 3. Check subscription access
      const check = CustomerRegistrationService.checkSubscriptionAccess(orgId);
      setAccessCheck(check);
    } catch (err) {
      console.warn('POS access check failed, allowing access:', err);
      // Non-blocking: on error, allow access rather than lock users out
      setAccessCheck({ allowed: true, reason: 'ACTIVE', planName: 'Direct', status: 'ACTIVE', organizationId: '' });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { runCheck(); }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mx-auto" />
          <p className="text-slate-400 text-sm font-semibold">Verifying subscription access…</p>
        </div>
      </div>
    );
  }

  if (!accessCheck?.allowed) {
    return (
      <AccessBlocked
        check={accessCheck ?? { allowed: false, reason: 'NO_SUBSCRIPTION', planName: '', status: 'REGISTERED', organizationId: '' }}
        onLogout={() => { AuthService.logout(); router.push('/login'); }}
        onRefresh={runCheck}
      />
    );
  }

  // Allowed — render POS with optional trial banner
  return (
    <>
      {accessCheck.reason === 'TRIALING' && accessCheck.daysRemaining !== undefined && (
        <TrialBanner daysRemaining={accessCheck.daysRemaining} />
      )}
      {children}
    </>
  );
}
