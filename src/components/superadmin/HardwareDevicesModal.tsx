'use client';

import React, { useState, useEffect } from 'react';
import {
  Monitor, Shield, CheckCircle2, Ban, Plus, RefreshCw, X, Laptop, Smartphone
} from 'lucide-react';
import { getRawSqlDb } from '@/infrastructure/database/sqlite/db';

interface HardwareDevicesModalProps {
  organizationId: string;
  businessName: string;
  onClose: () => void;
}

export function HardwareDevicesModal({ organizationId, businessName, onClose }: HardwareDevicesModalProps) {
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const loadDevices = () => {
    setIsLoading(true);
    try {
      const db = getRawSqlDb();
      const list: any[] = [];
      const stmt = db.prepare(`SELECT * FROM registered_devices WHERE organization_id = ? ORDER BY registered_at DESC`);
      stmt.bind([organizationId]);
      while (stmt.step()) {
        list.push(stmt.getAsObject());
      }
      stmt.free();
      setDevices(list);
    } catch (e) {
      console.error('Failed to load devices:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [organizationId]);

  const handleToggleDeviceStatus = (deviceId: string, currentStatus: string) => {
    try {
      const db = getRawSqlDb();
      const newStatus = currentStatus === 'ACTIVE' ? 'REVOKED' : 'ACTIVE';
      db.run(`UPDATE registered_devices SET status = ? WHERE id = ?`, [newStatus, deviceId]);
      loadDevices();
    } catch (e) {
      alert('Failed to update terminal status');
    }
  };

  const handleAddTerminal = () => {
    if (!newDeviceName.trim()) return;
    try {
      const db = getRawSqlDb();
      const id = `dev-${Date.now()}`;
      const code = `TERM-${Math.floor(100 + Math.random() * 900)}`;
      db.run(
        `INSERT INTO registered_devices (id, organization_id, device_name, device_type, terminal_code, status, registered_at)
         VALUES (?, ?, ?, 'DESKTOP_POS', ?, 'ACTIVE', datetime('now'))`,
        [id, organizationId, newDeviceName.trim(), code]
      );
      setNewDeviceName('');
      setIsAdding(false);
      loadDevices();
    } catch (e) {
      alert('Failed to add device terminal');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Authorized POS Terminals</h3>
              <p className="text-xs text-slate-400">{businessName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Terminals List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              Active Terminals ({devices.length})
            </span>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Authorize New Terminal</span>
            </button>
          </div>

          {isAdding && (
            <div className="p-3 bg-slate-950 rounded-2xl border border-purple-500/30 space-y-2">
              <label className="text-[11px] font-bold text-slate-300">Terminal Nickname / Counter</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Counter 1 - Front Cashier"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="flex-1 h-9 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleAddTerminal}
                  className="h-9 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Authorize
                </button>
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/80 rounded-2xl bg-slate-950 border border-slate-800/80">
            {devices.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No hardware terminals paired yet. The desktop app will automatically register on first cashier login.
              </div>
            ) : (
              devices.map((dev) => {
                const isActive = dev.status === 'ACTIVE';
                return (
                  <div key={dev.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-purple-400">
                        <Laptop className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white">{dev.device_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Code: {dev.terminal_code || 'TERM-01'} • {new Date(dev.registered_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                        isActive
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : 'bg-red-950 text-red-400 border-red-800'
                      }`}>
                        {dev.status}
                      </span>
                      <button
                        onClick={() => handleToggleDeviceStatus(dev.id, dev.status)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 text-red-400 border-slate-800 hover:bg-red-950'
                            : 'bg-slate-900 text-emerald-400 border-slate-800 hover:bg-emerald-950'
                        }`}
                      >
                        {isActive ? 'Revoke' : 'Authorize'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
