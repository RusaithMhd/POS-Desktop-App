'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Clock, Lock, AlertCircle } from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteShiftRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { CashierShiftEntity, CashMovementEntity } from '@/domain/entities/CashierShift';
import { AuthService } from '@/features/auth/AuthService';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function ShiftsPage() {
  return (
    <PermissionGuard permission={['cash_register.open', 'cash_register.close', 'shift.view']} moduleName="Shift & Cash Register Management">
      <ShiftsContent />
    </PermissionGuard>
  );
}

function ShiftsContent() {
  const router = useRouter();
  const [activeShift, setActiveShift] = useState<CashierShiftEntity | null>(null);
  const [movements, setMovements] = useState<CashMovementEntity[]>([]);
  const [openingCash, setOpeningCash] = useState<string>('5000.00');
  const [closingCashActual, setClosingCashActual] = useState<string>('');
  const [cashReason, setCashReason] = useState<string>('');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashType, setCashType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination state for movements
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const shiftRepo = new SQLiteShiftRepository();

  useEffect(() => {
    loadShiftData();
  }, []);

  const loadShiftData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const shift = await shiftRepo.getActiveShift('term-001');
      setActiveShift(shift);
      if (shift) {
        const movs = await shiftRepo.getShiftMovements(shift.id);
        setMovements(movs);
      }
    } catch (err) {
      console.error('Failed to load shift:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amt = parseFloat(openingCash);
    if (isNaN(amt) || amt < 0) {
      setError('Please enter a valid opening cash float.');
      return;
    }

    try {
      const user = AuthService.getActiveSession();
      if (!user) return;
      await shiftRepo.openShift('term-001', user.id, amt);
      await loadShiftData();
    } catch (err: any) {
      setError(err.message || 'Failed to open shift.');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    setError('');
    const actual = parseFloat(closingCashActual);
    if (isNaN(actual)) {
      setError('Please enter actual physical cash counted in register.');
      return;
    }

    try {
      await shiftRepo.closeShift(activeShift.id, actual, notes);
      await loadShiftData();
      setClosingCashActual('');
      setNotes('');
    } catch (err: any) {
      setError(err.message || 'Failed to close shift.');
    }
  };

  const handleRecordCashMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    const amt = parseFloat(cashAmount);
    if (isNaN(amt) || amt <= 0 || !cashReason.trim()) {
      setError('Enter a valid cash amount and reason.');
      return;
    }

    try {
      const user = AuthService.getActiveSession();
      if (!user) return;
      await shiftRepo.recordCashMovement({
        shiftId: activeShift.id,
        userId: user.id,
        type: cashType,
        amount: amt,
        reason: cashReason,
      });
      setCashAmount('');
      setCashReason('');
      await loadShiftData();
    } catch (err: any) {
      setError(err.message || 'Failed to record cash movement.');
    }
  };

  const expectedCash = activeShift
    ? activeShift.openingCash + activeShift.totalSales + activeShift.totalCashIn - activeShift.totalCashOut
    : 0;

  const totalPages = Math.ceil(movements.length / pageSize);
  const paginatedMovements = movements.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" /> Cash Register & Shift Reconciliation
          </h2>
          <p className="text-xs text-slate-500">Open, balance, and close cashier shifts locally in LKR with full audit trail</p>
        </div>
        {activeShift && (
          <Badge variant="online" className="gap-2 text-xs">
            <Clock className="h-3.5 w-3.5" /> Shift Open #{activeShift.id.slice(-6)}
          </Badge>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600" /> {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Loading shift status...</div>
      ) : !activeShift ? (
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center"><CardTitle className="text-base font-bold">Open Cashier Shift Register</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Opening Float Cash (LKR)</label>
                <Input
                  type="number"
                  step="0.01"
                  className="text-lg font-bold text-slate-900 h-11"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Open Register Shift
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4 bg-white">
                <div className="text-xs text-slate-500 font-bold uppercase">Opening Float</div>
                <div className="text-xl font-extrabold text-slate-900 font-mono mt-1">{formatCurrency(activeShift.openingCash)}</div>
              </Card>

              <Card className="p-4 bg-white">
                <div className="text-xs text-slate-500 font-bold uppercase">Shift Sales</div>
                <div className="text-xl font-extrabold text-emerald-600 font-mono mt-1">{formatCurrency(activeShift.totalSales)}</div>
              </Card>

              <Card className="p-4 bg-white">
                <div className="text-xs text-slate-500 font-bold uppercase">Cash In</div>
                <div className="text-xl font-extrabold text-blue-600 font-mono mt-1">{formatCurrency(activeShift.totalCashIn)}</div>
              </Card>

              <Card className="p-4 bg-white">
                <div className="text-xs text-slate-500 font-bold uppercase">Expected Cash</div>
                <div className="text-xl font-extrabold text-slate-900 font-mono mt-1">{formatCurrency(expectedCash)}</div>
              </Card>
            </div>

            <Card className="overflow-hidden border-slate-200">
              <CardHeader><CardTitle className="text-sm font-bold">Cash Movements</CardTitle></CardHeader>
              <CardContent className="space-y-3 p-4">
                <form onSubmit={handleRecordCashMovement} className="flex gap-2 p-2 bg-slate-50 rounded-md border border-slate-200">
                  <select
                    value={cashType}
                    onChange={(e: any) => setCashType(e.target.value)}
                    className="bg-white border border-slate-300 text-xs font-bold rounded-md px-2 text-slate-900"
                  >
                    <option value="CASH_IN">Cash In (+)</option>
                    <option value="CASH_OUT">Cash Out (-)</option>
                  </select>
                  <Input type="number" step="0.01" placeholder="Amount (LKR)" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} className="w-32 h-8 text-xs bg-white" />
                  <Input type="text" placeholder="Reason e.g. Bank drop / Petty cash" value={cashReason} onChange={(e) => setCashReason(e.target.value)} className="flex-1 h-8 text-xs bg-white" />
                  <Button type="submit" size="sm" className="h-8 bg-emerald-600 text-white font-bold">Add</Button>
                </form>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-md overflow-hidden">
                  {paginatedMovements.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">No cash movements in this shift.</div>
                  ) : (
                    paginatedMovements.map((m) => (
                      <div key={m.id} className="p-2.5 flex items-center justify-between text-xs bg-white">
                        <span className="font-semibold text-slate-900">{m.reason}</span>
                        <span className={`font-mono font-bold ${m.type === 'CASH_IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {m.type === 'CASH_IN' ? '+' : '-'}{formatCurrency(m.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={movements.length}
                  pageSize={pageSize}
                  onPageChange={(page) => setCurrentPage(page)}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Lock className="h-4 w-4 text-emerald-600" /> Close & Reconcile Register</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                  <div className="text-xs text-slate-500">Expected Total Cash:</div>
                  <div className="text-xl font-extrabold text-slate-900 font-mono">{formatCurrency(expectedCash)}</div>
                </div>

                <form onSubmit={handleCloseShift} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Actual Physical Cash Count (LKR)</label>
                    <Input type="number" step="0.01" value={closingCashActual} onChange={(e) => setClosingCashActual(e.target.value)} required placeholder="Count physical cash" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Reconciliation Notes</label>
                    <Input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shift notes" className="mt-1" />
                  </div>
                  <Button type="submit" variant="destructive" className="w-full font-bold">Close Shift & Reconcile</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
