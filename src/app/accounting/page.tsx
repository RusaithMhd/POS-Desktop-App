'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  LayoutDashboard,
  BookOpen,
  Receipt,
  FileSpreadsheet,
  Scale,
  Settings,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Coins,
  Building2,
  CreditCard,
  Ban,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import {
  AccountingService,
  AccountRecord,
  JournalEntryRecord,
  AccountMappingRecord,
  AccountingDashboardMetrics,
  ProfitAndLossReport,
  TrialBalanceReport,
  GeneralLedgerEntry,
  AccountType,
} from '@/services/accounting/AccountingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { AuthService } from '@/features/auth/AuthService';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function AccountingPage() {
  return (
    <PermissionGuard permission={['accounting.view', 'reports.financial', 'accounting.reports']} moduleName="General Ledger & Accounting Module">
      <AccountingContent />
    </PermissionGuard>
  );
}

function AccountingContent() {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'coa' | 'ledger' | 'pnl' | 'trial' | 'journals' | 'mappings'
  >('dashboard');

  // Shared Data
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [journals, setJournals] = useState<JournalEntryRecord[]>([]);
  const [mappings, setMappings] = useState<AccountMappingRecord[]>([]);
  const [metrics, setMetrics] = useState<AccountingDashboardMetrics | null>(null);

  // Toast Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadAccountingData();
  }, [activeTab]);

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadAccountingData = async () => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();

      const accs = AccountingService.getAccounts(raw);
      setAccounts(accs);

      const jnls = AccountingService.getJournalEntries(raw, 200);
      setJournals(jnls);

      const maps = AccountingService.getAccountMappings(raw);
      setMappings(maps);

      const dashboard = AccountingService.getDashboardMetrics(raw);
      setMetrics(dashboard);
    } catch (err) {
      console.error('[AccountingPage] Failed to load data:', err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-900 select-none">
      {/* 1. HEADER & NAVIGATION TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-emerald-600" /> Double-Entry General Ledger & Accounting
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Offline automated financial accounting, general ledger, profit & loss, trial balance, and audit controls
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={loadAccountingData} variant="outline" size="sm" className="gap-1.5 text-xs font-bold border-slate-300">
            <RefreshCw className="h-3.5 w-3.5 text-slate-600" /> Refresh Ledger
          </Button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3 rounded-md text-xs font-bold flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {notification.message}
        </div>
      )}

      {/* MODULE TABS */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-bold">
        {[
          { id: 'dashboard', label: 'Accounting Dashboard', icon: LayoutDashboard },
          { id: 'coa', label: 'Chart of Accounts', icon: BookOpen },
          { id: 'ledger', label: 'General Ledger', icon: FileSpreadsheet },
          { id: 'pnl', label: 'Profit & Loss', icon: Receipt },
          { id: 'trial', label: 'Trial Balance', icon: Scale },
          { id: 'journals', label: 'Journal Entries', icon: Calculator },
          { id: 'mappings', label: 'Account Mappings', icon: Settings },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-t-lg transition-colors cursor-pointer whitespace-nowrap ${
                isActive ? 'bg-slate-900 text-white font-extrabold shadow-2xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TABS CONTENT RENDER */}
      {activeTab === 'dashboard' && <DashboardTab metrics={metrics} onRefresh={loadAccountingData} showNotify={showNotify} />}
      {activeTab === 'coa' && <ChartOfAccountsTab accounts={accounts} onRefresh={loadAccountingData} showNotify={showNotify} />}
      {activeTab === 'ledger' && <GeneralLedgerTab accounts={accounts} />}
      {activeTab === 'pnl' && <ProfitAndLossTab />}
      {activeTab === 'trial' && <TrialBalanceTab />}
      {activeTab === 'journals' && <JournalEntriesTab journals={journals} accounts={accounts} onRefresh={loadAccountingData} showNotify={showNotify} />}
      {activeTab === 'mappings' && <AccountMappingsTab mappings={mappings} accounts={accounts} onRefresh={loadAccountingData} showNotify={showNotify} />}
    </div>
  );
}

// ======================================================================
// 1. DASHBOARD TAB
// ======================================================================
function DashboardTab({
  metrics,
  onRefresh,
  showNotify,
}: {
  metrics: AccountingDashboardMetrics | null;
  onRefresh: () => void;
  showNotify: (type: 'success' | 'error', msg: string) => void;
}) {
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);

  const [capitalAmount, setCapitalAmount] = useState('');
  const [capitalMethod, setCapitalMethod] = useState('CASH');
  const [capitalNotes, setCapitalNotes] = useState('');

  const [drawingAmount, setDrawingAmount] = useState('');
  const [drawingMethod, setDrawingMethod] = useState('CASH');
  const [drawingNotes, setDrawingNotes] = useState('');

  const handleRecordCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(capitalAmount);
    if (isNaN(amt) || amt <= 0) return;

    try {
      const db = getRawSqlDb();
      const user = AuthService.getActiveSession();
      db.run('BEGIN TRANSACTION;');
      AccountingService.recordOwnerCapital(db, {
        userId: user?.id || 'usr-admin',
        amount: amt,
        paymentMethod: capitalMethod,
        notes: capitalNotes,
      });
      db.run('COMMIT;');
      saveLocalDbState();

      showNotify('success', `Owner Capital investment of ${formatCurrency(amt)} recorded.`);
      setIsCapitalModalOpen(false);
      setCapitalAmount('');
      setCapitalNotes('');
      onRefresh();
    } catch (err: any) {
      try { getRawSqlDb().run('ROLLBACK;'); } catch {}
      showNotify('error', err.message || 'Failed to record capital.');
    }
  };

  const handleRecordDrawing = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(drawingAmount);
    if (isNaN(amt) || amt <= 0) return;

    try {
      const db = getRawSqlDb();
      const user = AuthService.getActiveSession();
      db.run('BEGIN TRANSACTION;');
      AccountingService.recordOwnerDrawing(db, {
        userId: user?.id || 'usr-admin',
        amount: amt,
        paymentMethod: drawingMethod,
        notes: drawingNotes,
      });
      db.run('COMMIT;');
      saveLocalDbState();

      showNotify('success', `Owner Drawing withdrawal of ${formatCurrency(amt)} recorded.`);
      setIsDrawingModalOpen(false);
      setDrawingAmount('');
      setDrawingNotes('');
      onRefresh();
    } catch (err: any) {
      try { getRawSqlDb().run('ROLLBACK;'); } catch {}
      showNotify('error', err.message || 'Failed to record drawing.');
    }
  };

  return (
    <div className="space-y-6">
      {/* QUICK ACTIONS & CAPITAL CONTROLS */}
      <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-xl shadow-md">
        <div>
          <div className="font-extrabold text-sm tracking-wide">Owner Capital & Fund Management</div>
          <div className="text-xs text-slate-300">Record capital investments or personal owner drawings</div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsCapitalModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5">
            <ArrowUpRight className="h-4 w-4" /> Inject Owner Capital
          </Button>
          <Button onClick={() => setIsDrawingModalOpen(true)} variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs gap-1.5">
            <ArrowDownLeft className="h-4 w-4" /> Record Owner Drawing
          </Button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-emerald-800">TODAY'S SALES REVENUE</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-mono font-black text-emerald-700">{formatCurrency(metrics?.todaySales || 0)}</div></CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-rose-800">TODAY'S OPERATING EXPENSES</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-mono font-black text-rose-700">{formatCurrency(metrics?.todayExpenses || 0)}</div></CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-blue-800">TODAY'S GROSS PROFIT</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-mono font-black text-blue-700">{formatCurrency(metrics?.todayGrossProfit || 0)}</div></CardContent>
        </Card>

        <Card className="border-slate-300 bg-slate-900 text-white">
          <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-slate-300">ESTIMATED NET PROFIT (TODAY)</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-mono font-black text-amber-400">{formatCurrency(metrics?.todayNetProfit || 0)}</div></CardContent>
        </Card>
      </div>

      {/* BALANCE SHEET OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-slate-200 p-3">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5"><Coins className="h-3.5 w-3.5 text-emerald-600" /> Cash Drawer Balance</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">{formatCurrency(metrics?.cashBalance || 0)}</div>
        </Card>

        <Card className="border-slate-200 p-3">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-blue-600" /> Bank Account Balance</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">{formatCurrency(metrics?.bankBalance || 0)}</div>
        </Card>

        <Card className="border-slate-200 p-3">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-purple-600" /> Customer Receivables</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">{formatCurrency(metrics?.customerReceivables || 0)}</div>
        </Card>

        <Card className="border-slate-200 p-3">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-rose-600" /> Supplier Payables</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">{formatCurrency(metrics?.supplierPayables || 0)}</div>
        </Card>

        <Card className="border-slate-200 p-3">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" /> Inventory Valuation</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">{formatCurrency(metrics?.inventoryValue || 0)}</div>
        </Card>
      </div>

      {/* OWNER CAPITAL MODAL */}
      {isCapitalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white border-slate-200 shadow-xl">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-emerald-600" /> Record Owner Capital Contribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleRecordCapital} className="space-y-4 text-xs font-bold">
                <div>
                  <label className="text-slate-700">Investment Amount (LKR)</label>
                  <Input type="number" step="0.01" value={capitalAmount} onChange={(e) => setCapitalAmount(e.target.value)} required placeholder="100000.00" className="mt-1" />
                </div>
                <div>
                  <label className="text-slate-700">Payment Account Destination</label>
                  <select value={capitalMethod} onChange={(e) => setCapitalMethod(e.target.value)} className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white font-bold">
                    <option value="CASH">1010 - Cash Drawer</option>
                    <option value="BANK">1020 - Bank Account</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700">Notes / Reference</label>
                  <Input value={capitalNotes} onChange={(e) => setCapitalNotes(e.target.value)} placeholder="Initial owner investment deposit" className="mt-1" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsCapitalModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-emerald-600 text-white">Inject Capital</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* OWNER DRAWING MODAL */}
      {isDrawingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white border-slate-200 shadow-xl">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-rose-600" /> Record Owner Personal Drawing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleRecordDrawing} className="space-y-4 text-xs font-bold">
                <div>
                  <label className="text-slate-700">Withdrawal Amount (LKR)</label>
                  <Input type="number" step="0.01" value={drawingAmount} onChange={(e) => setDrawingAmount(e.target.value)} required placeholder="10000.00" className="mt-1" />
                </div>
                <div>
                  <label className="text-slate-700">Payout Source Account</label>
                  <select value={drawingMethod} onChange={(e) => setDrawingMethod(e.target.value)} className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white font-bold">
                    <option value="CASH">1010 - Cash Drawer</option>
                    <option value="BANK">1020 - Bank Account</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700">Notes / Purpose</label>
                  <Input value={drawingNotes} onChange={(e) => setDrawingNotes(e.target.value)} placeholder="Personal withdrawal by store owner" className="mt-1" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDrawingModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-rose-600 text-white">Record Drawing</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ======================================================================
// 2. CHART OF ACCOUNTS TAB
// ======================================================================
function ChartOfAccountsTab({
  accounts,
  onRefresh,
  showNotify,
}: {
  accounts: AccountRecord[];
  onRefresh: () => void;
  showNotify: (type: 'success' | 'error', msg: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [accountCode, setAccountCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('EXPENSE');
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalBalance = accountType === 'ASSET' || accountType === 'EXPENSE' || accountType === 'COGS' ? 'DEBIT' : 'CREDIT';
      const raw = getRawSqlDb();
      AccountingService.saveAccount(
        {
          accountCode: accountCode.trim(),
          accountName: accountName.trim(),
          accountType,
          parentId: parentId || null,
          normalBalance,
          description: description.trim(),
        },
        raw
      );

      showNotify('success', `Account ${accountCode} - ${accountName} saved.`);
      setIsAddModalOpen(false);
      setAccountCode('');
      setAccountName('');
      setDescription('');
      onRefresh();
    } catch (err: any) {
      showNotify('error', err.message || 'Failed to save account.');
    }
  };

  const handleToggleActive = (account: AccountRecord) => {
    try {
      const raw = getRawSqlDb();
      AccountingService.toggleAccountActive(account.id, !account.isActive, raw);
      showNotify('success', `Account ${account.accountCode} active status updated.`);
      onRefresh();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (filterType !== 'ALL' && a.accountType !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return a.accountCode.toLowerCase().includes(q) || a.accountName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [accounts, filterType, search]);

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search account code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold"
          >
            <option value="ALL">All Account Types</option>
            <option value="ASSET">ASSETS (1000)</option>
            <option value="LIABILITY">LIABILITIES (2000)</option>
            <option value="EQUITY">EQUITY (3000)</option>
            <option value="INCOME">INCOME (4000)</option>
            <option value="COGS">COST OF SALES (5000)</option>
            <option value="EXPENSE">EXPENSES (6000)</option>
          </select>
        </div>

        <Button onClick={() => setIsAddModalOpen(true)} className="bg-emerald-600 text-white font-bold text-xs gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Add Custom Account
        </Button>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
              <span className="col-span-2">CODE</span>
              <span className="col-span-4">ACCOUNT NAME</span>
              <span className="col-span-2">TYPE</span>
              <span className="col-span-2">NORMAL BALANCE</span>
              <span className="col-span-2 text-right">STATUS / CONTROL</span>
            </div>

            {filtered.map((a) => (
              <div key={a.id} className={`grid grid-cols-12 p-3 items-center text-xs ${!a.isActive ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50'}`}>
                <span className="col-span-2 font-mono font-bold text-slate-900">{a.accountCode}</span>
                <span className="col-span-4 font-bold text-slate-900 flex items-center gap-2">
                  {a.parentId && <span className="text-slate-400 font-normal text-[10px]">└──</span>}
                  {a.accountName}
                  {a.isSystemAccount && <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300 bg-amber-50">SYSTEM</Badge>}
                </span>
                <span className="col-span-2 font-semibold text-slate-600">{a.accountType}</span>
                <span className="col-span-2 font-mono text-[11px] font-bold text-slate-700">{a.normalBalance}</span>
                <span className="col-span-2 text-right flex items-center justify-end gap-2">
                  <Badge variant="outline" className={`text-[10px] ${a.isActive ? 'text-emerald-700 border-emerald-300' : 'text-slate-500'}`}>
                    {a.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {!a.isSystemAccount && (
                    <button
                      onClick={() => handleToggleActive(a)}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-900 underline cursor-pointer"
                    >
                      {a.isActive ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ADD ACCOUNT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white border-slate-200 shadow-xl">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">Add New Chart of Account</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSaveAccount} className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-slate-700">Account Code (Numeric)</label>
                  <Input value={accountCode} onChange={(e) => setAccountCode(e.target.value)} required placeholder="e.g. 6120" className="mt-1" />
                </div>
                <div>
                  <label className="text-slate-700">Account Name</label>
                  <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} required placeholder="e.g. Software Licenses" className="mt-1" />
                </div>
                <div>
                  <label className="text-slate-700">Account Type</label>
                  <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white font-bold">
                    <option value="ASSET">ASSET (Normal Balance: DEBIT)</option>
                    <option value="LIABILITY">LIABILITY (Normal Balance: CREDIT)</option>
                    <option value="EQUITY">EQUITY (Normal Balance: CREDIT)</option>
                    <option value="INCOME">INCOME (Normal Balance: CREDIT)</option>
                    <option value="COGS">COGS (Normal Balance: DEBIT)</option>
                    <option value="EXPENSE">EXPENSE (Normal Balance: DEBIT)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700">Parent Category (Optional)</label>
                  <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white font-bold">
                    <option value="">None (Top-Level Account)</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.accountCode} - {acc.accountName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700">Description</label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Purpose of this account" className="mt-1" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-emerald-600 text-white">Save Account</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ======================================================================
// 3. GENERAL LEDGER TAB
// ======================================================================
function GeneralLedgerTab({ accounts }: { accounts: AccountRecord[] }) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('acc-1010');
  const [ledgerEntries, setLedgerEntries] = useState<GeneralLedgerEntry[]>([]);

  useEffect(() => {
    try {
      const raw = getRawSqlDb();
      const entries = AccountingService.getGeneralLedger(raw, selectedAccountId);
      setLedgerEntries(entries);
    } catch (err) {
      console.error(err);
    }
  }, [selectedAccountId]);

  const selectedAcc = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <label className="text-xs font-bold text-slate-700">Select General Ledger Account:</label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full sm:w-96 h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.accountCode} - {a.accountName} ({a.accountType})</option>
            ))}
          </select>
        </div>

        {selectedAcc && (
          <div className="text-right">
            <div className="text-xs text-slate-500 font-bold">Account Normal Balance</div>
            <div className="text-sm font-mono font-black text-slate-900">{selectedAcc.accountCode} - {selectedAcc.normalBalance}</div>
          </div>
        )}
      </div>

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
              <span className="col-span-2">DATE & TIME</span>
              <span className="col-span-2">JOURNAL REF</span>
              <span className="col-span-4">DESCRIPTION</span>
              <span className="col-span-1 text-right">DEBIT</span>
              <span className="col-span-1 text-right">CREDIT</span>
              <span className="col-span-2 text-right">RUNNING BAL.</span>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                No posted journal transactions for this account.
              </div>
            ) : (
              ledgerEntries.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors">
                  <span className="col-span-2 font-mono text-[11px] text-slate-600">{new Date(l.date).toLocaleString()}</span>
                  <span className="col-span-2 font-mono font-bold text-emerald-700">{l.journalNumber}</span>
                  <span className="col-span-4 font-semibold text-slate-800">{l.description}</span>
                  <span className="col-span-1 text-right font-mono font-bold text-slate-900">{l.debit > 0 ? formatCurrency(l.debit) : '-'}</span>
                  <span className="col-span-1 text-right font-mono font-bold text-slate-900">{l.credit > 0 ? formatCurrency(l.credit) : '-'}</span>
                  <span className="col-span-2 text-right font-mono font-black text-slate-900">{formatCurrency(l.balance)}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ======================================================================
// 4. PROFIT & LOSS TAB
// ======================================================================
function ProfitAndLossTab() {
  const [datePreset, setDatePreset] = useState<'today' | 'month' | 'all'>('month');
  const [pnl, setPnl] = useState<ProfitAndLossReport | null>(null);

  useEffect(() => {
    loadPnL();
  }, [datePreset]);

  const loadPnL = () => {
    try {
      const raw = getRawSqlDb();
      let range: { startDate?: string; endDate?: string } | undefined = undefined;

      const now = new Date();
      if (datePreset === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
        range = { startDate: start, endDate: end };
      } else if (datePreset === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        range = { startDate: start, endDate: end };
      }

      const report = AccountingService.getProfitAndLoss(raw, range);
      setPnl(report);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-4xl mx-auto">
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-700">Filter Period Statement:</div>
        <div className="flex gap-2">
          {['today', 'month', 'all'].map((p) => (
            <Button
              key={p}
              onClick={() => setDatePreset(p as any)}
              variant={datePreset === p ? 'default' : 'outline'}
              size="sm"
              className="text-xs font-bold capitalize"
            >
              {p === 'today' ? "Today's P&L" : p === 'month' ? 'This Month P&L' : 'All-Time P&L'}
            </Button>
          ))}
        </div>
      </div>

      {pnl && (
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="bg-slate-900 text-white p-4 text-center rounded-t-xl">
            <CardTitle className="text-lg font-black tracking-wide">PROFIT & LOSS STATEMENT</CardTitle>
            <p className="text-xs text-slate-400 font-medium">Standard Double-Entry Accrual Income Statement</p>
          </CardHeader>
          <CardContent className="p-6 space-y-6 text-xs font-bold text-slate-900">
            {/* REVENUE SECTION */}
            <div className="space-y-2 border-b border-slate-200 pb-3">
              <div className="text-sm font-extrabold text-emerald-700 tracking-wider">1. REVENUE & INCOME</div>
              <div className="flex justify-between px-3">
                <span className="text-slate-700">Product Sales (Gross)</span>
                <span className="font-mono">{formatCurrency(pnl.grossSales)}</span>
              </div>
              <div className="flex justify-between px-3 text-slate-600 font-normal">
                <span>Other Operating Income</span>
                <span className="font-mono">{formatCurrency(pnl.otherIncome)}</span>
              </div>
              <div className="flex justify-between px-3 text-rose-600 font-normal">
                <span>Less: Sales Returns & Refunds</span>
                <span className="font-mono">-{formatCurrency(pnl.salesReturns)}</span>
              </div>
              <div className="flex justify-between px-3 text-rose-600 font-normal">
                <span>Less: Sales Discounts & Promotional Allowances</span>
                <span className="font-mono">-{formatCurrency(pnl.salesDiscounts)}</span>
              </div>
              <div className="flex justify-between px-3 pt-2 text-sm font-black border-t border-slate-200">
                <span>NET REVENUE</span>
                <span className="font-mono text-emerald-800">{formatCurrency(pnl.netRevenue)}</span>
              </div>
            </div>

            {/* COST OF GOODS SOLD */}
            <div className="space-y-2 border-b border-slate-200 pb-3">
              <div className="text-sm font-extrabold text-slate-800 tracking-wider">2. COST OF SALES</div>
              <div className="flex justify-between px-3 text-slate-700">
                <span>Cost of Goods Sold (COGS)</span>
                <span className="font-mono">-{formatCurrency(pnl.cogs)}</span>
              </div>
              <div className="flex justify-between px-3 pt-2 text-sm font-black border-t border-slate-200 bg-slate-50 p-2 rounded">
                <span>GROSS PROFIT</span>
                <span className="font-mono text-blue-700">{formatCurrency(pnl.grossProfit)}</span>
              </div>
            </div>

            {/* OPERATING EXPENSES */}
            <div className="space-y-2 border-b border-slate-200 pb-3">
              <div className="text-sm font-extrabold text-rose-700 tracking-wider">3. OPERATING EXPENSES</div>
              {pnl.operatingExpenses.length === 0 ? (
                <div className="px-3 text-slate-400 font-normal">No operating expenses recorded in this period.</div>
              ) : (
                pnl.operatingExpenses.map((exp) => (
                  <div key={exp.accountCode} className="flex justify-between px-3 text-slate-700 font-normal">
                    <span>{exp.accountCode} - {exp.accountName}</span>
                    <span className="font-mono">-{formatCurrency(exp.amount)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between px-3 pt-2 text-xs font-bold border-t border-slate-200 text-rose-800">
                <span>TOTAL OPERATING EXPENSES</span>
                <span className="font-mono">-{formatCurrency(pnl.totalExpenses)}</span>
              </div>
            </div>

            {/* NET PROFIT SUMMARY */}
            <div className="flex justify-between p-4 bg-slate-900 text-white rounded-lg text-base font-black">
              <span>ESTIMATED NET PROFIT / (LOSS)</span>
              <span className={`font-mono ${pnl.netProfit >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>{formatCurrency(pnl.netProfit)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ======================================================================
// 5. TRIAL BALANCE TAB
// ======================================================================
function TrialBalanceTab() {
  const [report, setReport] = useState<TrialBalanceReport | null>(null);

  useEffect(() => {
    try {
      const raw = getRawSqlDb();
      const tb = AccountingService.getTrialBalance(raw);
      setReport(tb);
    } catch (err) {
      console.error(err);
    }
  }, []);

  return (
    <div className="space-y-4 font-sans">
      {report && (
        <div
          className={`p-3 rounded-md text-xs font-bold flex items-center justify-between ${
            report.isBalanced ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {report.isBalanced ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-rose-600" />}
            <span>
              {report.isBalanced
                ? 'Accounting Verification Passed: TOTAL DEBITS = TOTAL CREDITS. Ledger is 100% balanced.'
                : 'CRITICAL INTEGRITY ERROR: Total Debits do not equal Total Credits! Inspect manual entries.'}
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">{report.isBalanced ? 'BALANCED' : 'IMBALANCE ALERT'}</Badge>
        </div>
      )}

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
              <span className="col-span-2">CODE</span>
              <span className="col-span-5">ACCOUNT NAME</span>
              <span className="col-span-2">TYPE</span>
              <span className="col-span-1 text-right">DEBIT (LKR)</span>
              <span className="col-span-2 text-right">CREDIT (LKR)</span>
            </div>

            {report?.rows.map((r) => (
              <div key={r.accountId} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors">
                <span className="col-span-2 font-mono font-bold">{r.accountCode}</span>
                <span className="col-span-5 font-bold">{r.accountName}</span>
                <span className="col-span-2 font-semibold text-slate-600">{r.accountType}</span>
                <span className="col-span-1 text-right font-mono font-bold">{r.debit > 0 ? formatCurrency(r.debit) : '-'}</span>
                <span className="col-span-2 text-right font-mono font-bold">{r.credit > 0 ? formatCurrency(r.credit) : '-'}</span>
              </div>
            ))}

            <div className="grid grid-cols-12 p-4 text-xs font-black bg-slate-900 text-white border-t-2 border-slate-900">
              <span className="col-span-9">TOTAL GENERAL LEDGER TRIAL BALANCE</span>
              <span className="col-span-1 text-right font-mono text-emerald-400">{formatCurrency(report?.totalDebit || 0)}</span>
              <span className="col-span-2 text-right font-mono text-emerald-400">{formatCurrency(report?.totalCredit || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ======================================================================
// 6. JOURNAL ENTRIES TAB
// ======================================================================
function JournalEntriesTab({
  journals,
  accounts,
  onRefresh,
  showNotify,
}: {
  journals: JournalEntryRecord[];
  accounts: AccountRecord[];
  onRefresh: () => void;
  showNotify: (type: 'success' | 'error', msg: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Manual Journal Form State
  const [description, setDescription] = useState('');
  const [manualLines, setManualLines] = useState<Array<{ accountId: string; debit: string; credit: string }>>([
    { accountId: accounts[0]?.id || 'acc-1010', debit: '', credit: '' },
    { accountId: accounts[1]?.id || 'acc-4010', debit: '', credit: '' },
  ]);

  const handleAddLine = () => {
    setManualLines([...manualLines, { accountId: accounts[0]?.id || 'acc-1010', debit: '', credit: '' }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (manualLines.length <= 2) return;
    setManualLines(manualLines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: 'accountId' | 'debit' | 'credit', val: string) => {
    const updated = [...manualLines];
    updated[idx] = { ...updated[idx], [field]: val };
    setManualLines(updated);
  };

  const totalDebitSum = manualLines.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCreditSum = manualLines.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const isFormBalanced = Math.abs(totalDebitSum - totalCreditSum) < 0.009 && totalDebitSum > 0;

  const handlePostManualJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormBalanced) {
      showNotify('error', `Cannot post unbalanced journal! Total Debits (${totalDebitSum}) must equal Total Credits (${totalCreditSum}).`);
      return;
    }

    try {
      const raw = getRawSqlDb();
      const user = AuthService.getActiveSession();

      const lines = manualLines.map((l) => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      }));

      raw.run('BEGIN TRANSACTION;');
      AccountingService.postJournalEntry(
        raw,
        {
          referenceType: 'MANUAL',
          description: description.trim(),
          createdBy: user?.id || 'usr-admin',
        },
        lines
      );
      raw.run('COMMIT;');
      saveLocalDbState();

      showNotify('success', 'Manual Journal Entry posted successfully to General Ledger.');
      setIsManualModalOpen(false);
      setDescription('');
      onRefresh();
    } catch (err: any) {
      try { getRawSqlDb().run('ROLLBACK;'); } catch {}
      showNotify('error', err.message);
    }
  };

  const handleVoidEntry = (entry: JournalEntryRecord) => {
    if (!window.confirm(`Are you sure you want to void journal entry #${entry.journalNumber}? Reversal lines will be posted.`)) return;
    try {
      const raw = getRawSqlDb();
      const user = AuthService.getActiveSession();
      raw.run('BEGIN TRANSACTION;');
      AccountingService.voidJournalEntry(raw, entry.id, user?.id || 'usr-admin', 'User requested transaction void');
      raw.run('COMMIT;');
      saveLocalDbState();

      showNotify('success', `Journal Entry #${entry.journalNumber} voided.`);
      onRefresh();
    } catch (err: any) {
      try { getRawSqlDb().run('ROLLBACK;'); } catch {}
      showNotify('error', err.message);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex justify-end">
        <Button onClick={() => setIsManualModalOpen(true)} className="bg-emerald-600 text-white font-bold text-xs gap-1.5">
          <Plus className="h-4 w-4" /> Post Manual Journal Entry
        </Button>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
              <span className="col-span-2">JOURNAL NO.</span>
              <span className="col-span-2">DATE & TIME</span>
              <span className="col-span-2">REF TYPE</span>
              <span className="col-span-3">DESCRIPTION</span>
              <span className="col-span-1">STATUS</span>
              <span className="col-span-2 text-right">TOTAL AMOUNT</span>
            </div>

            {journals.map((j) => (
              <React.Fragment key={j.id}>
                <div
                  onClick={() => setExpandedId(expandedId === j.id ? null : j.id)}
                  className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <span className="col-span-2 font-mono font-bold text-emerald-700">{j.journalNumber}</span>
                  <span className="col-span-2 font-mono text-[11px] text-slate-600">{new Date(j.transactionDate).toLocaleString()}</span>
                  <span className="col-span-2 font-bold">
                    <Badge variant="outline" className="text-[10px]">{j.referenceType}</Badge>
                  </span>
                  <span className="col-span-3 font-medium text-slate-800 truncate">{j.description}</span>
                  <span className="col-span-1 font-bold">
                    <Badge variant={j.status === 'POSTED' ? 'default' : 'secondary'} className="text-[9px]">
                      {j.status}
                    </Badge>
                  </span>
                  <span className="col-span-2 text-right font-mono font-bold">
                    {formatCurrency(j.totalDebit || 0)}
                  </span>
                </div>

                {/* EXPANDED LINES DETAIL */}
                {expandedId === j.id && (
                  <div className="p-4 bg-slate-50 border-y border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-slate-700">Journal Line Items Breakdown:</span>
                      {j.status === 'POSTED' && (
                        <Button onClick={() => handleVoidEntry(j)} size="sm" variant="destructive" className="h-7 text-[10px] font-bold gap-1">
                          <Ban className="h-3 w-3" /> Void Transaction
                        </Button>
                      )}
                    </div>
                    <div className="divide-y divide-slate-200 bg-white rounded border border-slate-200">
                      {j.lines.map((l) => (
                        <div key={l.id} className="grid grid-cols-12 p-2 items-center text-[11px]">
                          <span className="col-span-3 font-mono font-bold text-slate-800">{l.accountCode} - {l.accountName}</span>
                          <span className="col-span-5 text-slate-600">{l.description || j.description}</span>
                          <span className="col-span-2 text-right font-mono font-bold text-slate-900">{l.debit > 0 ? formatCurrency(l.debit) : '-'}</span>
                          <span className="col-span-2 text-right font-mono font-bold text-slate-900">{l.credit > 0 ? formatCurrency(l.credit) : '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* MANUAL JOURNAL MODAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl bg-white border-slate-200 shadow-xl">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">Post Manual Double-Entry Journal</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <form onSubmit={handlePostManualJournal} className="space-y-4 text-xs font-bold">
                <div>
                  <label className="text-slate-700">Transaction Description / Purpose</label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="e.g. Monthly Depreciation Adjustment" className="mt-1" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Journal Lines (Min 2 Lines Required):</span>
                    <Button type="button" onClick={handleAddLine} variant="outline" size="sm" className="h-7 text-[10px]">
                      + Add Line
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {manualLines.map((l, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <select
                          value={l.accountId}
                          onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                          className="col-span-5 h-9 px-2 border border-slate-300 rounded bg-white text-xs font-bold"
                        >
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>{acc.accountCode} - {acc.accountName} ({acc.normalBalance})</option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Debit"
                          value={l.debit}
                          onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                          className="col-span-3 h-9"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Credit"
                          value={l.credit}
                          onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                          className="col-span-3 h-9"
                        />
                        <button type="button" onClick={() => handleRemoveLine(idx)} className="col-span-1 text-rose-600 font-bold hover:underline text-center">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-3 rounded-md flex items-center justify-between font-mono ${isFormBalanced ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  <span>TOTAL DEBITS: <strong>{formatCurrency(totalDebitSum)}</strong></span>
                  <span>TOTAL CREDITS: <strong>{formatCurrency(totalCreditSum)}</strong></span>
                  <Badge variant="outline" className={isFormBalanced ? 'text-emerald-700' : 'text-rose-700'}>
                    {isFormBalanced ? 'BALANCED' : 'IMBALANCED'}
                  </Badge>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsManualModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={!isFormBalanced} className="bg-emerald-600 text-white">Post Journal Entry</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ======================================================================
// 7. ACCOUNT MAPPINGS TAB
// ======================================================================
function AccountMappingsTab({
  mappings,
  accounts,
  onRefresh,
  showNotify,
}: {
  mappings: AccountMappingRecord[];
  accounts: AccountRecord[];
  onRefresh: () => void;
  showNotify: (type: 'success' | 'error', msg: string) => void;
}) {
  const handleMappingChange = (key: string, newAccountId: string) => {
    try {
      const raw = getRawSqlDb();
      AccountingService.updateAccountMapping(key, newAccountId, raw);
      showNotify('success', `Account mapping for ${key} updated.`);
      onRefresh();
    } catch (err: any) {
      showNotify('error', err.message);
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-4xl mx-auto">
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-sm font-bold text-slate-900">Automatic POS Account Mappings</CardTitle>
          <p className="text-xs text-slate-500 font-normal">
            Configure default double-entry general ledger accounts for automated POS checkout, purchasing, and expenses.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {mappings.map((m) => (
              <div key={m.id} className="grid grid-cols-12 p-3 items-center text-xs">
                <span className="col-span-4 font-mono font-extrabold text-slate-900">{m.mappingKey}</span>
                <select
                  value={m.accountId}
                  onChange={(e) => handleMappingChange(m.mappingKey, e.target.value)}
                  className="col-span-8 h-9 px-3 border border-slate-300 rounded-md bg-white font-bold text-slate-900"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.accountCode} - {acc.accountName} ({acc.accountType})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
