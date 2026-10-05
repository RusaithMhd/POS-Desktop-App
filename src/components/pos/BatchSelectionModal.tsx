'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Search, X, Check, Layers, AlertTriangle } from 'lucide-react';
import { getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteInventoryBatchRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { InventoryBatchEntity } from '@/domain/entities/InventoryBatch';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface BatchSelectionModalProps {
  isOpen: boolean;
  productId: string;
  productName: string;
  selectedBatchId?: string;
  onClose: () => void;
  onSelectBatch: (batchId?: string, batchNumber?: string, unitPrice?: number) => void;
}

export function BatchSelectionModal({
  isOpen,
  productId,
  productName,
  selectedBatchId,
  onClose,
  onSelectBatch,
}: BatchSelectionModalProps) {
  const [batches, setBatches] = useState<InventoryBatchEntity[]>([]);
  const [search, setSearch] = useState('');
  const [tempBatchId, setTempBatchId] = useState<string | undefined>(selectedBatchId);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && productId) {
      loadBatches();
      setTempBatchId(selectedBatchId);
    }
  }, [isOpen, productId, selectedBatchId]);

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const repo = new SQLiteInventoryBatchRepository();
      const list = await repo.getBatchesByProductId(productId);
      setBatches(list.filter((b) => b.status === 'ACTIVE' && b.quantityRemaining > 0));
    } catch (err) {
      console.error('Failed to load product batches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredBatches = batches.filter(
    (b) =>
      b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
      (b.supplierName && b.supplierName.toLowerCase().includes(search.toLowerCase()))
  );

  const handleConfirm = () => {
    if (!tempBatchId) {
      onSelectBatch(undefined, undefined, undefined);
    } else {
      const target = batches.find((b) => b.id === tempBatchId);
      onSelectBatch(target?.id, target?.batchNumber, undefined);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="max-w-xl w-full bg-white rounded-lg border border-slate-300 shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white py-3.5 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Select Inventory Batch Lot</h3>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-xs">{productName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Search Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search batch number or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-slate-200 text-xs"
            />
          </div>

          {/* Batches Options List */}
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {/* Option 0: Auto Allocation (FIFO / FEFO) */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                !tempBatchId ? 'border-emerald-500 bg-emerald-50/60 font-bold' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="posBatchSelect"
                checked={!tempBatchId}
                onChange={() => setTempBatchId(undefined)}
                className="mt-0.5 text-emerald-600"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-900 font-bold">Auto Allocation (FIFO / FEFO Default)</span>
                  <Badge variant="secondary" className="text-[9px] px-1.5">
                    AUTO
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Consumes available stock from oldest/earliest expiring batches automatically.
                </p>
              </div>
            </label>

            {isLoading ? (
              <div className="p-6 text-center text-slate-500">Loading active stock batches...</div>
            ) : filteredBatches.length === 0 ? (
              <div className="p-6 text-center text-slate-500 font-medium">No active batches available for selection.</div>
            ) : (
              filteredBatches.map((b) => {
                const isSelected = tempBatchId === b.id;
                const expDate = b.expiryDate ? new Date(b.expiryDate) : null;
                const isExpired = expDate && expDate < new Date();

                return (
                  <label
                    key={b.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'border-emerald-500 bg-emerald-50/60 font-bold' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="posBatchSelect"
                      checked={isSelected}
                      onChange={() => setTempBatchId(b.id)}
                      className="mt-0.5 text-emerald-600"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-slate-900 font-bold flex items-center gap-2">
                          <span>{b.batchNumber}</span>
                          <span className="text-[10px] text-slate-500 font-normal font-sans">
                            • {b.supplierName || 'Opening Stock'}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 bg-emerald-50">
                          Avail: {b.quantityRemaining}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-600 pt-0.5">
                        <div>Cost: {formatCurrency(b.unitCost)}</div>
                        <div>Received: {new Date(b.receivedDate).toLocaleDateString()}</div>
                        <div className="text-right">
                          Expiry:{' '}
                          {expDate ? (
                            <span className={isExpired ? 'text-red-600 font-bold' : 'text-slate-800'}>
                              {expDate.toLocaleDateString()}
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs font-semibold">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 cursor-pointer"
            >
              Select Batch
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
