export interface CashierShiftEntity {
  id: string;
  terminalId: string;
  userId: string;
  openedAt: string;
  closedAt?: string | null;
  openingCash: number;
  closingCashExpected?: number | null;
  closingCashActual?: number | null;
  cashDifference?: number | null;
  totalSales: number;
  totalRefunds: number;
  totalCashIn: number;
  totalCashOut: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string | null;
}

export interface CashMovementEntity {
  id: string;
  shiftId: string;
  userId: string;
  type: 'CASH_IN' | 'CASH_OUT' | 'EXPENSE';
  amount: number;
  reason: string;
  reference?: string | null;
  createdAt: string;
}
