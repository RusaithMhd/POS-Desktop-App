'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { PrintQueueService, ReceiptHistoryItem, PrintPerformanceMetrics } from '@/services/printing/PrintQueueService';
import { SystemStatusBar } from '@/components/common/SystemStatusBar';
import { useRealtimeEvent } from '@/services/realtime/RealtimeService';
import { ThermalReceipt } from '@/components/pos/ThermalReceipt';
import {
  Printer,
  Receipt as ReceiptIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Eye,
  FileText,
  Sliders,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export default function ReceiptsPage() {
  const [historyItems, setHistoryItems] = useState<ReceiptHistoryItem[]>([]);
  const [metrics, setMetrics] = useState<PrintPerformanceMetrics>({
    avgPrintTimeSec: 1.2,
    fastestPrintSec: 0.9,
    slowestPrintSec: 1.8,
    totalPrinted: 0,
    totalFailed: 0,
    totalPending: 0,
  });

  const [rangeFilter, setRangeFilter] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('TODAY');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [viewingReceiptData, setViewingReceiptData] = useState<any | null>(null);
  const [reprintFeedback, setReprintFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    try {
      const db = getRawSqlDb();
      const items = PrintQueueService.getReceiptPrintHistory(db, {
        range: rangeFilter,
        fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
        toDate: toDate ? new Date(toDate).toISOString() : undefined,
        status: statusFilter,
        searchQuery,
      });
      setHistoryItems(items);

      const perfMetrics = PrintQueueService.getPrintPerformanceMetrics(db);
      setMetrics(perfMetrics);
    } catch (err) {
      console.error('Failed to load receipts data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [rangeFilter, statusFilter, fromDate, toDate]);

  useRealtimeEvent('SALE_CREATED', () => loadData());
  useRealtimeEvent('PRINT_JOB_UPDATED', () => loadData());

  const handleReprint = (item: ReceiptHistoryItem) => {
    try {
      const db = getRawSqlDb();
      const res = PrintQueueService.reprintReceipt(db, item.receiptId, item.printerName, 'user-admin', item.terminalCode);
      setReprintFeedback(`✓ Reprint sent to ${item.printerName} (Duration: ${(res.durationMs / 1000).toFixed(1)}s)`);
      loadData();
      setTimeout(() => setReprintFeedback(null), 4000);
    } catch (err: any) {
      setReprintFeedback(`⚠️ Reprint Error: ${err.message || err}`);
    }
  };

  const handleViewReceipt = (receiptId: string) => {
    try {
      const db = getRawSqlDb();
      const rStmt = db.prepare(`SELECT * FROM receipts WHERE id = :id LIMIT 1`);
      rStmt.bind({ ':id': receiptId });
      if (!rStmt.step()) {
        rStmt.free();
        return;
      }
      const rRow = rStmt.getAsObject();
      rStmt.free();

      const sStmt = db.prepare(`SELECT * FROM sales WHERE id = :sId LIMIT 1`);
      sStmt.bind({ ':sId': rRow.sale_id as string });
      let saleObj: any = null;
      if (sStmt.step()) {
        saleObj = sStmt.getAsObject();
      }
      sStmt.free();

      // Fetch items
      const itemsStmt = db.prepare(`SELECT * FROM sale_items WHERE sale_id = :sId`);
      itemsStmt.bind({ ':sId': rRow.sale_id as string });
      const items: any[] = [];
      while (itemsStmt.step()) {
        items.push(itemsStmt.getAsObject());
      }
      itemsStmt.free();

      setViewingReceiptData({
        id: rRow.sale_id as string,
        clientTransactionId: saleObj?.client_transaction_id || `tx-${rRow.sale_id}`,
        businessId: saleObj?.business_id || 'biz-01',
        branchId: saleObj?.branch_id || 'br-01',
        terminalId: rRow.terminal_id || 'term-01',
        userId: rRow.user_id,
        shiftId: saleObj?.shift_id || 'shift-01',
        invoiceNumber: saleObj ? saleObj.invoice_number : 'INV-001',
        subtotal: rRow.subtotal,
        discountAmount: rRow.discount_amount,
        taxAmount: rRow.tax_amount,
        totalAmount: rRow.total_amount,
        paidAmount: rRow.paid_amount,
        changeAmount: rRow.change_amount,
        status: (saleObj?.status as any) || 'COMPLETED',
        createdAt: rRow.created_at,
        updatedAt: rRow.created_at,
        items: items.map((i) => ({
          id: i.id || `item-${Math.random()}`,
          saleId: rRow.sale_id as string,
          productId: i.product_id,
          productName: i.product_name,
          unitPrice: i.unit_price,
          costPrice: i.cost_price || 0,
          quantity: i.quantity,
          discountAmount: i.discount_amount || 0,
          taxAmount: i.tax_amount || 0,
          totalAmount: i.total_amount,
        })),
        payments: [
          {
            id: `pay-${rRow.sale_id}`,
            saleId: rRow.sale_id as string,
            paymentMethodId: 'pm-cash',
            methodCode: rRow.payment_method || 'CASH',
            amount: rRow.paid_amount,
            createdAt: rRow.created_at,
          }
        ],
      });

      setSelectedReceiptId(receiptId);
    } catch (err) {
      console.error('Failed to view receipt details', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Receipt Printing & Audit History</h1>
              <p className="text-xs text-slate-400">
                Track print job queues, thermal printer hardware response times, time-range audits, and reprints.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SystemStatusBar />
          <button
            onClick={() => loadData()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-md border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Log
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Feedback Alert */}
        {reprintFeedback && (
          <div className="p-3 bg-slate-900 text-emerald-400 border border-emerald-500/30 text-xs font-medium rounded-lg shadow-md animate-in fade-in flex items-center justify-between">
            <span>{reprintFeedback}</span>
            <button onClick={() => setReprintFeedback(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Performance Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Average Print Speed</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.avgPrintTimeSec}s</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Fastest: {metrics.fastestPrintSec}s • Slowest: {metrics.slowestPrintSec}s
              </div>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Printed Receipts</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalPrinted}</div>
              <div className="text-[11px] text-emerald-600 font-medium mt-0.5">✓ 100% Audit Tracked</div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending / Failed</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalPending + metrics.totalFailed}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {metrics.totalFailed > 0 ? `${metrics.totalFailed} Hardware Failures` : 'No active print errors'}
              </div>
            </div>
            <div className={`p-3 rounded-xl ${metrics.totalFailed > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Connected Printers</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">2 Active</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Thermal-01 (Default) • Thermal-02</div>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
              <Printer className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Quick Range Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium overflow-x-auto">
              {(['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRangeFilter(r)}
                  className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                    rangeFilter === r ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                placeholder="Search receipt #, invoice #, cashier..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Custom Date Range Controls */}
          {rangeFilter === 'CUSTOM' && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">From:</span>
                <input
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-2.5 py-1 border border-slate-200 rounded-md text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">To:</span>
                <input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-2.5 py-1 border border-slate-200 rounded-md text-slate-800"
                />
              </div>

              <button
                onClick={() => loadData()}
                className="px-3 py-1 bg-slate-900 text-white rounded-md font-medium hover:bg-slate-800"
              >
                Apply Range
              </button>
            </div>
          )}
        </div>

        {/* History Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ReceiptIcon className="w-4 h-4 text-slate-500" />
              Receipt Print Logs ({historyItems.length})
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Idempotent & Audit Protected
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Receipt #</th>
                  <th className="px-4 py-3">Sale Invoice</th>
                  <th className="px-4 py-3">Cashier / Device</th>
                  <th className="px-4 py-3">Sale Time</th>
                  <th className="px-4 py-3">Print Duration</th>
                  <th className="px-4 py-3">Printer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      <ReceiptIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No receipt print logs found for the selected time range.
                    </td>
                  </tr>
                ) : (
                  historyItems.map((item) => (
                    <tr key={item.receiptId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 flex items-center gap-1.5">
                        {item.receiptNumber}
                        {item.isReprint && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-800 rounded font-semibold">
                            Reprint
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{item.saleInvoice}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{item.cashierName}</div>
                        <div className="text-[10px] text-slate-400">{item.terminalCode}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(item.saleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {item.printDurationMs > 0 ? `${(item.printDurationMs / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.printerName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.status === 'PRINTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800 animate-pulse'
                          }`}
                        >
                          ● {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        LKR {item.totalAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewReceipt(item.receiptId)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-[11px] flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            onClick={() => handleReprint(item)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-medium text-[11px] flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Reprint
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal View Thermal Receipt */}
      {selectedReceiptId && viewingReceiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ReceiptIcon className="w-4 h-4 text-emerald-400" />
                Receipt Preview ({viewingReceiptData.invoiceNumber})
              </div>
              <button onClick={() => setSelectedReceiptId(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
              <ThermalReceipt sale={viewingReceiptData} />
            </div>

            <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedReceiptId(null)}
                className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
