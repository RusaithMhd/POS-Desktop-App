'use client';

import React, { useState, useEffect } from 'react';
import {
  Monitor, Shield, AlertTriangle, Clock, Ban, CheckCircle2,
  Loader2, X, Cpu, Hash, Globe, RefreshCw, LogOut, MessageCircle
} from 'lucide-react';
import { DeviceLimitCheck, DeviceInfo } from '@/services/licensing/DeviceLicenseService';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DeviceRegistrationModalProps {
  limitCheck: DeviceLimitCheck;
  deviceInfo: DeviceInfo;
  onRegisterRequest: (deviceName: string, notes: string) => Promise<void>;
  onRefreshCheck: () => Promise<void>;
  onCancelAndLogout: () => void;
  isProcessing: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIGS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  LIMIT_REACHED: {
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    bgGradient: 'from-amber-50 to-orange-50',
    borderColor: 'border-amber-200',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    title: 'Device Limit Reached',
    subtitle: 'Your subscription plan has reached its maximum registered device count.',
    canRequest: true,
  },
  PENDING_APPROVAL: {
    icon: Clock,
    iconColor: 'text-blue-500',
    bgGradient: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    title: 'Awaiting Admin Approval',
    subtitle: 'Your device registration request has been submitted and is pending approval from your system administrator.',
    canRequest: false,
  },
  SUSPENDED: {
    icon: Ban,
    iconColor: 'text-red-500',
    bgGradient: 'from-red-50 to-rose-50',
    borderColor: 'border-red-200',
    badgeBg: 'bg-red-100 text-red-800 border-red-200',
    title: 'Device Suspended',
    subtitle: 'This device has been suspended by your administrator. Please contact support.',
    canRequest: false,
  },
  REVOKED: {
    icon: Ban,
    iconColor: 'text-red-600',
    bgGradient: 'from-red-50 to-rose-50',
    borderColor: 'border-red-300',
    badgeBg: 'bg-red-100 text-red-800 border-red-300',
    title: 'Device Access Revoked',
    subtitle: 'Access for this device has been revoked. Contact your administrator for assistance.',
    canRequest: false,
  },
  NO_SUBSCRIPTION: {
    icon: Shield,
    iconColor: 'text-slate-500',
    bgGradient: 'from-slate-50 to-gray-50',
    borderColor: 'border-slate-200',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
    title: 'No Active Subscription',
    subtitle: 'No subscription found for this organization. Please contact your administrator.',
    canRequest: false,
  },
  SUBSCRIPTION_EXPIRED: {
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    bgGradient: 'from-red-50 to-rose-50',
    borderColor: 'border-red-200',
    badgeBg: 'bg-red-100 text-red-800 border-red-200',
    title: 'Subscription Expired',
    subtitle: 'Your subscription has expired. Please renew to continue using this system.',
    canRequest: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DeviceRegistrationModal({
  limitCheck,
  deviceInfo,
  onRegisterRequest,
  onRefreshCheck,
  onCancelAndLogout,
  isProcessing,
}: DeviceRegistrationModalProps) {
  const [deviceName, setDeviceName] = useState(deviceInfo.name);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(30);

  const config = STATUS_CONFIG[limitCheck.reason as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.NO_SUBSCRIPTION;
  const StatusIcon = config.icon;

  // Auto-refresh countdown for PENDING_APPROVAL
  useEffect(() => {
    if (limitCheck.reason !== 'PENDING_APPROVAL' && !submitted) return;
    const timer = setInterval(() => {
      setAutoRefreshSeconds((s) => {
        if (s <= 1) {
          handleRefresh();
          return 30;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitCheck.reason, submitted]);

  const handleRefresh = async () => {
    setCheckingApproval(true);
    await onRefreshCheck();
    setCheckingApproval(false);
    setAutoRefreshSeconds(30);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) return;
    // Store chosen name in localStorage for future reference
    if (typeof window !== 'undefined') {
      localStorage.setItem('triwyn_device_name', deviceName.trim());
    }
    await onRegisterRequest(deviceName.trim(), notes.trim());
    setSubmitted(true);
  };

  const isPending = limitCheck.reason === 'PENDING_APPROVAL' || submitted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Modal card */}
      <div className={`w-full max-w-lg bg-white rounded-2xl shadow-2xl border ${config.borderColor} overflow-hidden`}>
        
        {/* Header band */}
        <div className={`bg-gradient-to-r ${config.bgGradient} px-6 pt-6 pb-4 border-b ${config.borderColor}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-white shadow-sm border ${config.borderColor}`}>
                <StatusIcon className={`h-5 w-5 ${config.iconColor}`} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{isPending && submitted ? 'Request Submitted' : config.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isPending && submitted
                    ? 'Your device registration request is pending approval.'
                    : config.subtitle}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${config.badgeBg}`}>
              {limitCheck.planName}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Device Quota Bar */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5"><Monitor className="h-3.5 w-3.5 text-slate-400" /> Registered Devices</span>
              <span className={`font-mono ${limitCheck.activeCount >= limitCheck.maxAllowed ? 'text-red-600' : 'text-emerald-600'}`}>
                {limitCheck.activeCount} / {limitCheck.maxAllowed}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  limitCheck.activeCount >= limitCheck.maxAllowed
                    ? 'bg-red-500'
                    : limitCheck.activeCount / limitCheck.maxAllowed > 0.7
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (limitCheck.activeCount / Math.max(1, limitCheck.maxAllowed)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Device Fingerprint Info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-0.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                <Hash className="h-3 w-3" /> Device ID
              </div>
              <div className="font-mono text-slate-700 text-[11px] truncate" title={deviceInfo.fingerprint}>
                {deviceInfo.fingerprint.slice(0, 18)}…
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-0.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                <Globe className="h-3 w-3" /> Hostname
              </div>
              <div className="font-mono text-slate-700 text-[11px] truncate">
                {deviceInfo.hostname || 'localhost'}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-0.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                <Cpu className="h-3 w-3" /> Device Type
              </div>
              <div className="font-semibold text-slate-700 text-[11px]">{deviceInfo.type.replace('_', ' ')}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-0.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                <Monitor className="h-3 w-3" /> Status
              </div>
              <div className={`font-bold text-[11px] uppercase ${config.iconColor}`}>{limitCheck.reason.replace(/_/g, ' ')}</div>
            </div>
          </div>

          {/* PENDING state: show countdown & instructions */}
          {isPending && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                <Clock className="h-4 w-4" />
                Waiting for administrator approval
              </div>
              <p className="text-[11px] text-blue-600 leading-relaxed">
                Your device registration request has been logged. An administrator must approve this device before you can log in.
                This screen will auto-refresh every 30 seconds.
              </p>
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-blue-500">
                  Auto-checking in <span className="font-bold font-mono">{autoRefreshSeconds}s</span>…
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={checkingApproval}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  {checkingApproval
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />
                  }
                  Check Now
                </button>
              </div>
            </div>
          )}

          {/* REGISTER FORM: Only for LIMIT_REACHED where admin can request */}
          {!isPending && config.canRequest && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Your plan ({limitCheck.planName})</strong> allows {limitCheck.maxAllowed} device{limitCheck.maxAllowed !== 1 ? 's' : ''}.
                You currently have {limitCheck.activeCount} active. You can request an additional device — an administrator will review and approve it.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Device Name / Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    required
                    maxLength={60}
                    placeholder="e.g. Checkout Counter 3, Warehouse Terminal"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Give this terminal a descriptive name for easy identification.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Request Notes <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="e.g. New checkout terminal added at Branch 2 on Oct 2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing || !deviceName.trim()}
                className="w-full h-10 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {isProcessing
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting Request…</>
                  : <><Shield className="h-4 w-4" /> Submit Device Registration Request</>
                }
              </button>
            </form>
          )}

          {/* Non-actionable statuses: SUSPENDED / REVOKED / EXPIRED */}
          {!isPending && !config.canRequest && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-3">
              <p className="font-bold text-slate-800">What should I do?</p>
              {limitCheck.reason === 'SUSPENDED' && (
                <p>Contact your system administrator to reinstate this device. Reason: <em>{limitCheck.currentDevice?.suspendedReason || 'Not specified'}</em></p>
              )}
              {limitCheck.reason === 'SUBSCRIPTION_EXPIRED' && (
                <div className="space-y-3">
                  <p className="text-red-700 font-bold">Your POS subscription has expired.</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    To renew or activate your POS, contact our verification team via WhatsApp.
                    After making the bank transfer, send your payment proof to receive your activation.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <a
                      href={`https://wa.me/94770802365?text=${encodeURIComponent(
                        `Hello, I would like to activate my POS.\nDevice ID: ${deviceInfo.fingerprint.slice(0, 16)}\nPlan: ${limitCheck.planName}\nPlease provide the payment details.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>WhatsApp: 0770802365</span>
                    </a>
                    <a
                      href={`https://wa.me/94750802353?text=${encodeURIComponent(
                        `Hello, I would like to activate my POS.\nDevice ID: ${deviceInfo.fingerprint.slice(0, 16)}\nPlan: ${limitCheck.planName}\nPlease provide the payment details.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-emerald-400 rounded-xl text-xs font-bold transition-all border border-slate-700"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>WhatsApp: 0750802353</span>
                    </a>
                  </div>
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={checkingApproval}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline"
                    >
                      {checkingApproval ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      <span>Already paid? Check License Status Now</span>
                    </button>
                  </div>
                </div>
              )}
              {limitCheck.reason === 'NO_SUBSCRIPTION' && (
                <div className="space-y-2">
                  <p>No active subscription found for this terminal.</p>
                  <p className="text-[11px] text-slate-500">Contact support to activate your terminal license.</p>
                  <div className="flex gap-2">
                    <a
                      href="https://wa.me/94770802365"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp 0770802365
                    </a>
                    <span>•</span>
                    <a
                      href="https://wa.me/94750802353"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp 0750802353
                    </a>
                  </div>
                </div>
              )}
              {limitCheck.reason === 'REVOKED' && (
                <p>This device has been permanently revoked. Contact your administrator to register a new device.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onCancelAndLogout}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Shield className="h-3 w-3" />
            Protected by Triwyn Licensing Engine v2
          </div>
        </div>
      </div>
    </div>
  );
}
