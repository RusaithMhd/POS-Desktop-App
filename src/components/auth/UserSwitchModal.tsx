'use client';

import React, { useState, useEffect } from 'react';
import { UserCheck, Shield, KeyRound, X, Check, Lock, ArrowRight, ShieldAlert } from 'lucide-react';
import { AuthService, UserSession } from '@/features/auth/AuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import bcrypt from 'bcryptjs';
import { getRawSqlDb } from '@/infrastructure/database/sqlite/db';

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitched: (newSession: UserSession) => void;
}

export function UserSwitchModal({ isOpen, onClose, onSwitched }: UserSwitchModalProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setPin('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  const loadUsers = () => {
    try {
      const raw = getRawSqlDb();
      const stmt = raw.prepare(
        'SELECT u.*, r.name as role_name, r.description as role_desc FROM users u JOIN roles r ON u.role_id = r.id WHERE u.is_active = 1 ORDER BY r.name ASC, u.full_name ASC'
      );
      const list: any[] = [];
      while (stmt.step()) {
        list.push(stmt.getAsObject());
      }
      stmt.free();
      setUsers(list);
      if (list.length > 0) setSelectedUser(list[0]);
    } catch (err) {
      console.error('Failed to load user accounts for switch:', err);
    }
  };

  if (!isOpen) return null;

  const handleConfirmSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    // Verify PIN if set, or proceed with quick switch
    if (selectedUser.pin_hash && pin.trim()) {
      const isValid = bcrypt.compareSync(pin.trim(), selectedUser.pin_hash);
      if (!isValid) {
        setErrorMsg('Invalid PIN code for selected user.');
        return;
      }
    }

    try {
      const permissions = AuthService.getUserPermissions(selectedUser.role_id);
      const newSession: UserSession = {
        id: selectedUser.id,
        username: selectedUser.username,
        fullName: selectedUser.full_name,
        roleName: selectedUser.role_name,
        roleId: selectedUser.role_id,
        businessId: selectedUser.business_id || 'biz-001',
        branchId: selectedUser.branch_id || 'branch-001',
        permissions,
      };

      AuthService.saveSession(newSession);
      setErrorMsg(null);
      setPin('');
      onSwitched(newSession);
      onClose();
    } catch (err: any) {
      console.error('Failed to switch user:', err);
      setErrorMsg('Error switching user session.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
      <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-extrabold text-slate-900">Quick User / Role Switch</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Switch active operator account to test role permissions or perform cashier shift handovers.
        </p>

        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" /> {errorMsg}
          </div>
        )}

        {/* User Selection List */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {users.map((u) => {
            const isSelected = selectedUser?.id === u.id;
            return (
              <div
                key={u.id}
                onClick={() => {
                  setSelectedUser(u);
                  setErrorMsg(null);
                }}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    u.role_name === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800'
                      : u.role_name === 'MANAGER'
                      ? 'bg-blue-100 text-blue-800'
                      : u.role_name === 'CASHIER'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {u.full_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      {u.full_name}
                      <span className="text-[10px] text-slate-400 font-mono">({u.username})</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{u.role_desc || u.role_name}</div>
                  </div>
                </div>

                <Badge variant="outline" className={`font-extrabold uppercase text-[9px] px-2 py-0.5 ${
                  u.role_name === 'ADMIN'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : u.role_name === 'MANAGER'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : u.role_name === 'CASHIER'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {u.role_name}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* PIN verification if selected user has PIN */}
        <form onSubmit={handleConfirmSwitch} className="space-y-4 pt-2 border-t border-slate-100">
          {selectedUser?.pin_hash && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Enter User PIN Code (Optional for Quick Switch)</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="e.g. 1234 or leave blank"
                  className="pl-9 text-xs font-mono bg-slate-50 border-slate-300"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs font-semibold">
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 px-5 cursor-pointer">
              Switch Account <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
