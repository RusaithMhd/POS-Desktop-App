'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  Filter,
  CreditCard,
  X,
  Receipt,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import { AuthService } from '@/features/auth/AuthService';
import { AccountingService } from '@/services/accounting/AccountingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export interface CustomerRecord {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email?: string;
  credit_limit: number;
  current_credit: number;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
  oldestCreditDate?: string | null;
  latestCreditDate?: string | null;
  daysElapsed: number;
  isOverdue: boolean;
  overdueDays: number;
}

export default function CustomersPage() {
  return (
    <PermissionGuard permission={['customers.view', 'customers.manage']} moduleName="Customer Management & Credit Accounts">
      <CustomersContent />
    </PermissionGuard>
  );
}

function CustomersContent() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'credit' | 'overdue'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // New Customer Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creditLimit, setCreditLimit] = useState('50000');

  // Credit Settlement Modal State
  const [selectedSettleCustomer, setSelectedSettleCustomer] = useState<CustomerRecord | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleError, setSettleError] = useState('');
  const [isSettling, setIsSettling] = useState(false);

  // Notification Toast State
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadCustomersData();
  }, []);

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadCustomersData = async () => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();

      // 1. Fetch Customers
      const stmt = raw.prepare('SELECT * FROM customers ORDER BY name ASC');
      const list: any[] = [];
      while (stmt.step()) {
        list.push(stmt.getAsObject());
      }
      stmt.free();

      // 2. Fetch Oldest Unpaid Credit Sale per customer to compute overdue dates
      const creditStmt = raw.prepare(`
        SELECT s.customer_id, MIN(s.created_at) as oldest_credit_date, MAX(s.created_at) as latest_credit_date
        FROM sales s
        JOIN sale_payments sp ON s.id = sp.sale_id
        WHERE sp.method_code IN ('CREDIT', 'STORE_CREDIT')
          AND s.status NOT IN ('DELETED', 'VOIDED', 'CANCELLED')
        GROUP BY s.customer_id
      `);

      const creditMap = new Map<string, { oldestCreditDate: string; latestCreditDate: string }>();
      while (creditStmt.step()) {
        const row = creditStmt.getAsObject();
        if (row.customer_id) {
          creditMap.set(row.customer_id as string, {
            oldestCreditDate: row.oldest_credit_date as string,
            latestCreditDate: row.latest_credit_date as string,
          });
        }
      }
      creditStmt.free();

      const now = new Date();
      const CREDIT_TERM_DAYS = 30; // Standard 30-Day Credit Policy

      const processed: CustomerRecord[] = list.map((c) => {
        const cInfo = creditMap.get(c.id);
        const currentCredit = parseFloat(c.current_credit || 0);
        const creditLimitVal = parseFloat(c.credit_limit || 0);

        let oldestCreditDate = cInfo?.oldestCreditDate || null;
        let daysElapsed = 0;
        let isOverdue = false;
        let overdueDays = 0;

        if (currentCredit > 0 && oldestCreditDate) {
          const diffMs = now.getTime() - new Date(oldestCreditDate).getTime();
          daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (daysElapsed > CREDIT_TERM_DAYS) {
            isOverdue = true;
            overdueDays = daysElapsed - CREDIT_TERM_DAYS;
          }
        }

        return {
          id: c.id,
          business_id: c.business_id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          credit_limit: creditLimitVal,
          current_credit: currentCredit,
          loyalty_points: parseInt(c.loyalty_points || 0),
          created_at: c.created_at,
          updated_at: c.updated_at,
          oldestCreditDate,
          latestCreditDate: cInfo?.latestCreditDate || null,
          daysElapsed,
          isOverdue,
          overdueDays,
        };
      });

      setCustomers(processed);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const now = new Date().toISOString();
      const id = `cust-${Date.now()}`;

      raw.run(
        `INSERT INTO customers (id, business_id, name, phone, email, credit_limit, current_credit, loyalty_points, created_at, updated_at)
         VALUES (?, 'biz-001', ?, ?, ?, ?, 0, 0, ?, ?)`,
        [id, name.trim(), phone.trim(), email.trim() || null, parseFloat(creditLimit) || 0, now, now]
      );
      saveLocalDbState();

      setIsFormOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setCreditLimit('50000');
      showNotify('success', `Customer '${name}' registered successfully.`);
      await loadCustomersData();
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to create customer.');
    }
  };

  const openSettleModal = (customer: CustomerRecord) => {
    setSelectedSettleCustomer(customer);
    setSettleAmount(customer.current_credit.toString());
    setSettleMethod('CASH');
    setSettleNotes('');
    setSettleError('');
  };

  const handleSettleCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSettleCustomer) return;

    const payAmt = parseFloat(settleAmount);
    if (isNaN(payAmt) || payAmt <= 0) {
      setSettleError('Please enter a valid positive payment amount.');
      return;
    }
    if (payAmt > selectedSettleCustomer.current_credit) {
      setSettleError(`Settlement amount cannot exceed current outstanding balance of ${formatCurrency(selectedSettleCustomer.current_credit)}.`);
      return;
    }

    setIsSettling(true);
    setSettleError('');
    await getLocalDb();
    const db = getRawSqlDb();

    try {
      const now = new Date().toISOString();
      const user = AuthService.getActiveSession();

      db.run('BEGIN TRANSACTION;');

      // 1. Reduce Customer Credit Balance
      db.run(
        'UPDATE customers SET current_credit = MAX(0, current_credit - ?), updated_at = ? WHERE id = ?',
        [payAmt, now, selectedSettleCustomer.id]
      );

      // 2. Post Double-Entry Accounting Entry
      const settlePayId = `cpay-${Date.now()}`;
      AccountingService.recordCustomerPayment(db, {
        paymentId: settlePayId,
        customerId: selectedSettleCustomer.id,
        userId: user?.id || 'usr-admin',
        amount: payAmt,
        paymentMethod: settleMethod,
        reference: settleNotes ? `Notes: ${settleNotes}` : `Customer ${selectedSettleCustomer.name}`,
      });

      // 3. Insert Audit Log
      db.run(
        `INSERT INTO audit_logs (id, business_id, branch_id, terminal_id, user_id, action, entity_type, entity_id, new_values, created_at)
         VALUES (?, 'biz-001', 'br-001', 'term-001', ?, 'CREDIT_SETTLEMENT', 'customer', ?, ?, ?)`,
        [
          `audit-${Date.now()}`,
          user?.id || 'usr-admin',
          selectedSettleCustomer.id,
          JSON.stringify({
            customerName: selectedSettleCustomer.name,
            amountPaid: payAmt,
            method: settleMethod,
            notes: settleNotes,
          }),
          now,
        ]
      );

      db.run('COMMIT;');
      saveLocalDbState();

      showNotify('success', `Settlement of ${formatCurrency(payAmt)} processed for ${selectedSettleCustomer.name}.`);
      setSelectedSettleCustomer(null);
      await loadCustomersData();
    } catch (err: any) {
      try { db.run('ROLLBACK;'); } catch {}
      setSettleError(err.message || 'Failed to process credit settlement.');
    } finally {
      setIsSettling(false);
    }
  };

  // KPI Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalCount = customers.length;
    const totalCreditOutstanding = customers.reduce((acc, c) => acc + c.current_credit, 0);
    const overdueAccounts = customers.filter((c) => c.isOverdue);
    const totalOverdueAmount = overdueAccounts.reduce((acc, c) => acc + c.current_credit, 0);
    const totalCreditLimitAuthorized = customers.reduce((acc, c) => acc + c.credit_limit, 0);

    return {
      totalCount,
      totalCreditOutstanding,
      overdueCount: overdueAccounts.length,
      totalOverdueAmount,
      totalCreditLimitAuthorized,
    };
  }, [customers]);

  // Filtered Output
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // 1. Search Query Filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = (c.phone || '').includes(q);
        const matchesEmail = (c.email || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesEmail) return false;
      }

      // 2. Tab Filter
      if (filterTab === 'credit') {
        if (c.current_credit <= 0) return false;
      } else if (filterTab === 'overdue') {
        if (!c.isOverdue) return false;
      }

      return true;
    });
  }, [customers, search, filterTab]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-800">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-xs font-semibold border ${
            notification.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : 'bg-rose-900 text-rose-100 border-rose-700'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-rose-400" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" /> Customer Directory & Credit Accounts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage customer profiles, credit balances, credit limits, and overdue debt settlements
          </p>
        </div>
        <Button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs px-4 py-2"
        >
          <Plus className="h-4 w-4" /> {isFormOpen ? 'Close Form' : 'Add New Customer'}
        </Button>
      </div>

      {/* KPI Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Customers */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Total Customers</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{summaryMetrics.totalCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">Registered Store Accounts</div>
          </div>
        </div>

        {/* Metric 2: Total Outstanding Credit */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-amber-700 font-bold uppercase tracking-wider">
            <span>Total Outstanding Credit</span>
            <CreditCard className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-600 font-mono">
              {formatCurrency(summaryMetrics.totalCreditOutstanding)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">Sum of all unpaid credit balances</div>
          </div>
        </div>

        {/* Metric 3: Overdue Amount */}
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-rose-700 font-bold uppercase tracking-wider">
            <span>Overdue Credit</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-600 font-mono">
              {formatCurrency(summaryMetrics.totalOverdueAmount)}
            </div>
            <div className="text-[11px] text-rose-600 mt-0.5 font-semibold flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              <span>{summaryMetrics.overdueCount} Accounts exceeded 30-day term</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Total Credit Limit */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Authorized Credit Limit</span>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-800 font-mono">
              {formatCurrency(summaryMetrics.totalCreditLimitAuthorized)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">Total store credit exposure</div>
          </div>
        </div>
      </div>

      {/* Registration Form */}
      {isFormOpen && (
        <Card className="border-emerald-200 shadow-md">
          <CardHeader className="bg-emerald-50/50 py-3 border-b border-emerald-100">
            <CardTitle className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-600" /> Register New Customer Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleCreateCustomer} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700">Customer Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Eleanor Vance"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Phone Number *</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="+94 77 123 4567"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Email Address</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Credit Limit (LKR)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="50000.00"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-4 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 text-xs">
                  Save Customer Record
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search customer by name, phone number, or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-white border-slate-200 text-xs h-9"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => {
              setFilterTab('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Accounts ({customers.length})
          </button>
          <button
            onClick={() => {
              setFilterTab('credit');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterTab === 'credit' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Outstanding Credit ({customers.filter((c) => c.current_credit > 0).length})
          </button>
          <button
            onClick={() => {
              setFilterTab('overdue');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterTab === 'overdue' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overdue ({customers.filter((c) => c.isOverdue).length})
          </button>
        </div>
      </div>

      {/* Main Customers Table */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3">Customer & Contact</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3 text-right">Credit Balance (LKR)</th>
                  <th className="p-3 text-right">Credit Limit</th>
                  <th className="p-3 text-center">Oldest Unpaid / Days</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400 font-medium">
                      No matching customer accounts found.
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((c) => {
                    const usagePercent = c.credit_limit > 0 ? Math.min(100, Math.round((c.current_credit / c.credit_limit) * 100)) : 0;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Customer Name & Phone */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {c.phone} {c.email ? `• ${c.email}` : ''}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="p-3">
                          {c.isOverdue ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="h-3 w-3 text-rose-600" />
                              OVERDUE ({c.overdueDays} Days Late)
                            </span>
                          ) : c.current_credit > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="h-3 w-3 text-amber-600" />
                              Active Credit ({c.daysElapsed} Days Open)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Clear / No Balance
                            </span>
                          )}
                        </td>

                        {/* Credit Balance */}
                        <td className="p-3 text-right">
                          <div className={`font-mono font-bold text-sm ${c.current_credit > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                            {formatCurrency(c.current_credit)}
                          </div>
                          {c.credit_limit > 0 && c.current_credit > 0 && (
                            <div className="mt-1 w-28 ml-auto bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${usagePercent >= 90 ? 'bg-rose-500' : usagePercent >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>
                          )}
                        </td>

                        {/* Credit Limit */}
                        <td className="p-3 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(c.credit_limit)}
                        </td>

                        {/* Oldest Unpaid Date & Elapsed Days */}
                        <td className="p-3 text-center">
                          {c.current_credit > 0 && c.oldestCreditDate ? (
                            <div>
                              <div className="font-mono text-slate-700 font-semibold text-[11px]">
                                {new Date(c.oldestCreditDate).toLocaleDateString()}
                              </div>
                              <div className={`text-[10px] font-medium ${c.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                                {c.daysElapsed} days since purchase
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          {c.current_credit > 0 ? (
                            <Button
                              onClick={() => openSettleModal(c)}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-3 text-[11px] gap-1 shadow-sm"
                            >
                              <Receipt className="h-3.5 w-3.5" /> Settle Credit
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-7 px-3 text-[11px] text-slate-400 border-slate-200"
                            >
                              No Balance
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-slate-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredCustomers.length}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Credit Settlement Modal */}
      {selectedSettleCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Settle Customer Credit</h3>
              </div>
              <button
                onClick={() => setSelectedSettleCustomer(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSettleCredit} className="p-4 space-y-4 text-xs">
              {settleError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2 text-xs">
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                  <span>{settleError}</span>
                </div>
              )}

              {/* Customer Info Card */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Customer Account</div>
                <div className="font-bold text-slate-900 text-sm">{selectedSettleCustomer.name}</div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">Outstanding Balance:</span>
                  <span className="font-mono font-bold text-amber-600 text-sm">
                    {formatCurrency(selectedSettleCustomer.current_credit)}
                  </span>
                </div>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="font-bold text-slate-700">Settlement Amount (LKR) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                  className="mt-1 font-mono font-bold text-sm"
                />
                <div className="flex justify-between items-center mt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSettleAmount(selectedSettleCustomer.current_credit.toString())}
                    className="text-emerald-600 hover:underline font-bold"
                  >
                    Pay Full Balance ({formatCurrency(selectedSettleCustomer.current_credit)})
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="font-bold text-slate-700">Payment Method *</label>
                <select
                  value={settleMethod}
                  onChange={(e: any) => setSettleMethod(e.target.value)}
                  className="w-full mt-1 h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">Cash Payment</option>
                  <option value="CARD">Card / POS Terminal</option>
                  <option value="BANK_TRANSFER">Bank Direct Transfer</option>
                </select>
              </div>

              {/* Notes / Reference */}
              <div>
                <label className="font-bold text-slate-700">Reference / Notes</label>
                <Input
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="e.g. Bank slip reference or receipt #"
                  className="mt-1"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedSettleCustomer(null)}
                  disabled={isSettling}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSettling}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 text-xs gap-1.5"
                >
                  {isSettling ? 'Processing...' : 'Confirm Credit Settlement'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
