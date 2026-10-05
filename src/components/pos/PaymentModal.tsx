'use client';

import React, { useState } from 'react';
import { DollarSign, CreditCard, Landmark, UserCheck, AlertCircle, X, Check } from 'lucide-react';
import { useCartStore } from '@/features/sales/useCartStore';
import { SQLiteSaleRepository, SQLiteProductRepository, SQLiteShiftRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { ProcessSaleUseCase } from '@/application/use-cases/ProcessSaleUseCase';
import { AuthService } from '@/features/auth/AuthService';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SaleEntity } from '@/domain/entities/Sale';

import { defaultSettingsService, ShopSettings, DEFAULT_SHOP_SETTINGS } from '@/services/settings/SettingsService';
import { calculateCartTaxAndTotals } from '@/lib/tax';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sale: SaleEntity) => void;
}

export function PaymentModal({ isOpen, onClose, onSuccess }: PaymentModalProps) {
  const { items, customer, overallDiscountAmount, notes, clearCart } = useCartStore();

  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [payments, setPayments] = useState<Array<{ paymentMethodId: string; methodCode: any; amount: number; referenceNumber?: string }>>([]);
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);

  React.useEffect(() => {
    defaultSettingsService.getSettings().then(setSettings);
  }, []);

  if (!isOpen) return null;

  const { grandTotal, taxAmount, taxName, isTaxInclusive, taxRate } = calculateCartTaxAndTotals(
    items,
    overallDiscountAmount,
    settings
  );

  const totalAddedPayments = payments.reduce((acc, p) => acc + p.amount, 0);
  const activeTender = parseFloat(cashTendered) || 0;
  const grandTotalWithTender = totalAddedPayments + activeTender;
  const remainingDue = Math.max(0, grandTotal - totalAddedPayments);
  const changeAmount = Math.max(0, grandTotalWithTender - grandTotal);

  const handleCheckout = async () => {
    setError('');
    setIsProcessing(true);

    try {
      const user = AuthService.getActiveSession();
      if (!user) throw new Error('No active cashier session.');

      let finalPayments = [...payments];
      if (activeTender > 0 || finalPayments.length === 0) {
        const tenderAmt = activeTender > 0 ? activeTender : remainingDue;
        const methodIdMap = { CASH: 'pm-cash', CARD: 'pm-card', BANK_TRANSFER: 'pm-bank', CREDIT: 'pm-credit' };
        finalPayments.push({
          paymentMethodId: methodIdMap[selectedMethod],
          methodCode: selectedMethod,
          amount: tenderAmt,
        });
      }

      const clientTransactionId = `TRM-01-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const input = {
        clientTransactionId,
        businessId: user.businessId,
        branchId: user.branchId,
        terminalId: 'term-001',
        userId: user.id,
        customerId: customer?.id || null,
        shiftId: '',
        items: items.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          unitPrice: i.unitPrice,
          costPrice: i.product.costPrice,
          quantity: i.quantity,
          discountAmount: i.discountAmount,
          taxRate: i.taxRate,
          selectedBatchId: i.selectedBatchId,
          selectedBatchNumber: i.selectedBatchNumber,
        })),
        payments: finalPayments,
        overallDiscountAmount,
        notes,
      };

      const saleRepo = new SQLiteSaleRepository();
      const productRepo = new SQLiteProductRepository();
      const shiftRepo = new SQLiteShiftRepository();
      const useCase = new ProcessSaleUseCase(saleRepo, productRepo, shiftRepo);

      const sale = await useCase.execute(input, user.permissions);

      clearCart();
      onSuccess(sale);
    } catch (err: any) {
      setError(err.message || 'Checkout failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" /> Complete Payment & Checkout
            </h2>
            <p className="text-xs text-slate-500">Total Payable Amount: <span className="text-slate-900 font-extrabold">{formatCurrency(grandTotal)}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Payment Method Selector Grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { code: 'CASH', label: 'Cash', icon: DollarSign },
              { code: 'CARD', label: 'Card / POS', icon: CreditCard },
              { code: 'BANK_TRANSFER', label: 'Bank QR', icon: Landmark },
              { code: 'CREDIT', label: 'Store Credit', icon: UserCheck },
            ].map((m) => {
              const Icon = m.icon;
              const isSel = selectedMethod === m.code;
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => setSelectedMethod(m.code as any)}
                  className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold cursor-pointer ${
                    isSel
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isSel ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Cash Tendered Input */}
          {selectedMethod === 'CASH' && (
            <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="text-xs font-bold text-slate-700">Tendered Cash Amount (Rs.)</label>
              <Input
                type="number"
                step="0.01"
                className="text-xl font-bold text-slate-900 h-11 bg-white font-mono"
                placeholder={remainingDue.toFixed(2)}
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button variant="outline" size="sm" onClick={() => setCashTendered(remainingDue.toString())} className="text-xs font-bold">
                  Exact ({formatCurrency(remainingDue)})
                </Button>
                {[100, 500, 1000, 5000, 10000].map((val) => (
                  <Button key={val} variant="outline" size="sm" onClick={() => setCashTendered(val.toString())} className="text-xs font-bold font-mono">
                    Rs. {val.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Financial Calculation Summary */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-xs text-slate-700">
            <div className="flex justify-between"><span>Total Bill:</span><span>{formatCurrency(grandTotal)}</span></div>
            <div className="flex justify-between"><span>Tendered / Received:</span><span className="font-bold text-slate-900">{formatCurrency(grandTotalWithTender)}</span></div>
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>CHANGE DUE:</span>
              <span className="text-emerald-700 font-mono">{formatCurrency(changeAmount)}</span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
          <Button
            onClick={handleCheckout}
            disabled={isProcessing}
            size="posPay"
            className="flex-[2] bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 shadow"
          >
            {isProcessing ? 'Processing Transaction...' : `COMPLETE SALE (${formatCurrency(grandTotal)})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
