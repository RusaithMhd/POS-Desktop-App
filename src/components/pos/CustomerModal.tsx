'use client';

import React, { useState, useEffect } from 'react';
import { Search, User, UserPlus, Check, X, Phone, Mail, Award, ArrowLeft, Plus } from 'lucide-react';
import { getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import { Customer, useCartStore } from '@/features/sales/useCartStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerModal({ isOpen, onClose }: CustomerModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { customer: currentCustomer, setCustomer } = useCartStore();

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
      setIsCreating(false);
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setNewName('');
    setNewPhone('');
    setNewCreditLimit('');
    setErrorMsg(null);
  };

  const loadCustomers = () => {
    try {
      const db = getRawSqlDb();
      const stmt = db.prepare('SELECT * FROM customers ORDER BY name ASC');
      const list: Customer[] = [];
      while (stmt.step()) {
        const r = stmt.getAsObject();
        list.push({
          id: r.id as string,
          name: r.name as string,
          phone: (r.phone as string) || '',
          creditLimit: (r.credit_limit as number) || 0,
          currentCredit: (r.current_credit as number) || 0,
          loyaltyPoints: (r.loyalty_points as number) || 0,
        });
      }
      stmt.free();
      setCustomers(list);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCustomer = (c: Customer | null) => {
    setCustomer(c);
    onClose();
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMsg('Customer name is required.');
      return;
    }

    try {
      const db = getRawSqlDb();
      const now = new Date().toISOString();
      const newId = `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const creditLimit = parseFloat(newCreditLimit) || 0;

      db.run(
        `INSERT INTO customers (id, business_id, name, phone, email, tax_id, credit_limit, current_credit, loyalty_points, created_at, updated_at)
         VALUES (?, 'biz-001', ?, ?, null, null, ?, 0, 0, ?, ?)`,
        [newId, newName.trim(), newPhone.trim() || null, creditLimit, now, now]
      );

      saveLocalDbState();

      const createdCustomer: Customer = {
        id: newId,
        name: newName.trim(),
        phone: newPhone.trim() || '',
        creditLimit,
        currentCredit: 0,
        loyaltyPoints: 0,
      };

      setCustomer(createdCustomer);
      onClose();
    } catch (err: any) {
      console.error('Failed to create customer:', err);
      setErrorMsg(err?.message || 'Failed to create customer record.');
    }
  };

  if (!isOpen) return null;

  const filtered = customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    return !q || c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            {isCreating ? (
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-slate-700 mr-1 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <User className="h-5 w-5 text-emerald-600" />
            )}
            <h3 className="text-base font-extrabold text-slate-900">
              {isCreating ? 'Create New Customer' : 'Select Customer'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsCreating(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-2.5 gap-1 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add Customer
              </Button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* INLINE CREATE FORM MODE */}
        {isCreating ? (
          <form onSubmit={handleCreateCustomer} className="space-y-3 pt-1">
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Full Name *</label>
              <Input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Eleanor Vance"
                className="h-9 text-xs font-semibold bg-slate-50 border-slate-300"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Phone Number</label>
              <Input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="e.g. +94 77 234 5678"
                className="h-9 text-xs font-semibold bg-slate-50 border-slate-300 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Account Credit Limit (LKR)</label>
              <Input
                type="number"
                value={newCreditLimit}
                onChange={(e) => setNewCreditLimit(e.target.value)}
                placeholder="0.00"
                className="h-9 text-xs font-semibold bg-slate-50 border-slate-300 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreating(false)}
                className="text-xs font-semibold"
              >
                Back to List
              </Button>
              <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                Save & Select Customer
              </Button>
            </div>
          </form>
        ) : (
          /* CUSTOMER SELECTION LIST MODE */
          <>
            {/* Walk-In Customer Option */}
            <div
              onClick={() => handleSelectCustomer(null)}
              className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                !currentCustomer
                  ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-slate-500" />
                <div>
                  <div className="text-xs font-bold">Walk-in Customer (Default)</div>
                  <div className="text-[10px] text-slate-500">Standard retail transaction without account tracking</div>
                </div>
              </div>
              {!currentCustomer && <Check className="h-4 w-4 text-emerald-600" />}
            </div>

            {/* Search Field */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer name, phone, or email..."
                className="pl-9 h-9 text-xs font-semibold bg-slate-50 border-slate-300"
              />
            </div>

            {/* Customer List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium space-y-2">
                  <p>No matching customers found in local records.</p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      resetForm();
                      setIsCreating(true);
                    }}
                    className="bg-emerald-600 text-white font-bold text-xs"
                  >
                    + Add New Customer
                  </Button>
                </div>
              ) : (
                filtered.map((c) => {
                  const isSelected = currentCustomer?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-all ${
                        isSelected ? 'bg-emerald-50 border-l-4 border-l-emerald-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                          <span>{c.name}</span>
                          {c.loyaltyPoints > 0 && (
                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-200 font-bold px-1.5">
                              <Award className="h-2.5 w-2.5 mr-0.5" /> {c.loyaltyPoints} pts
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5 font-mono">
                          {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-emerald-600" />}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsCreating(true);
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 p-0 h-auto"
              >
                + Create New Customer
              </Button>
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs font-semibold">
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
