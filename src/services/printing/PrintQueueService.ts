import { Database } from 'sql.js';
import { realtimeService } from '../realtime/RealtimeService';

export interface ReceiptRecord {
  id: string;
  receiptNumber: string;
  saleId: string;
  terminalId: string;
  userId: string;
  saleTime: string;
  paymentTime: string;
  receiptCreatedTime: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  createdAt: string;
}

export interface PrintJobRecord {
  id: string;
  printJobNumber: string;
  receiptId: string;
  saleId: string;
  printerId: string;
  terminalId: string;
  userId: string;
  status: 'QUEUED' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'CANCELLED';
  retryCount: number;
  printStartedTime?: string | null;
  printCompletedTime?: string | null;
  printDurationMs: number;
  errorMessage?: string | null;
  isReprint: boolean;
  createdAt: string;
}

export interface ReceiptHistoryItem {
  receiptId: string;
  receiptNumber: string;
  saleId: string;
  saleInvoice: string;
  cashierId: string;
  cashierName: string;
  terminalCode: string;
  saleTime: string;
  printTime: string | null;
  printDurationMs: number;
  printerName: string;
  status: 'QUEUED' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'CANCELLED';
  totalAmount: number;
  isReprint: boolean;
}

export interface PrintPerformanceMetrics {
  avgPrintTimeSec: number;
  fastestPrintSec: number;
  slowestPrintSec: number;
  totalPrinted: number;
  totalFailed: number;
  totalPending: number;
}

export class PrintQueueService {
  /**
   * Generates receipt and queues initial print job inside a sale transaction
   */
  public static createReceiptAndQueuePrint(
    db: Database,
    params: {
      saleId: string;
      invoiceNumber: string;
      subtotal: number;
      discountAmount: number;
      taxAmount: number;
      totalAmount: number;
      paidAmount: number;
      changeAmount: number;
      paymentMethod: string;
      terminalId: string;
      userId: string;
      printerId?: string;
    }
  ): { receiptId: string; receiptNumber: string; printJobId: string } {
    const now = new Date().toISOString();
    const uniqueHash = Math.random().toString(36).substring(2, 8).toUpperCase();
    const receiptId = `rec-${Date.now()}-${uniqueHash}`;
    const saleToken = params.saleId.substring(Math.max(0, params.saleId.length - 6)).toUpperCase();
    const receiptNumber = `REC-${saleToken}-${uniqueHash}`;
    
    const printJobId = `pj-${Date.now()}-${uniqueHash}`;
    const printJobNumber = `PJ-${saleToken}-${uniqueHash}`;
    const targetPrinter = params.printerId || 'Thermal-01';

    // 1. Insert Receipt
    db.run(
      `INSERT INTO receipts (id, receipt_number, sale_id, terminal_id, user_id, sale_time, payment_time, receipt_created_time, subtotal, discount_amount, tax_amount, total_amount, paid_amount, change_amount, payment_method, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        receiptId,
        receiptNumber,
        params.saleId,
        params.terminalId,
        params.userId,
        now,
        now,
        now,
        params.subtotal,
        params.discountAmount,
        params.taxAmount,
        params.totalAmount,
        params.paidAmount,
        params.changeAmount,
        params.paymentMethod,
        now,
      ]
    );

    // 2. Insert Print Job (QUEUED)
    db.run(
      `INSERT INTO print_jobs (id, print_job_number, receipt_id, sale_id, printer_id, terminal_id, user_id, status, retry_count, print_duration_ms, is_reprint, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', 0, 0, 0, ?)`,
      [
        printJobId,
        printJobNumber,
        receiptId,
        params.saleId,
        targetPrinter,
        params.terminalId,
        params.userId,
        now,
      ]
    );

    return { receiptId, receiptNumber, printJobId };
  }

  /**
   * Process a queued print job safely
   */
  public static processPrintJob(db: Database, printJobId: string): { success: boolean; durationMs: number } {
    const startTime = new Date().toISOString();
    const startMs = Date.now();

    // Mark as PRINTING
    db.run(`UPDATE print_jobs SET status = 'PRINTING', print_started_time = ? WHERE id = ?`, [startTime, printJobId]);

    // Simulate reliable hardware execution delay (1.1 - 1.5s)
    const simulatedHardwareDelay = 1200;
    const durationMs = simulatedHardwareDelay;
    const completedTime = new Date(Date.now() + durationMs).toISOString();

    db.run(
      `UPDATE print_jobs SET status = 'PRINTED', print_completed_time = ?, print_duration_ms = ? WHERE id = ?`,
      [completedTime, durationMs, printJobId]
    );

    // Notify realtime channel
    realtimeService.emit('PRINT_JOB_UPDATED', {
      printJobId,
      status: 'PRINTED',
      durationMs,
    });

    return { success: true, durationMs };
  }

  /**
   * Prevent accidental duplicate printing unless explicitly triggered as a reprint
   */
  public static checkCanPrintReceipt(db: Database, receiptId: string): { alreadyPrinted: boolean; lastPrintJobId?: string } {
    const stmt = db.prepare(
      `SELECT id, status FROM print_jobs WHERE receipt_id = :rId AND status = 'PRINTED' ORDER BY created_at DESC LIMIT 1`
    );
    stmt.bind({ ':rId': receiptId });

    let alreadyPrinted = false;
    let lastPrintJobId: string | undefined;

    if (stmt.step()) {
      const obj = stmt.getAsObject();
      alreadyPrinted = true;
      lastPrintJobId = obj.id as string;
    }
    stmt.free();

    return { alreadyPrinted, lastPrintJobId };
  }

  /**
   * Intentional Reprint action
   */
  public static reprintReceipt(
    db: Database,
    receiptId: string,
    printerId: string,
    userId: string,
    terminalId: string
  ): { printJobId: string; durationMs: number } {
    const now = new Date().toISOString();
    const rand = Math.floor(100 + Math.random() * 900);
    const printJobId = `pj-reprint-${Date.now()}-${rand}`;
    const printJobNumber = `PJ-RP-${rand}`;

    // Get saleId from receipt
    const rStmt = db.prepare('SELECT sale_id FROM receipts WHERE id = :id');
    rStmt.bind({ ':id': receiptId });
    let saleId = '';
    if (rStmt.step()) {
      saleId = rStmt.getAsObject().sale_id as string;
    }
    rStmt.free();

    // Insert reprint job
    db.run(
      `INSERT INTO print_jobs (id, print_job_number, receipt_id, sale_id, printer_id, terminal_id, user_id, status, retry_count, print_duration_ms, is_reprint, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', 0, 0, 1, ?)`,
      [printJobId, printJobNumber, receiptId, saleId, printerId, terminalId, userId, now]
    );

    // Add Audit Log
    db.run(
      `INSERT INTO audit_logs (id, business_id, branch_id, terminal_id, user_id, action, entity_type, entity_id, new_values, created_at)
       VALUES (?, 'biz-01', 'br-01', ?, ?, 'RECEIPT_REPRINTED', 'receipt', ?, ?, ?)`,
      [`audit-${Date.now()}`, terminalId, userId, receiptId, JSON.stringify({ printJobNumber }), now]
    );

    // Execute Print
    const result = this.processPrintJob(db, printJobId);
    return { printJobId, durationMs: result.durationMs };
  }

  /**
   * Retry failed print job without touching sales/receipts
   */
  public static retryPrintJob(db: Database, printJobId: string): { success: boolean; durationMs: number } {
    db.run(`UPDATE print_jobs SET retry_count = retry_count + 1 WHERE id = ?`, [printJobId]);
    return this.processPrintJob(db, printJobId);
  }

  /**
   * Get Receipt Print History with Date / Time-Range Filters
   */
  public static getReceiptPrintHistory(
    db: Database,
    filters: {
      range?: 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';
      fromDate?: string;
      toDate?: string;
      status?: string;
      searchQuery?: string;
    }
  ): ReceiptHistoryItem[] {
    let sql = `
      SELECT 
        r.id as receipt_id,
        r.receipt_number,
        r.sale_id,
        s.invoice_number as sale_invoice,
        r.user_id as cashier_id,
        COALESCE(u.full_name, r.user_id) as cashier_name,
        r.terminal_id as terminal_code,
        r.sale_time,
        pj.print_completed_time as print_time,
        COALESCE(pj.print_duration_ms, 0) as print_duration_ms,
        COALESCE(pj.printer_id, 'Thermal-01') as printer_name,
        COALESCE(pj.status, 'QUEUED') as status,
        r.total_amount,
        COALESCE(pj.is_reprint, 0) as is_reprint
      FROM receipts r
      JOIN sales s ON r.sale_id = s.id
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN print_jobs pj ON pj.receipt_id = r.id
      WHERE 1=1
    `;

    const params: any[] = [];
    const now = new Date();

    if (filters.range === 'TODAY') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      sql += ` AND r.created_at >= ?`;
      params.push(startOfDay);
    } else if (filters.range === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      sql += ` AND r.created_at >= ? AND r.created_at < ?`;
      params.push(start, end);
    } else if (filters.range === 'THIS_WEEK') {
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();
      sql += ` AND r.created_at >= ?`;
      params.push(firstDay);
    } else if (filters.range === 'THIS_MONTH') {
      const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      sql += ` AND r.created_at >= ?`;
      params.push(firstDayMonth);
    } else if (filters.range === 'CUSTOM' && (filters.fromDate || filters.toDate)) {
      if (filters.fromDate) {
        sql += ` AND r.created_at >= ?`;
        params.push(filters.fromDate);
      }
      if (filters.toDate) {
        sql += ` AND r.created_at <= ?`;
        params.push(filters.toDate);
      }
    }

    if (filters.status && filters.status !== 'ALL') {
      sql += ` AND pj.status = ?`;
      params.push(filters.status);
    }

    if (filters.searchQuery) {
      const q = `%${filters.searchQuery}%`;
      sql += ` AND (r.receipt_number LIKE ? OR s.invoice_number LIKE ? OR u.full_name LIKE ?)`;
      params.push(q, q, q);
    }

    sql += ` ORDER BY r.created_at DESC LIMIT 100`;

    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }

    const items: ReceiptHistoryItem[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      items.push({
        receiptId: row.receipt_id as string,
        receiptNumber: row.receipt_number as string,
        saleId: row.sale_id as string,
        saleInvoice: row.sale_invoice as string,
        cashierId: row.cashier_id as string,
        cashierName: row.cashier_name as string,
        terminalCode: row.terminal_code as string,
        saleTime: row.sale_time as string,
        printTime: row.print_time ? (row.print_time as string) : null,
        printDurationMs: (row.print_duration_ms as number) || 0,
        printerName: row.printer_name as string,
        status: (row.status as any) || 'QUEUED',
        totalAmount: (row.total_amount as number) || 0,
        isReprint: Boolean(row.is_reprint),
      });
    }
    stmt.free();

    return items;
  }

  /**
   * Get overall print performance metrics
   */
  public static getPrintPerformanceMetrics(db: Database): PrintPerformanceMetrics {
    const stmt = db.prepare(`
      SELECT 
        AVG(print_duration_ms) as avg_ms,
        MIN(CASE WHEN print_duration_ms > 0 THEN print_duration_ms ELSE NULL END) as min_ms,
        MAX(print_duration_ms) as max_ms,
        SUM(CASE WHEN status = 'PRINTED' THEN 1 ELSE 0 END) as printed_cnt,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_cnt,
        SUM(CASE WHEN status = 'QUEUED' OR status = 'PRINTING' THEN 1 ELSE 0 END) as pending_cnt
      FROM print_jobs
    `);

    let avgPrintTimeSec = 1.2;
    let fastestPrintSec = 0.9;
    let slowestPrintSec = 1.8;
    let totalPrinted = 0;
    let totalFailed = 0;
    let totalPending = 0;

    if (stmt.step()) {
      const res = stmt.getAsObject();
      if (res.avg_ms) avgPrintTimeSec = Number(((res.avg_ms as number) / 1000).toFixed(2));
      if (res.min_ms) fastestPrintSec = Number(((res.min_ms as number) / 1000).toFixed(2));
      if (res.max_ms) slowestPrintSec = Number(((res.max_ms as number) / 1000).toFixed(2));
      totalPrinted = (res.printed_cnt as number) || 0;
      totalFailed = (res.failed_cnt as number) || 0;
      totalPending = (res.pending_cnt as number) || 0;
    }
    stmt.free();

    return {
      avgPrintTimeSec,
      fastestPrintSec,
      slowestPrintSec,
      totalPrinted,
      totalFailed,
      totalPending,
    };
  }
}
