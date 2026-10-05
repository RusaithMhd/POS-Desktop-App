'use client';

import React, { useState, useEffect } from 'react';
import { realtimeService, useRealtimeEvent } from '@/services/realtime/RealtimeService';
import { SessionService, UserSessionInfo } from '@/services/session/SessionService';
import { getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { Users, Wifi, Printer, CheckCircle2, ShieldAlert, Monitor } from 'lucide-react';

export function SystemStatusBar() {
  const [connectionStatus, setConnectionStatus] = useState<'ONLINE' | 'RECONNECTING' | 'OFFLINE'>('ONLINE');
  const [activeSessions, setActiveSessions] = useState<UserSessionInfo[]>([]);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [pendingPrints, setPendingPrints] = useState(0);

  const loadSessionsAndStatus = () => {
    try {
      const db = getRawSqlDb();
      const sessions = SessionService.getActiveSessions(db);
      setActiveSessions(sessions);

      // Check pending print jobs
      const stmt = db.prepare(`SELECT COUNT(*) as cnt FROM print_jobs WHERE status = 'QUEUED' OR status = 'PRINTING'`);
      if (stmt.step()) {
        setPendingPrints((stmt.getAsObject().cnt as number) || 0);
      }
      stmt.free();
    } catch (err) {
      // DB not ready yet
    }
  };

  useEffect(() => {
    setConnectionStatus(realtimeService.getConnectionStatus());
    loadSessionsAndStatus();
  }, []);

  useRealtimeEvent('CONNECTION_STATUS_CHANGED', (evt) => {
    if (evt.data?.status) setConnectionStatus(evt.data.status);
  });

  useRealtimeEvent('ACTIVE_USERS_UPDATED', () => {
    loadSessionsAndStatus();
  });

  useRealtimeEvent('PRINT_JOB_QUEUED', () => {
    loadSessionsAndStatus();
  });

  useRealtimeEvent('PRINT_JOB_UPDATED', () => {
    loadSessionsAndStatus();
  });

  useRealtimeEvent('SALE_CREATED', () => {
    loadSessionsAndStatus();
  });

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-1 bg-slate-900 text-slate-200 text-xs rounded-lg shadow-sm border border-slate-800">
        {/* Connection Status */}
        <div className="flex items-center gap-1.5" title="Multi-User Network Connection Status">
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'ONLINE'
                ? 'bg-emerald-400 animate-pulse'
                : connectionStatus === 'RECONNECTING'
                ? 'bg-amber-400'
                : 'bg-rose-500'
            }`}
          />
          <span className="font-medium text-[11px] tracking-wide">
            {connectionStatus === 'ONLINE' ? 'Online' : connectionStatus === 'RECONNECTING' ? 'Reconnecting...' : 'Offline'}
          </span>
        </div>

        <div className="w-[1px] h-3 bg-slate-700" />

        {/* Active Sessions Counter */}
        <button
          onClick={() => {
            loadSessionsAndStatus();
            setShowSessionsModal(true);
          }}
          className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors text-[11px]"
          title="Click to view all active user sessions"
        >
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{activeSessions.length} Active Users</span>
        </button>

        {/* Pending Print Jobs Indicator */}
        {pendingPrints > 0 && (
          <>
            <div className="w-[1px] h-3 bg-slate-700" />
            <div className="flex items-center gap-1.5 text-amber-400 animate-pulse text-[11px]">
              <Printer className="w-3.5 h-3.5" />
              <span>{pendingPrints} Print Job{pendingPrints > 1 ? 's' : ''}</span>
            </div>
          </>
        )}
      </div>

      {/* Active User Sessions Modal */}
      {showSessionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-sm">Active Multi-User Sessions</h3>
              </div>
              <button
                onClick={() => setShowSessionsModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-slate-500 mb-4">
                Real-time connection monitoring across all active POS terminals, desktop dashboards, and warehouse tablets.
              </p>

              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 text-emerald-400 font-bold text-xs flex items-center justify-center">
                        {session.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-900">{session.fullName}</span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded">
                            {session.roleName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Monitor className="w-3 h-3 text-slate-400" />
                            {session.terminalCode} ({session.deviceInfo})
                          </span>
                          {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium justify-end">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Online</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Active: {new Date(session.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowSessionsModal(false)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
