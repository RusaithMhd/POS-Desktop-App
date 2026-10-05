'use client';

import React, { useState, useEffect } from 'react';
import { Coins, Plus, Search } from 'lucide-react';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { AuthService } from '@/features/auth/AuthService';
import { AccountingService } from '@/services/accounting/AccountingService';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function ExpensesPage() {
  return (
    <PermissionGuard permission={['reports.financial', 'expenses.view', 'expenses.manage']} moduleName="Expense & Outflow Management">
      <ExpensesContent />
    </PermissionGuard>
  );
}

function ExpensesContent() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [category, setCategory] = useState('Supplies');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadExpensesData();
  }, []);

  const loadExpensesData = async () => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const stmt = raw.prepare('SELECT * FROM expenses ORDER BY created_at DESC');
      const list: any[] = [];
      while (stmt.step()) {
        list.push(stmt.getAsObject());
      }
      stmt.free();
      setExpenses(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const user = AuthService.getActiveSession();
      if (!user) return;

      const now = new Date().toISOString();
      const id = `exp-${Date.now()}`;
      const expAmount = parseFloat(amount) || 0;

      raw.run('BEGIN TRANSACTION;');
      try {
        raw.run(
          `INSERT INTO expenses (id, branch_id, shift_id, user_id, category, amount, payment_method, description, receipt_ref, created_at)
           VALUES (?, 'branch-001', null, ?, ?, ?, ?, ?, '', ?)`,
          [id, user.id, category, expAmount, paymentMethod, description, now]
        );

        AccountingService.recordExpense(raw, {
          expenseId: id,
          category,
          amount: expAmount,
          paymentMethod,
          userId: user.id,
          description,
        });

        raw.run('COMMIT;');
      } catch (err) {
        raw.run('ROLLBACK;');
        throw err;
      }

      setIsFormOpen(false);
      setAmount('');
      setDescription('');
      await loadExpensesData();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = expenses.filter(
    (e) =>
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenseAmount = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedExpenses = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="h-5 w-5 text-emerald-600" /> Operational Store Expenses
          </h2>
          <p className="text-xs text-slate-500 font-medium">Record petty cash payouts, utility bills, rent, and store maintenance in LKR</p>
        </div>
        <Button onClick={() => setIsFormOpen(!isFormOpen)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
          <Plus className="h-4 w-4" /> {isFormOpen ? 'Close Form' : 'Record New Expense'}
        </Button>
      </div>

      {isFormOpen && (
        <Card className="border-emerald-200">
          <CardHeader><CardTitle className="text-sm font-bold">New Expense Entry</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreateExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                >
                  {['Rent', 'Electricity', 'Transport', 'Salary', 'Maintenance', 'Supplies', 'Other'].map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700">Expense Amount (LKR)</label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="4500.00" className="mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                >
                  <option value="CASH">Cash Register Drawer</option>
                  <option value="CARD">Company Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700">Description / Reason</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="e.g. Cleaning supplies for counter" className="mt-1" />
              </div>
              <div className="sm:col-span-4 flex justify-end">
                <Button type="submit" className="bg-emerald-600 text-white font-bold px-6">Record Expense</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search expense category or description..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-white border-slate-200"
          />
        </div>
        <Card className="p-3 bg-white border-slate-200 shrink-0">
          <div className="text-xs text-slate-500 font-bold">Total Expenses: <span className="text-red-600 font-mono font-extrabold text-sm">{formatCurrency(totalExpenseAmount)}</span></div>
        </Card>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
              <span className="col-span-3">CATEGORY</span>
              <span className="col-span-5">DESCRIPTION</span>
              <span className="col-span-2">METHOD</span>
              <span className="col-span-2 text-right">AMOUNT (LKR)</span>
            </div>
            {paginatedExpenses.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                No store expenses recorded.
              </div>
            ) : (
              paginatedExpenses.map((e) => (
                <div key={e.id} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors">
                  <span className="col-span-3 font-bold">
                    <Badge variant="outline" className="text-[10px] text-slate-700">{e.category}</Badge>
                  </span>
                  <span className="col-span-5 text-slate-700">{e.description}</span>
                  <span className="col-span-2 font-mono text-[11px] text-slate-500">{e.payment_method}</span>
                  <span className="col-span-2 text-right font-mono font-bold text-red-600">-{formatCurrency(e.amount)}</span>
                </div>
              ))
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
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
  );
}
