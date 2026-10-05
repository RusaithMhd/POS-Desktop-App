'use client';

import React, { useState } from 'react';
import { 
  PauseCircle, 
  PlayCircle, 
  Trash2, 
  Search, 
  X, 
  Clock, 
  User, 
  ShoppingBag, 
  AlertTriangle 
} from 'lucide-react';
import { useCartStore, HeldSale } from '@/features/sales/useCartStore';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HeldSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResume: (heldId: string) => void;
}

export function HeldSalesModal({ isOpen, onClose, onSelectResume }: HeldSalesModalProps) {
  const { heldSales, deleteHeldSale, clearAllHeldSales } = useCartStore();
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredHolds = heldSales.filter((h) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const matchId = h.id.toLowerCase().includes(q);
    const matchCustomer = h.customer?.name.toLowerCase().includes(q);
    const matchItem = h.items.some((i) => i.product.name.toLowerCase().includes(q));
    return matchId || matchCustomer || matchItem;
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] font-sans">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-amber-500 flex items-center justify-center text-slate-950 font-black">
              <PauseCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">Held Sales Manager</h3>
              <p className="text-[10px] text-slate-400">
                {heldSales.length} {heldSales.length === 1 ? 'sale currently on hold' : 'sales currently on hold'} [F5]
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by Hold ID, customer name or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-white border-slate-300 text-xs text-slate-900"
            />
          </div>
          {heldSales.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('Are you sure you want to clear ALL held sales?')) {
                  clearAllHeldSales();
                }
              }}
              className="text-xs font-bold text-red-600 hover:bg-red-50 border-red-200 h-9"
            >
              Clear All ({heldSales.length})
            </Button>
          )}
        </div>

        {/* Held Sales List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100">
          {filteredHolds.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <PauseCircle className="h-12 w-12 text-slate-300 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-500">No held sales found</p>
              <p className="text-[11px] text-slate-400">Press F4 during checkout to hold a sale.</p>
            </div>
          ) : (
            filteredHolds.map((h) => {
              const totalItems = h.items.reduce((sum, item) => sum + item.quantity, 0);
              const orderTotal = h.items.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discountAmount, 0);

              return (
                <div
                  key={h.id}
                  className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs hover:border-amber-400 transition-all flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-xs text-slate-900 bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                        {h.id}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3 text-slate-400" /> {h.timestamp}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-xs font-bold text-slate-500">{totalItems} items</span>
                      <span className="text-sm font-black text-emerald-700">{formatCurrency(orderTotal)}</span>
                    </div>
                  </div>

                  {/* Customer & Item Preview */}
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{h.customer?.name || 'Walk-in Customer'}</span>
                    </div>

                    <div className="text-[11px] text-slate-500 truncate max-w-[280px]">
                      {h.items.map((i) => `${i.product.name} (x${i.quantity})`).join(', ')}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteHeldSale(h.id)}
                      className="h-8 text-xs font-bold text-red-600 hover:bg-red-50 border-slate-200"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Discard
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        onSelectResume(h.id);
                        onClose();
                      }}
                      className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 shadow-xs"
                    >
                      <PlayCircle className="h-3.5 w-3.5 mr-1" /> Resume This Order
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
