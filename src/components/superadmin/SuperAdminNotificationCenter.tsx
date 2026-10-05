'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bell, Check, Trash2, Volume2, VolumeX, Sparkles,
  Clock, Shield, AlertTriangle, Monitor, CheckCircle2,
  ExternalLink, ChevronRight, X
} from 'lucide-react';
import {
  AdminNotificationService,
  AdminNotification,
  NotificationType
} from '@/services/notifications/AdminNotificationService';

export function SuperAdminNotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'TRIALS' | 'ACTIVATIONS' | 'ALERTS'>('ALL');
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshState = () => {
    setNotifications(AdminNotificationService.getNotifications());
    setUnreadCount(AdminNotificationService.getUnreadCount());
    setSoundEnabled(AdminNotificationService.isSoundEnabled());
  };

  useEffect(() => {
    refreshState();
    const unsubscribe = AdminNotificationService.subscribe(refreshState);

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    AdminNotificationService.setSoundEnabled(next);
    if (next) {
      AdminNotificationService.playChime('HIGH');
    }
  };

  const handleTestAlert = () => {
    AdminNotificationService.addNotification({
      type: 'TRIAL_REGISTERED',
      title: 'Realtime Alert Test',
      message: 'Real-time alert verification completed. Notification engine operational.',
      priority: 'HIGH',
      metadata: { businessName: 'Test Commercial Retail' },
    });
  };

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'TRIALS') return n.type === 'TRIAL_REGISTERED' || n.type === 'TRIAL_EXPIRING';
    if (activeFilter === 'ACTIVATIONS') return n.type === 'SUBSCRIPTION_ACTIVATED' || n.type === 'PAYMENT_PENDING';
    if (activeFilter === 'ALERTS') return n.type === 'ACCOUNT_SUSPENDED' || n.type === 'SYSTEM_ALERT';
    return true;
  });

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'TRIAL_REGISTERED':
      case 'TRIAL_EXPIRING':
        return <Clock className="h-4 w-4 text-cyan-400" />;
      case 'SUBSCRIPTION_ACTIVATED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'PAYMENT_PENDING':
        return <Sparkles className="h-4 w-4 text-amber-400" />;
      case 'DEVICE_CONNECTED':
        return <Monitor className="h-4 w-4 text-purple-400" />;
      case 'ACCOUNT_SUSPENDED':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      default:
        return <Shield className="h-4 w-4 text-blue-400" />;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const ms = Date.now() - new Date(isoString).getTime();
      const sec = Math.floor(ms / 1000);
      if (sec < 60) return 'Just now';
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hrs = Math.floor(min / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return new Date(isoString).toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border-slate-700'
        }`}
        title="Realtime Super Admin Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center shadow-lg shadow-red-500/50 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-over / Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
          
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <h3 className="font-black text-xs text-white uppercase tracking-wider">Realtime Live Alerts</h3>
              <span className="text-[10px] bg-emerald-950/90 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-800/80">
                Live
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToggleSound}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  soundEnabled ? 'text-emerald-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'
                }`}
                title={soundEnabled ? 'Mute Chime' : 'Enable Chime'}
              >
                {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/60 flex items-center gap-1 overflow-x-auto text-[10px] font-bold">
            {(['ALL', 'TRIALS', 'ACTIVATIONS', 'ALERTS'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  activeFilter === filter
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter === 'ALL' ? `All (${notifications.length})` : filter}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-800/60 max-h-80 text-xs">
            {filtered.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-xs font-semibold">All caught up!</p>
                <p className="text-slate-600 text-[11px]">No alerts matching this filter.</p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => AdminNotificationService.markAsRead(item.id)}
                  className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                    item.read
                      ? 'bg-slate-900/40 hover:bg-slate-800/40 opacity-70'
                      : 'bg-slate-900/90 hover:bg-slate-800/80 border-l-2 border-l-amber-400'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-white text-xs truncate">{item.title}</span>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatTime(item.timestamp)}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-2">{item.message}</p>
                    {item.metadata?.businessName && (
                      <div className="pt-0.5 flex items-center gap-1.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-bold">
                          {item.metadata.businessName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-2.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => AdminNotificationService.markAllAsRead()}
                className="text-slate-400 hover:text-emerald-400 font-bold transition-colors cursor-pointer"
              >
                Mark Read
              </button>
              <span className="text-slate-700">•</span>
              <button
                onClick={() => AdminNotificationService.clearAll()}
                className="text-slate-400 hover:text-red-400 font-bold transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>

            <button
              onClick={handleTestAlert}
              className="text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer text-[10px] flex items-center gap-1"
            >
              <span>Test Alert</span>
              <Sparkles className="h-3 w-3" />
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
