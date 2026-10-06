'use client';

import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, Search, Calendar, User, Building2, Clock } from 'lucide-react';
import { AdminAuthGuard, AdminHeader } from '@/components/auth/AdminAuthGuard';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('admin_audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
          if (!error && data && data.length > 0) {
            setLogs(data);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.warn('[Supabase Cloud] Failed to fetch audit logs:', err);
        }
      }

      await getLocalDb();
      const db = getRawSqlDb();
      const list: any[] = [];
      try {
        const stmt = db.prepare(`SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100`);
        while (stmt.step()) {
          list.push(stmt.getAsObject());
        }
        stmt.free();
      } catch (e) {
        console.warn('admin_audit_logs empty or not initialized:', e);
      }
      setLogs(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = logs.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      (l.action || '').toLowerCase().includes(q) ||
      (l.admin_email || '').toLowerCase().includes(q) ||
      (l.target_org_id || '').toLowerCase().includes(q) ||
      (l.reason || '').toLowerCase().includes(q)
    );
  });

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
        <AdminHeader
          title="Super Admin Audit Log"
          subtitle="Immutable chronological ledger of all administrative interventions, plan overrides, approvals, and security events"
          actions={
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          }
        />

        <main className="max-w-screen-xl mx-auto px-6 pt-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="text-xs text-slate-400">
              Showing <span className="font-bold text-white">{filtered.length}</span> audit records
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search action, admin, org…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-5 font-bold">Timestamp</th>
                    <th className="py-3 px-4 font-bold">Admin User</th>
                    <th className="py-3 px-4 font-bold">Action</th>
                    <th className="py-3 px-4 font-bold">Target Organization</th>
                    <th className="py-3 px-4 font-bold">Details / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 space-y-2">
                        <Shield className="h-8 w-8 text-amber-500/80 mx-auto" />
                        <div className="text-sm font-black text-white uppercase tracking-wide">NO AUDIT LOGS YET</div>
                        <div className="text-xs text-slate-400">Administrative and security events will be recorded here.</div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div>{log.admin_email}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{log.admin_role}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900/60">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                          {log.target_org_id || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-xs">
                          {log.reason || log.new_state || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </AdminAuthGuard>
  );
}
