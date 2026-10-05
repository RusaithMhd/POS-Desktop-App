'use client';

import React, { useState } from 'react';
import { Lock, KeyRound, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import bcrypt from 'bcryptjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ManagerPinModalProps {
  isOpen: boolean;
  actionTitle: string;
  actionDescription?: string;
  onClose: () => void;
  onAuthorized: (managerUser: any) => void;
}

export function ManagerPinModal({ isOpen, actionTitle, actionDescription, onClose, onAuthorized }: ManagerPinModalProps) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg('Please enter manager authorization PIN.');
      return;
    }

    try {
      const db = getRawSqlDb();
      const stmt = db.prepare(
        `SELECT u.*, r.name as role_name FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.is_active = 1 AND r.name IN ('ADMIN', 'MANAGER') AND u.pin_hash IS NOT NULL`
      );

      let authorizedUser: any = null;
      while (stmt.step()) {
        const u = stmt.getAsObject();
        if (bcrypt.compareSync(pin.trim(), u.pin_hash as string)) {
          authorizedUser = u;
          break;
        }
      }
      stmt.free();

      if (!authorizedUser) {
        setErrorMsg('Invalid Manager PIN. Authorization denied.');
        setPin('');
        return;
      }

      setPin('');
      setErrorMsg(null);
      onAuthorized(authorizedUser);
    } catch (err) {
      console.error('PIN verification error:', err);
      setErrorMsg('Failed to verify PIN.');
    }
  };

  const handleNumpadClick = (num: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-extrabold text-slate-900">Manager Authorization</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1 text-xs">
          <div className="font-bold text-slate-900">{actionTitle}</div>
          <div className="text-slate-500">{actionDescription || 'Enter a Manager or Admin PIN code to authorize this action.'}</div>
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" /> {errorMsg}
          </div>
        )}

        {/* PIN Input Display */}
        <form onSubmit={handleVerifyPin} className="space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN (e.g. 1234)"
              className="pl-9 text-center font-mono font-black text-lg tracking-widest bg-slate-50 border-slate-300 h-11"
            />
          </div>

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumpadClick(num)}
                className="h-10 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-base rounded-lg transition-colors cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin('')}
              className="h-10 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleNumpadClick('0')}
              className="h-10 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-base rounded-lg cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPin((prev) => prev.slice(0, -1))}
              className="h-10 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
            >
              ⌫
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs font-semibold">
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5">
              Authorize
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
