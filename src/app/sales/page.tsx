'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, 
  Search, 
  SlidersHorizontal, 
  RefreshCw, 
  Download, 
  Eye, 
  Printer, 
  MoreHorizontal, 
  Trash2, 
  RotateCcw, 
  Ban, 
  History, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  User, 
  Calendar, 
  CreditCard, 
  Wallet,
  Building,
  ShieldCheck,
  Check
} from 'lucide-react';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteSaleRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { SaleEntity } from '@/domain/entities/Sale';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { AuthService } from '@/features/auth/AuthService';
import { isDesktopApp, printReceiptNative } from '@/lib/electronBridge';
import { defaultSettingsService, ShopSettings, DEFAULT_SHOP_SETTINGS } from '@/services/settings/SettingsService';

export default function SalesPage() {
  return (
    <PermissionGuard permission={['sales.view', 'sales.view_all', 'sales.view_own', 'orders.view']} moduleName="Sales History & Completed Invoices">
      <SalesContent />
    </PermissionGuard>
  );
}

function SalesContent() {
  const [sales, setSales] = useState<SaleEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);

  // Active Session & User Permissions
  const [activeUser, setActiveUser] = useState<any>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  // Filter States
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | '7days' | '30days' | 'month' | 'all'>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCashier, setSelectedCashier] = useState<string>('all');
  const [selectedRegister, setSelectedRegister] = useState<string>('all');

  // Drawer & Modal States
  const [drawerSale, setDrawerSale] = useState<SaleEntity | null>(null);
  const [selectedPrintSale, setSelectedPrintSale] = useState<SaleEntity | null>(null);
  const [openMoreMenuSaleId, setOpenMoreMenuSaleId] = useState<string | null>(null);

  // Admin Delete Modal State
  const [deleteTargetSale, setDeleteTargetSale] = useState<SaleEntity | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [deleteAdminPin, setDeleteAdminPin] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Refund / Void Modal State
  const [actionTargetSale, setActionTargetSale] = useState<{ sale: SaleEntity; type: 'REFUND' | 'VOID' } | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Audit Trail Modal State
  const [auditTargetSale, setAuditTargetSale] = useState<SaleEntity | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await getLocalDb();
      const shopSettings = await defaultSettingsService.getSettings();
      setSettings(shopSettings);

      const session = AuthService.getActiveSession();
      setActiveUser(session);
      setUserPermissions(session?.permissions || []);

      const saleRepo = new SQLiteSaleRepository();
      const list = await saleRepo.getRecentSales(2000);
      setSales(list);
    } catch (err) {
      console.error('[SalesPage] Failed to load sales history:', err);
    } finally {
      setLoading(false);
    }
  };

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // ----------------------------------------------------------------------
  // RBAC COMPUTED PERMISSIONS
  // ----------------------------------------------------------------------
  const isAdmin = useMemo(() => {
    if (!activeUser) return true;
    const role = (activeUser.roleName || activeUser.role || '').toUpperCase();
    return role.includes('ADMIN') || role.includes('SUPER') || userPermissions.includes('*');
  }, [activeUser, userPermissions]);

  const canViewAll = useMemo(() => {
    if (!activeUser) return true;
    const role = (activeUser.roleName || activeUser.role || '').toUpperCase();
    if (role.includes('ADMIN') || role.includes('SUPER') || role.includes('MANAGER') || role.includes('ACCOUNTANT') || role.includes('AUDITOR')) {
      return true;
    }
    return (
      isAdmin ||
      userPermissions.includes('sales.view_all') ||
      userPermissions.includes('sales.view') ||
      userPermissions.includes('orders.view') ||
      userPermissions.includes('p-orders-view') ||
      userPermissions.length === 0
    );
  }, [isAdmin, activeUser, userPermissions]);

  const canExport = useMemo(() => {
    return isAdmin || userPermissions.includes('sales.export') || userPermissions.includes('reports.export');
  }, [isAdmin, userPermissions]);

  const canRefund = useMemo(() => {
    return isAdmin || userPermissions.includes('sales.refund') || userPermissions.includes('payments.refund') || userPermissions.includes('p-pay-refund');
  }, [isAdmin, userPermissions]);

  const canVoid = useMemo(() => {
    return isAdmin || userPermissions.includes('sales.void') || userPermissions.includes('payments.void') || userPermissions.includes('p-orders-void');
  }, [isAdmin, userPermissions]);

  const canDelete = useMemo(() => {
    // STRICTLY ADMIN / SUPER ADMIN ONLY
    return isAdmin || userPermissions.includes('sales.delete');
  }, [isAdmin, userPermissions]);

  const canViewAudit = useMemo(() => {
    return isAdmin || userPermissions.includes('sales.view_audit') || userPermissions.includes('audit_logs.view') || userPermissions.includes('p-audit-view');
  }, [isAdmin, userPermissions]);

  // ----------------------------------------------------------------------
  // FILTERING & SCOPING LOGIC
  // ----------------------------------------------------------------------
  const filteredSales = useMemo(() => {
    const currentUserId = activeUser?.id || activeUser?.userId;
    return sales.filter((s) => {
      // 1. RBAC User Scoping
      if (!canViewAll && currentUserId && s.userId && s.userId !== currentUserId) {
        return false;
      }

      // 2. Hide Deleted Sales unless Admin specifically selects 'DELETED' status filter
      if (s.status === 'DELETED' && selectedStatus !== 'DELETED') {
        return false;
      }

      // 3. Search Query Filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesInvoice = s.invoiceNumber.toLowerCase().includes(q);
        const matchesTx = s.clientTransactionId.toLowerCase().includes(q);
        const matchesNotes = (s.notes || '').toLowerCase().includes(q);
        const matchesItems = s.items.some((i) => i.productName.toLowerCase().includes(q));
        const matchesCustomer = (s.customerName || '').toLowerCase().includes(q);
        if (!matchesInvoice && !matchesTx && !matchesNotes && !matchesItems && !matchesCustomer) {
          return false;
        }
      }

      // 4. Date Presets
      if (datePreset !== 'all') {
        const saleDate = new Date(s.createdAt);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (datePreset === 'today') {
          if (saleDate < todayStart) return false;
        } else if (datePreset === 'yesterday') {
          const yestStart = new Date(todayStart);
          yestStart.setDate(yestStart.getDate() - 1);
          if (saleDate < yestStart || saleDate >= todayStart) return false;
        } else if (datePreset === '7days') {
          const d7 = new Date(todayStart);
          d7.setDate(d7.getDate() - 7);
          if (saleDate < d7) return false;
        } else if (datePreset === '30days') {
          const d30 = new Date(todayStart);
          d30.setDate(d30.getDate() - 30);
          if (saleDate < d30) return false;
        } else if (datePreset === 'month') {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          if (saleDate < monthStart) return false;
        }
      }

      // 5. Payment Method Filter
      if (selectedPaymentMethod !== 'all') {
        const hasMethod = s.payments.some((p) => p.methodCode.toUpperCase() === selectedPaymentMethod.toUpperCase());
        if (!hasMethod) return false;
      }

      // 6. Status Filter
      if (selectedStatus !== 'all') {
        if (s.status.toUpperCase() !== selectedStatus.toUpperCase()) return false;
      }

      // 7. Register / Terminal Filter
      if (selectedRegister !== 'all') {
        if (s.terminalId !== selectedRegister && !s.terminalId?.includes(selectedRegister)) return false;
      }

      return true;
    });
  }, [sales, canViewAll, activeUser, search, datePreset, selectedPaymentMethod, selectedStatus, selectedRegister]);

  // Unique list of Cashiers & Registers for filter options
  const cashierOptions = useMemo(() => {
    const map = new Map<string, string>();
    sales.forEach((s) => {
      if (s.userId) map.set(s.userId, s.userId);
    });
    return Array.from(map.values());
  }, [sales]);

  // Paginated Output
  const totalPages = Math.ceil(filteredSales.length / pageSize) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage, pageSize]);

  // ----------------------------------------------------------------------
  // SUMMARY METRICS (TOP SUMMARY BAR)
  // ----------------------------------------------------------------------
  const summaryMetrics = useMemo(() => {
    const validSales = filteredSales.filter((s) => s.status !== 'DELETED' && s.status !== 'VOIDED');
    const totalCount = validSales.length;
    const totalRevenue = validSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const avgOrder = totalCount > 0 ? totalRevenue / totalCount : 0;

    let cashTotal = 0;
    let cardTotal = 0;
    let creditTotal = 0;
    let qrTotal = 0;

    validSales.forEach((s) => {
      s.payments.forEach((p) => {
        const m = p.methodCode.toUpperCase();
        if (m === 'CASH') cashTotal += p.amount;
        else if (m === 'CARD' || m === 'CREDIT_CARD') cardTotal += p.amount;
        else if (m === 'STORE_CREDIT' || m === 'CREDIT') creditTotal += p.amount;
        else if (m === 'QR' || m === 'BANK_QR') qrTotal += p.amount;
      });
    });

    return { totalCount, totalRevenue, avgOrder, cashTotal, cardTotal, creditTotal, qrTotal };
  }, [filteredSales]);

  // ----------------------------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------------------------
  const handleClearFilters = () => {
    setSearch('');
    setDatePreset('all');
    setSelectedPaymentMethod('all');
    setSelectedStatus('all');
    setSelectedCashier('all');
    setSelectedRegister('all');
    setCurrentPage(1);
  };

  const handlePrintReceiptDirect = (sale: SaleEntity) => {
    if (isDesktopApp()) {
      printReceiptNative({
        silent: settings.silentPrinting !== false,
        deviceName: settings.selectedPrinterName || '',
        pageSize: settings.paperSize || '80mm',
      });
      showNotify('success', `Receipt for INV-${sale.invoiceNumber} transmitted to printer.`);
    } else {
      setSelectedPrintSale(sale);
    }
  };

  const handleExportCSV = () => {
    if (!canExport) {
      showNotify('error', 'Access Restricted: You lack sales.export permission.');
      return;
    }
    if (filteredSales.length === 0) {
      showNotify('error', 'No sales records available to export.');
      return;
    }

    const headers = ['Invoice Number', 'Client Transaction ID', 'Date & Time', 'Status', 'Subtotal', 'Discount', 'Tax', 'Total Amount', 'Payment Methods', 'Terminal ID'];
    const rows = filteredSales.map((s) => [
      s.invoiceNumber,
      s.clientTransactionId,
      new Date(s.createdAt).toLocaleString(),
      s.status,
      s.customerName || (s.customerId ? 'Registered Customer' : 'Walk-in Customer'),
      s.subtotal.toFixed(2),
      s.discountAmount.toFixed(2),
      s.taxAmount.toFixed(2),
      s.totalAmount.toFixed(2),
      s.payments.map((p) => `${p.methodCode}:${p.amount}`).join('; '),
      s.terminalId,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `triwyn_sales_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotify('success', `Exported ${filteredSales.length} sale records to CSV.`);
  };

  // Executing Admin Soft Delete
  const handleConfirmDeleteSale = async () => {
    if (!deleteTargetSale) return;
    if (!canDelete) {
      setDeleteError('Access Denied: Deleting sales is strictly reserved for Administrators.');
      return;
    }
    if (!deleteReason.trim() || deleteReason.trim().length < 3) {
      setDeleteError('Please provide a mandatory reason for deleting this transaction.');
      return;
    }
    if (!deleteConfirmChecked) {
      setDeleteError('Please confirm the mandatory checkbox before deleting.');
      return;
    }

    try {
      const saleRepo = new SQLiteSaleRepository();
      const success = await saleRepo.deleteSale(deleteTargetSale.id, activeUser?.userId || 'usr-admin', deleteReason.trim());
      if (success) {
        showNotify('success', `Sale ${deleteTargetSale.invoiceNumber} soft-deleted and logged in audit trail.`);
        setDeleteTargetSale(null);
        setDeleteReason('');
        setDeleteConfirmChecked(false);
        setDeleteAdminPin('');
        setDeleteError('');
        if (drawerSale?.id === deleteTargetSale.id) setDrawerSale(null);
        await loadInitialData();
      } else {
        setDeleteError('Failed to delete sale from database.');
      }
    } catch (err: any) {
      setDeleteError(`Delete error: ${err.message}`);
    }
  };

  // Executing Refund / Void
  const handleExecuteAction = async () => {
    if (!actionTargetSale) return;
    if (!actionReason.trim()) {
      showNotify('error', 'Please provide a reason for this operation.');
      return;
    }

    const { sale, type } = actionTargetSale;
    const saleRepo = new SQLiteSaleRepository();

    try {
      if (type === 'REFUND') {
        const ok = await saleRepo.refundSale(sale.id, activeUser?.userId || 'usr-admin', actionReason.trim());
        if (ok) showNotify('success', `Sale ${sale.invoiceNumber} marked as REFUNDED.`);
      } else if (type === 'VOID') {
        const ok = await saleRepo.voidSale(sale.id, activeUser?.userId || 'usr-admin', actionReason.trim());
        if (ok) showNotify('success', `Sale ${sale.invoiceNumber} marked as VOIDED.`);
      }
      setActionTargetSale(null);
      setActionReason('');
      if (drawerSale?.id === sale.id) setDrawerSale(null);
      await loadInitialData();
    } catch (err: any) {
      showNotify('error', `Operation failed: ${err.message}`);
    }
  };

  // View Audit Trail Drawer Modal
  const handleViewAuditTrail = async (sale: SaleEntity) => {
    setAuditTargetSale(sale);
    setLoadingAudit(true);
    try {
      await getLocalDb();
      const saleRepo = new SQLiteSaleRepository();
      const logs = await saleRepo.getSaleAuditTrail(sale.id);
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 font-sans text-slate-900 select-none">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" /> Sales History & Transaction Management
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            View completed sales, invoices, payment breakdowns, reprint receipts, and audit transactions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-1.5 text-xs font-bold border-slate-300">
              <Download className="h-3.5 w-3.5 text-slate-600" /> Export CSV
            </Button>
          )}
          <Button onClick={loadInitialData} variant="outline" size="sm" className="gap-1.5 text-xs font-bold border-slate-300">
            <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      {notification && (
        <div
          className={`p-3 rounded-md text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* 2. TOP SALES SUMMARY BAR (COMPACT KPI CARDS) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Total Sales Count */}
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed Orders</div>
          <div className="text-xl font-black text-slate-900 mt-1 font-mono">{summaryMetrics.totalCount} Orders</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">Filtered date & scope</div>
        </div>

        {/* Total Net Revenue */}
        <div className="md:col-span-4 bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sales Volume</div>
          <div className="text-xl font-black text-emerald-600 mt-1 font-mono">{formatCurrency(summaryMetrics.totalRevenue)}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">Avg Order: {formatCurrency(summaryMetrics.avgOrder)}</div>
        </div>

        {/* Payment Breakdown Pills */}
        <div className="md:col-span-5 bg-white border border-slate-200 rounded-lg p-3 shadow-2xs flex flex-col justify-center">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Method Volume</div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[11px]">
              Cash: {formatCurrency(summaryMetrics.cashTotal)}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[11px]">
              Card: {formatCurrency(summaryMetrics.cardTotal)}
            </span>
            {summaryMetrics.creditTotal > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[11px]">
                Credit: {formatCurrency(summaryMetrics.creditTotal)}
              </span>
            )}
            {summaryMetrics.qrTotal > 0 && (
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-[11px]">
                QR: {formatCurrency(summaryMetrics.qrTotal)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. PROMINENT SEARCH & COMPACT FILTER CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Prominent Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by invoice #, transaction ID, customer, cashier, product..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 bg-slate-50 border-slate-300 text-xs font-medium focus:bg-white"
            />
          </div>

          {/* Quick Date Presets Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200 shrink-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
              { id: 'month', label: 'This Month' },
            ].map((dp) => (
              <button
                key={dp.id}
                onClick={() => {
                  setDatePreset(dp.id as any);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  datePreset === dp.id ? 'bg-white text-emerald-700 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {dp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Second Row Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-bold text-slate-600">Filters:</span>
          </div>

          {/* Payment Method Selector */}
          <select
            value={selectedPaymentMethod}
            onChange={(e) => {
              setSelectedPaymentMethod(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 px-2 border border-slate-300 rounded bg-white font-semibold text-slate-800 text-xs cursor-pointer"
          >
            <option value="all">All Payment Methods</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card / Credit Terminal</option>
            <option value="STORE_CREDIT">Store Credit</option>
            <option value="QR">Bank QR</option>
          </select>

          {/* Status Selector */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 px-2 border border-slate-300 rounded bg-white font-semibold text-slate-800 text-xs cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="COMPLETED">Paid (Completed)</option>
            <option value="REFUNDED">Refunded</option>
            <option value="VOIDED">Voided</option>
            {isAdmin && <option value="DELETED">Deleted Sales (Admin Only)</option>}
          </select>

          {/* Register Selector */}
          <select
            value={selectedRegister}
            onChange={(e) => {
              setSelectedRegister(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 px-2 border border-slate-300 rounded bg-white font-semibold text-slate-800 text-xs cursor-pointer"
          >
            <option value="all">All Registers / Terminals</option>
            <option value="term-001">POS-01 (Main Terminal)</option>
            <option value="term-002">POS-02</option>
            <option value="term-003">POS-03</option>
          </select>

          {/* Clear Filters Button */}
          {(search || datePreset !== 'all' || selectedPaymentMethod !== 'all' || selectedStatus !== 'all' || selectedRegister !== 'all') && (
            <Button onClick={handleClearFilters} variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
              Clear Filters
            </Button>
          )}

          <div className="ml-auto text-[11px] font-bold text-slate-500 font-mono">
            Showing {filteredSales.length} {filteredSales.length === 1 ? 'sale' : 'sales'}
          </div>
        </div>
      </div>

      {/* 4. SALES ENTERPRISE TABLE */}
      <Card className="overflow-hidden border-slate-200 bg-white shadow-2xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-3">Invoice & Date</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Cashier</th>
                  <th className="p-3">Terminal</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3 text-right">Total Amount</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                      Loading sales transactions...
                    </td>
                  </tr>
                ) : paginatedSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-500">
                      <Receipt className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <div className="font-bold text-sm text-slate-700">No completed sales found</div>
                      <div className="text-xs text-slate-400 mt-0.5">Try clearing filters or changing your search criteria</div>
                    </td>
                  </tr>
                ) : (
                  paginatedSales.map((sale) => {
                    const isDeleted = sale.status === 'DELETED';
                    const isRefunded = sale.status === 'REFUNDED';
                    const isVoided = sale.status === 'VOIDED';

                    return (
                      <tr
                        key={sale.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isDeleted ? 'bg-red-50/20 text-slate-400' : ''
                        }`}
                      >
                        {/* Invoice & Date */}
                        <td className="p-3">
                          <button
                            onClick={() => setDrawerSale(sale)}
                            className="font-mono font-bold text-slate-900 hover:text-emerald-600 hover:underline text-left block"
                          >
                            {sale.invoiceNumber}
                          </button>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {new Date(sale.createdAt).toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="p-3 font-medium text-slate-700">
                          {sale.customerName || (sale.customerId ? 'Registered Customer' : 'Walk-in Customer')}
                        </td>

                        {/* Cashier */}
                        <td className="p-3 font-medium text-slate-700 flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{sale.userId === activeUser?.userId ? 'Me' : sale.userId || 'Main Cashier'}</span>
                        </td>

                        {/* Terminal */}
                        <td className="p-3 font-mono text-[11px] text-slate-500">
                          {sale.terminalId || 'POS-01'}
                        </td>

                        {/* Payment Badges */}
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {sale.payments.map((p) => (
                              <span
                                key={p.id}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 font-mono border border-slate-200"
                              >
                                {p.methodCode}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Total Amount */}
                        <td className="p-3 text-right font-mono font-bold text-slate-900 text-sm">
                          {formatCurrency(sale.totalAmount)}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3 text-center">
                          {isDeleted ? (
                            <Badge variant="outline" className="bg-slate-900 text-white text-[10px] font-bold gap-1">
                              <Lock className="h-3 w-3" /> DELETED
                            </Badge>
                          ) : isRefunded ? (
                            <Badge variant="warning" className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold gap-1">
                              <RotateCcw className="h-3 w-3" /> REFUNDED
                            </Badge>
                          ) : isVoided ? (
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-[10px] font-bold gap-1">
                              <Ban className="h-3 w-3" /> VOIDED
                            </Badge>
                          ) : (
                            <Badge variant="online" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold gap-1">
                              <CheckCircle className="h-3 w-3 text-emerald-600" /> PAID
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right relative">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              onClick={() => setDrawerSale(sale)}
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs font-bold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 px-2 gap-1"
                            >
                              <Eye className="h-3.5 w-3.5 text-emerald-600" /> View
                            </Button>

                            {/* More Actions Dropdown Toggle */}
                            <div className="relative">
                              <button
                                onClick={() => setOpenMoreMenuSaleId(openMoreMenuSaleId === sale.id ? null : sale.id)}
                                className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>

                              {/* Dropdown Menu */}
                              {openMoreMenuSaleId === sale.id && (
                                <div className="absolute right-0 top-8 z-30 w-48 bg-white border border-slate-200 rounded-lg shadow-xl p-1 text-xs font-medium space-y-0.5 text-left animate-in fade-in">
                                  <button
                                    onClick={() => { setDrawerSale(sale); setOpenMoreMenuSaleId(null); }}
                                    className="w-full px-2.5 py-1.5 rounded hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-slate-500" /> View Sale Details
                                  </button>

                                  <button
                                    onClick={() => { handlePrintReceiptDirect(sale); setOpenMoreMenuSaleId(null); }}
                                    className="w-full px-2.5 py-1.5 rounded hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                                  >
                                    <Printer className="h-3.5 w-3.5 text-slate-500" /> Reprint Receipt
                                  </button>

                                  {canViewAudit && (
                                    <button
                                      onClick={() => { handleViewAuditTrail(sale); setOpenMoreMenuSaleId(null); }}
                                      className="w-full px-2.5 py-1.5 rounded hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                                    >
                                      <History className="h-3.5 w-3.5 text-slate-500" /> View Audit Trail
                                    </button>
                                  )}

                                  {!isDeleted && !isRefunded && canRefund && (
                                    <button
                                      onClick={() => { setActionTargetSale({ sale, type: 'REFUND' }); setOpenMoreMenuSaleId(null); }}
                                      className="w-full px-2.5 py-1.5 rounded hover:bg-amber-50 flex items-center gap-2 text-amber-800 cursor-pointer"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 text-amber-600" /> Refund Sale
                                    </button>
                                  )}

                                  {!isDeleted && !isVoided && canVoid && (
                                    <button
                                      onClick={() => { setActionTargetSale({ sale, type: 'VOID' }); setOpenMoreMenuSaleId(null); }}
                                      className="w-full px-2.5 py-1.5 rounded hover:bg-red-50 flex items-center gap-2 text-red-800 cursor-pointer"
                                    >
                                      <Ban className="h-3.5 w-3.5 text-red-600" /> Void Sale
                                    </button>
                                  )}

                                  {/* STRICTLY ADMIN-ONLY DELETE ACTION */}
                                  {canDelete && !isDeleted && (
                                    <>
                                      <div className="border-t border-slate-100 my-1" />
                                      <button
                                        onClick={() => { setDeleteTargetSale(sale); setOpenMoreMenuSaleId(null); setDeleteError(''); }}
                                        className="w-full px-2.5 py-1.5 rounded hover:bg-red-50 flex items-center gap-2 text-red-600 font-bold cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-red-600" /> Delete Sale (Admin)
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-slate-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredSales.length}
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

      {/* 5. SLIDE-OUT SALE DETAILS DRAWER */}
      {drawerSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono font-black text-base text-slate-900">{drawerSale.invoiceNumber}</h3>
                  <Badge variant="online" className="text-[10px] font-bold">
                    {drawerSale.status}
                  </Badge>
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  {new Date(drawerSale.createdAt).toLocaleString()}
                </div>
              </div>
              <button onClick={() => setDrawerSale(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5 text-xs">
              {/* Order Metadata */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Cashier</div>
                  <div className="font-semibold text-slate-900">{drawerSale.userId || 'Main Cashier'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Terminal / Register</div>
                  <div className="font-semibold text-slate-900">{drawerSale.terminalId || 'POS-01'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Customer</div>
                  <div className="font-semibold text-slate-900">{drawerSale.customerName || (drawerSale.customerId ? 'Registered Customer' : 'Walk-in Customer')}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Client TX ID</div>
                  <div className="font-mono text-[10px] text-slate-700 truncate">{drawerSale.clientTransactionId}</div>
                </div>
              </div>

              {/* Purchased Items List */}
              <div className="space-y-2">
                <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider border-b border-slate-100 pb-1">
                  Purchased Items ({drawerSale.items.length})
                </div>
                <div className="divide-y divide-slate-100">
                  {drawerSale.items.map((item) => (
                    <div key={item.id} className="py-2 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="text-[10px] text-slate-500">
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        {formatCurrency(item.totalAmount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(drawerSale.subtotal)}</span>
                </div>
                {drawerSale.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span>-{formatCurrency(drawerSale.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Tax:</span>
                  <span>{formatCurrency(drawerSale.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-300 pt-1.5 mt-1">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(drawerSale.totalAmount)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-2">
                <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider border-b border-slate-100 pb-1">
                  Payment Ledger
                </div>
                <div className="space-y-1 text-slate-700 font-mono">
                  {drawerSale.payments.map((p) => (
                    <div key={p.id} className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200 text-xs">
                      <span className="font-bold text-slate-800">{p.methodCode}</span>
                      <span>{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={() => handlePrintReceiptDirect(drawerSale)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 text-xs"
                >
                  <Printer className="h-4 w-4" /> Print Receipt
                </Button>
                {canViewAudit && (
                  <Button onClick={() => handleViewAuditTrail(drawerSale)} variant="outline" className="flex-1 text-xs font-bold gap-1.5">
                    <History className="h-4 w-4 text-slate-600" /> Audit Trail
                  </Button>
                )}
              </div>

              {/* Admin Delete inside Drawer */}
              {canDelete && drawerSale.status !== 'DELETED' && (
                <Button
                  onClick={() => {
                    setDeleteTargetSale(drawerSale);
                    setDeleteReason('');
                    setDeleteConfirmChecked(false);
                    setDeleteError('');
                  }}
                  variant="outline"
                  className="w-full text-xs font-bold text-red-600 hover:bg-red-50 border-red-200 gap-1.5"
                >
                  <Trash2 className="h-4 w-4 text-red-600" /> Delete Sale (Admin Only)
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. ADMIN DELETE CONFIRMATION MODAL */}
      {deleteTargetSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-red-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="h-5 w-5 text-amber-300" /> Delete Sale Record (Admin Action)
              </div>
              <button onClick={() => setDeleteTargetSale(null)} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 space-y-1">
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-red-600" /> Protected Financial Operation
                </div>
                <p className="text-[11px] leading-relaxed">
                  This action will soft-delete sale <span className="font-mono font-bold">{deleteTargetSale.invoiceNumber}</span> ({formatCurrency(deleteTargetSale.totalAmount)}) from active sales lists and record an immutable audit log entry.
                </p>
              </div>

              {deleteError && (
                <div className="p-2.5 bg-red-100 text-red-800 rounded font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-600" /> {deleteError}
                </div>
              )}

              {/* Mandatory Reason Input */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Reason for Deletion <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Duplicate test transaction created during register setup"
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded text-xs text-slate-900 bg-white font-medium"
                />
              </div>

              {/* Mandatory Checkbox */}
              <label className="flex items-start gap-2 font-semibold text-slate-800 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={deleteConfirmChecked}
                  onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                  className="mt-0.5 rounded text-red-600"
                />
                <span className="text-[11px] leading-snug">
                  I confirm that I have administrative authority and understand that this action is permanent and audited.
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Button onClick={() => setDeleteTargetSale(null)} variant="outline" className="flex-1 font-bold">
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmDeleteSale}
                  disabled={!deleteReason.trim() || !deleteConfirmChecked}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Delete Sale
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. REFUND / VOID MODAL */}
      {actionTargetSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-900">
                {actionTargetSale.type === 'REFUND' ? 'Refund Sale' : 'Void Sale'} #{actionTargetSale.sale.invoiceNumber}
              </h3>
              <button onClick={() => setActionTargetSale(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="font-mono text-xs text-slate-700">
                Amount: <span className="font-bold text-slate-900">{formatCurrency(actionTargetSale.sale.totalAmount)}</span>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for {actionTargetSale.type}</label>
                <Input
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Customer return / Order cancellation"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => setActionTargetSale(null)} variant="outline" className="flex-1 font-bold">
                  Cancel
                </Button>
                <Button onClick={handleExecuteAction} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold">
                  Confirm {actionTargetSale.type}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. AUDIT TRAIL MODAL */}
      {auditTargetSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Audit Trail: INV-{auditTargetSale.invoiceNumber}</h3>
              </div>
              <button onClick={() => setAuditTargetSale(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 text-xs flex-1">
              {loadingAudit ? (
                <div className="text-center text-slate-400 py-6">Loading audit logs...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center text-slate-500 py-6">No specific audit entries found for this sale.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between items-center font-sans">
                      <span className="font-bold text-emerald-800">{log.action}</span>
                      <span className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-700 font-sans">User: {log.userName}</div>
                    {log.newValues && (
                      <div className="text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 whitespace-pre-wrap">
                        {JSON.stringify(log.newValues, null, 2)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-slate-200 bg-slate-50 text-right">
              <Button onClick={() => setAuditTargetSale(null)} variant="outline" size="sm" className="font-bold">
                Close Audit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptModal sale={selectedPrintSale} onClose={() => setSelectedPrintSale(null)} />
    </div>
  );
}
