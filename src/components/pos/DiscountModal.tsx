'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Lock, Unlock, Percent, DollarSign, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { AuthService } from '@/features/auth/AuthService';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  currentDiscount: number;
  onApplyDiscount: (amount: number) => void;
}

export function DiscountModal({
  isOpen,
  onClose,
  subtotal,
  currentDiscount,
  onApplyDiscount,
}: DiscountModalProps) {
  const [mode, setMode] = useState<'percent' | 'fixed'>('percent');
  const [percentValue, setPercentValue] = useState<string>('10');
  const [fixedValue, setFixedValue] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(true); // Pre-authorized for cashier/admin
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      // If there's an existing discount, initialize fixedValue
      if (currentDiscount > 0) {
        setFixedValue(currentDiscount.toString());
        setMode('fixed');
      }
    }
  }, [isOpen, currentDiscount]);

  if (!isOpen) return null;

  const calculateDiscountAmount = (): number => {
    if (mode === 'percent') {
      const p = parseFloat(percentValue);
      if (isNaN(p) || p <= 0) return 0;
      return Math.min(subtotal, (subtotal * p) / 100);
    } else {
      const f = parseFloat(fixedValue);
      if (isNaN(f) || f <= 0) return 0;
      return Math.min(subtotal, f);
    }
  };

  const discountAmount = calculateDiscountAmount();
  const netTotal = Math.max(0, subtotal - discountAmount);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (discountAmount < 0) {
      setError('Invalid discount amount.');
      return;
    }

    onApplyDiscount(discountAmount);
    onClose();
  };

  const handleRemoveDiscount = () => {
    onApplyDiscount(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-emerald-500 flex items-center justify-center text-slate-950 font-black">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">POS Discount Manager</h3>
              <p className="text-[10px] text-slate-400">Order Level Discount & Special Concessions [F8]</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Subtotal Summary Badge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between font-mono text-xs">
            <span className="text-slate-500 font-sans font-bold">Cart Subtotal:</span>
            <span className="font-extrabold text-slate-900 text-sm">{formatCurrency(subtotal)}</span>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode('percent')}
              className={`py-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'percent'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Percent className="h-3.5 w-3.5" /> Percentage (%)
            </button>
            <button
              type="button"
              onClick={() => setMode('fixed')}
              className={`py-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'fixed'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" /> Fixed Amount (LKR)
            </button>
          </div>

          {/* Mode-specific Controls */}
          {mode === 'percent' ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700">Quick Percentage Preset</label>
              <div className="grid grid-cols-4 gap-2">
                {['5', '10', '15', '20'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPercentValue(p)}
                    className={`py-2 rounded-lg border text-xs font-extrabold font-mono transition-all cursor-pointer ${
                      percentValue === p
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-slate-700">Custom Percentage (%)</label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={percentValue}
                    onChange={(e) => setPercentValue(e.target.value)}
                    placeholder="e.g. 7.5"
                    className="pr-8 font-mono font-bold text-slate-900 h-10 text-sm"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Fixed Concession Amount (LKR)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={subtotal}
                value={fixedValue}
                onChange={(e) => setFixedValue(e.target.value)}
                placeholder="Enter discount amount in LKR"
                className="font-mono font-bold text-slate-900 h-10 text-sm"
              />
            </div>
          )}

          {/* Live Discount Impact Summary */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1 font-mono text-xs">
            <div className="flex justify-between text-slate-600 font-sans font-medium">
              <span>Discount Amount:</span>
              <span className="font-extrabold text-emerald-700">-{formatCurrency(discountAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-900 font-sans font-bold pt-1 border-t border-emerald-200/80">
              <span>Revised Net Subtotal:</span>
              <span className="font-extrabold text-slate-900">{formatCurrency(netTotal)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            {currentDiscount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemoveDiscount}
                className="text-xs font-bold text-red-600 hover:bg-red-50 border-red-200"
              >
                Remove Discount
              </Button>
            )}
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm h-10"
            >
              Apply Discount Now
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
