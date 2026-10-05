'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock, Shield, AlertTriangle, Monitor, CheckCircle2,
  Sparkles, X, ChevronRight, MessageCircle, Key, ArrowRight
} from 'lucide-react';
import {
  AdminNotificationService,
  AdminNotification,
  NotificationType
} from '@/services/notifications/AdminNotificationService';

interface LiveNotificationToastProps {
  onQuickActivate?: (orgId?: string, businessName?: string) => void;
  onQuickExtend?: (orgId?: string) => void;
  onOpenWhatsApp?: (businessName?: string, orgId?: string) => void;
}

export function LiveNotificationToast({
  onQuickActivate,
  onQuickExtend,
  onOpenWhatsApp,
}: LiveNotificationToastProps) {
  const [activeToast, setActiveToast] = useState<AdminNotification | null>(null);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const unsubscribe = AdminNotificationService.onToast((notif) => {
      setActiveToast(notif);
      setProgress(100);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!activeToast || isPaused) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 2) {
          clearInterval(timer);
          setActiveToast(null);
          return 0;
        }
        return prev - 2;
      });
    }, 120);

    return () => clearInterval(timer);
  }, [activeToast, isPaused]);

  if (!activeToast) return null;

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'TRIAL_REGISTERED':
      case 'TRIAL_EXPIRING':
        return <Clock className="h-5 w-5 text-cyan-400" />;
      case 'SUBSCRIPTION_ACTIVATED':
        return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      case 'PAYMENT_PENDING':
        return <Sparkles className="h-5 w-5 text-amber-400" />;
      case 'DEVICE_CONNECTED':
        return <Monitor className="h-5 w-5 text-purple-400" />;
      case 'ACCOUNT_SUSPENDED':
        return <AlertTriangle className="h-5 w-5 text-red-400" />;
      default:
        return <Shield className="h-5 w-5 text-blue-400" />;
    }
  };

  const isTrial = activeToast.type === 'TRIAL_REGISTERED';
  const isExpiring = activeToast.type === 'TRIAL_EXPIRING';

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md w-full animate-in slide-in-from-bottom-5 fade-in duration-200"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl shadow-black/80 space-y-3 relative overflow-hidden">
        
        {/* Animated Countdown Progress Bar */}
        <div
          className="absolute top-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-400 to-cyan-400 transition-all ease-linear"
          style={{ width: `${progress}%` }}
        />

        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
              {getIcon(activeToast.type)}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Realtime Alert</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <h4 className="text-sm font-black text-white leading-tight">{activeToast.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">{activeToast.message}</p>
            </div>
          </div>

          <button
            onClick={() => setActiveToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Actions Row directly inside toast */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
          {activeToast.metadata?.businessName && (
            <span className="text-[10px] font-mono font-bold text-slate-400 truncate max-w-[130px]">
              {activeToast.metadata.businessName}
            </span>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            {(isTrial || isExpiring) && onQuickExtend && activeToast.metadata?.orgId && (
              <button
                onClick={() => {
                  onQuickExtend(activeToast.metadata?.orgId);
                  setActiveToast(null);
                }}
                className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                +14d Trial
              </button>
            )}

            {onQuickActivate && activeToast.metadata?.orgId && (
              <button
                onClick={() => {
                  onQuickActivate(activeToast.metadata?.orgId, activeToast.metadata?.businessName);
                  setActiveToast(null);
                }}
                className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer"
              >
                <Key className="h-3 w-3" />
                <span>Activate</span>
              </button>
            )}

            {onOpenWhatsApp && (
              <button
                onClick={() => {
                  onOpenWhatsApp(activeToast.metadata?.businessName, activeToast.metadata?.orgId);
                  setActiveToast(null);
                }}
                className="p-1.5 bg-emerald-950 text-emerald-400 hover:bg-emerald-900 rounded-lg text-xs border border-emerald-800/80 transition-all cursor-pointer"
                title="WhatsApp merchant"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
