'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell, Check, Trash2, Volume2, VolumeX, Sparkles,
  Clock, Shield, AlertTriangle, Monitor, CheckCircle2,
  ExternalLink, ChevronRight, X, Search, Filter, Key,
  MessageCircle, PlusCircle, ArrowRight
} from 'lucide-react';
import {
  AdminNotificationService,
  AdminNotification,
  NotificationType
} from '@/services/notifications/AdminNotificationService';

interface RealtimeNotificationManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onQuickActivate?: (orgId?: string, businessName?: string) => void;
  onQuickExtend?: (orgId?: string) => void;
  onOpenWhatsApp?: (businessName?: string, orgId?: string) => void;
}

export function RealtimeNotificationManager({
  isOpen,
  onClose,
  onQuickActivate,
  onQuickExtend,
  onOpenWhatsApp,
}: RealtimeNotificationManagerProps) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'TRIALS' | 'EXPIRING' | 'ACTIVATIONS' | 'ALERTS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const refreshState = () => {
    setNotifications(AdminNotificationService.getNotifications());
    setUnreadCount(AdminNotificationService.getUnreadCount());
    setSoundEnabled(AdminNotificationService.isSoundEnabled());
  };

  useEffect(() => {
    refreshState();
    const unsubscribe = AdminNotificationService.subscribe(refreshState);
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    AdminNotificationService.setSoundEnabled(next);
    if (next) AdminNotificationService.playChime('HIGH');
  };


  const filtered = notifications.filter((n) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.metadata?.businessName || '').toLowerCase().includes(q) ||
        (n.metadata?.orgId || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (activeFilter === 'TRIALS') return n.type === 'TRIAL_REGISTERED';
    if (activeFilter === 'EXPIRING') return n.type === 'TRIAL_EXPIRING';
    if (activeFilter === 'ACTIVATIONS') return n.type === 'SUBSCRIPTION_ACTIVATED' || n.type === 'PAYMENT_PENDING';
    if (activeFilter === 'ALERTS') return n.type === 'ACCOUNT_SUSPENDED' || n.type === 'SYSTEM_ALERT' || n.type === 'DEVICE_CONNECTED';
    return true;
  });

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'TRIAL_REGISTERED':
        return <Clock className="h-4 w-4 text-cyan-400" />;
      case 'TRIAL_EXPIRING':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Live Notification Command Center</h3>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {unreadCount} unread • Auto-detecting registrations &amp; expirations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-slate-800 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
              title={soundEnabled ? 'Mute Alert Chime' : 'Enable Alert Chime'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Action buttons */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/60">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter notifications…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-bold">
            {[
              { id: 'ALL', label: 'All', count: notifications.length },
              { id: 'TRIALS', label: 'Trials', count: notifications.filter((n) => n.type === 'TRIAL_REGISTERED').length },
              { id: 'EXPIRING', label: 'Expiring', count: notifications.filter((n) => n.type === 'TRIAL_EXPIRING').length },
              { id: 'ACTIVATIONS', label: 'Activations', count: notifications.filter((n) => n.type === 'SUBSCRIPTION_ACTIVATED').length },
              { id: 'ALERTS', label: 'Alerts', count: notifications.filter((n) => n.type === 'ACCOUNT_SUSPENDED' || n.type === 'DEVICE_CONNECTED').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                  activeFilter === tab.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span className="opacity-70 text-[9px]">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications Feed */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-slate-700 mx-auto" />
              <div className="text-sm font-bold text-slate-400">All notifications cleared</div>
              <p className="text-xs text-slate-600">No events found matching your filter criteria.</p>
            </div>
          ) : (
            filtered.map((item) => {
              const isTrial = item.type === 'TRIAL_REGISTERED';
              const isExpiring = item.type === 'TRIAL_EXPIRING';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    item.read
                      ? 'bg-slate-950/60 border-slate-800/80 opacity-75'
                      : 'bg-slate-950 border-amber-500/40 shadow-lg shadow-black/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                        {getIcon(item.type)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-xs">{item.title}</h4>
                          {!item.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          )}
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">{item.message}</p>
                        
                        <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                          <span>{new Date(item.timestamp).toLocaleString()}</span>
                          {item.metadata?.businessName && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-emerald-400 font-bold">
                                {item.metadata.businessName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => AdminNotificationService.deleteNotification(item.id)}
                      className="p-1 text-slate-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Delete notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* IN-LINE ACTION BUTTONS */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {!item.read ? (
                        <button
                          onClick={() => AdminNotificationService.markAsRead(item.id)}
                          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold border border-slate-800 transition-colors cursor-pointer"
                        >
                          Mark Read
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-medium">Read</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(isTrial || isExpiring) && onQuickExtend && item.metadata?.orgId && (
                        <button
                          onClick={() => onQuickExtend(item.metadata?.orgId)}
                          className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle className="h-3 w-3" />
                          <span>+14d</span>
                        </button>
                      )}

                      {onQuickActivate && item.metadata?.orgId && (
                        <button
                          onClick={() => onQuickActivate(item.metadata?.orgId, item.metadata?.businessName)}
                          className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer"
                        >
                          <Key className="h-3 w-3" />
                          <span>Activate</span>
                        </button>
                      )}

                      {onOpenWhatsApp && (
                        <button
                          onClick={() => onOpenWhatsApp(item.metadata?.businessName, item.metadata?.orgId)}
                          className="p-1.5 bg-emerald-950 text-emerald-400 hover:bg-emerald-900 rounded-lg text-xs border border-emerald-800 transition-colors cursor-pointer"
                          title="Open WhatsApp chat"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => AdminNotificationService.markAllAsRead()}
              className="text-slate-400 hover:text-emerald-400 font-bold transition-colors cursor-pointer"
            >
              Mark All Read
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => AdminNotificationService.clearAll()}
              className="text-slate-400 hover:text-red-400 font-bold transition-colors cursor-pointer"
            >
              Clear All Feed
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close Panel
          </button>
        </div>

      </div>
    </div>
  );
}
