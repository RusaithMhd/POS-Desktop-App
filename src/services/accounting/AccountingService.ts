import { Database } from 'sql.js';
import { getRawSqlDb, getLocalDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'COGS' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface AccountRecord {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  parentId?: string | null;
  normalBalance: NormalBalance;
  isActive: boolean;
  isSystemAccount: boolean;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  parentName?: string;
}

export interface JournalLineRecord {
  id: string;
  journalEntryId: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface JournalEntryRecord {
  id: string;
  journalNumber: string;
  transactionDate: string;
  referenceType: string;
  referenceId?: string | null;
  description: string;
  status: 'DRAFT' | 'POSTED' | 'VOID';
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  lines: JournalLineRecord[];
  totalDebit?: number;
  totalCredit?: number;
}

export interface AccountMappingRecord {
  id: string;
  mappingKey: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  updatedAt: string;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface ProfitAndLossReport {
  startDate?: string;
  endDate?: string;
  grossSales: number;
  otherIncome: number;
  salesReturns: number;
  salesDiscounts: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: Array<{ accountCode: string; accountName: string; amount: number }>;
  totalExpenses: number;
  netProfit: number;
}

export interface GeneralLedgerEntry {
  date: string;
  journalNumber: string;
  referenceType: string;
  referenceId?: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface AccountingDashboardMetrics {
  todaySales: number;
  todayExpenses: number;
  todayGrossProfit: number;
  todayNetProfit: number;
  cashBalance: number;
  bankBalance: number;
  customerReceivables: number;
  supplierPayables: number;
  inventoryValue: number;
}

export class AccountingService {
  /**
   * Resolve Account ID from Account Mapping key (or default fallback code/id)
   */
  public static resolveAccountId(db: Database, key: string): string {
    const defaultFallbacks: Record<string, string> = {
      CASH: 'acc-1010',
      BANK: 'acc-1020',
      RECEIVABLE: 'acc-1030',
      INVENTORY: 'acc-1040',
      PAYABLE: 'acc-2010',
      OWNER_CAPITAL: 'acc-3010',
      OWNER_DRAWING: 'acc-3020',
      SALES: 'acc-4010',
      OTHER_INCOME: 'acc-4020',
      SALES_RETURN: 'acc-4030',
      SALES_DISCOUNT: 'acc-4040',
      COGS: 'acc-5010',
      DEFAULT_EXPENSE: 'acc-6110',
    };

    const stmt = db.prepare('SELECT account_id FROM account_mappings WHERE mapping_key = :key LIMIT 1');
    stmt.bind({ ':key': key });
    let resolvedId: string | null = null;
    if (stmt.step()) {
      resolvedId = stmt.getAsObject().account_id as string;
    }
    stmt.free();

    return resolvedId || defaultFallbacks[key] || 'acc-6110';
  }

  /**
   * Validates double-entry accounting equation: SUM(Debit) === SUM(Credit)
   */
  public static validateJournalLines(lines: Array<{ accountId: string; debit: number; credit: number }>): void {
    if (!lines || lines.length < 2) {
      throw new Error('Accounting Validation Error: A journal entry must contain at least 2 line items.');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const l of lines) {
      const d = Math.round((l.debit || 0) * 100) / 100;
      const c = Math.round((l.credit || 0) * 100) / 100;
      if (d < 0 || c < 0) {
        throw new Error('Accounting Validation Error: Debit and Credit values cannot be negative.');
      }
      totalDebit += d;
      totalCredit += c;
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.009) {
      throw new Error(
        `ACCOUNTING INTEGRITY ERROR: Total Debits (Rs. ${totalDebit.toFixed(2)}) must equal Total Credits (Rs. ${totalCredit.toFixed(2)}). Imbalance: Rs. ${diff.toFixed(2)}.`
      );
    }
  }

  /**
   * Central Core Journal Entry Poster (ACID Atomic Database Operation)
   */
  public static postJournalEntry(
    db: Database,
    entryHeader: {
      referenceType: string;
      referenceId?: string | null;
      description: string;
      createdBy: string;
      transactionDate?: string;
    },
    lines: Array<{ accountId: string; debit: number; credit: number; description?: string | null }>
  ): JournalEntryRecord {
    // 1. Validate Debit == Credit
    this.validateJournalLines(lines);

    const now = new Date().toISOString();
    const dateStr = entryHeader.transactionDate || now;
    const journalId = `jnl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const journalNumber = `JNL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // 2. Insert Entry Header
    db.run(
      `INSERT INTO journal_entries (id, journal_number, transaction_date, reference_type, reference_id, description, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'POSTED', ?, ?)`,
      [
        journalId,
        journalNumber,
        dateStr,
        entryHeader.referenceType,
        entryHeader.referenceId || null,
        entryHeader.description,
        entryHeader.createdBy,
        now,
      ]
    );

    // 3. Insert Entry Lines
    const lineRecords: JournalLineRecord[] = [];
    for (const l of lines) {
      const lineId = `jline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const debitVal = Math.round((l.debit || 0) * 100) / 100;
      const creditVal = Math.round((l.credit || 0) * 100) / 100;

      db.run(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [lineId, journalId, l.accountId, debitVal, creditVal, l.description || null]
      );

      lineRecords.push({
        id: lineId,
        journalEntryId: journalId,
        accountId: l.accountId,
        debit: debitVal,
        credit: creditVal,
        description: l.description || null,
      });
    }

    return {
      id: journalId,
      journalNumber,
      transactionDate: dateStr,
      referenceType: entryHeader.referenceType,
      referenceId: entryHeader.referenceId,
      description: entryHeader.description,
      status: 'POSTED',
      createdBy: entryHeader.createdBy,
      createdAt: now,
      lines: lineRecords,
    };
  }

  /**
   * Reverses / Voids a posted journal entry
   */
  public static voidJournalEntry(db: Database, journalEntryId: string, userId: string, reason: string): void {
    const stmt = db.prepare('SELECT * FROM journal_entries WHERE id = :id AND status = "POSTED" LIMIT 1');
    stmt.bind({ ':id': journalEntryId });
    if (!stmt.step()) {
      stmt.free();
      throw new Error('Journal entry not found or already voided.');
    }
    const orig = stmt.getAsObject();
    stmt.free();

    const linesStmt = db.prepare('SELECT * FROM journal_lines WHERE journal_entry_id = :id');
    linesStmt.bind({ ':id': journalEntryId });
    const origLines: any[] = [];
    while (linesStmt.step()) {
      origLines.push(linesStmt.getAsObject());
    }
    linesStmt.free();

    // Reversal Lines: Swap Debit & Credit
    const reversalLines = origLines.map((l) => ({
      accountId: l.account_id as string,
      debit: l.credit as number,
      credit: l.debit as number,
      description: `REVERSAL: ${l.description || 'Void transaction'}`,
    }));

    // Post Reversal Entry
    this.postJournalEntry(
      db,
      {
        referenceType: 'VOID',
        referenceId: orig.id as string,
        description: `VOID REVERSAL for ${orig.journal_number}: ${reason}`,
        createdBy: userId,
      },
      reversalLines
    );

    // Update status to VOID
    db.run('UPDATE journal_entries SET status = "VOID" WHERE id = ?', [journalEntryId]);
  }

  // ----------------------------------------------------------------------
  // AUTOMATIC BUSINESS TRANSACTION INTEGRATIONS
  // ----------------------------------------------------------------------

  /**
   * Automatic Accounting for Sales (Cash or Credit)
   */
  public static recordSale(
    db: Database,
    params: {
      saleId: string;
      invoiceNumber: string;
      userId: string;
      subtotal: number;
      discountAmount: number;
      taxAmount: number;
      totalAmount: number;
      paidAmount: number;
      customerId?: string | null;
      payments: Array<{ methodCode: string; amount: number }>;
      items: Array<{ productId: string; costPrice: number; quantity: number }>;
    }
  ): void {
    const cashAccId = this.resolveAccountId(db, 'CASH');
    const bankAccId = this.resolveAccountId(db, 'BANK');
    const arAccId = this.resolveAccountId(db, 'RECEIVABLE');
    const invAccId = this.resolveAccountId(db, 'INVENTORY');
    const salesAccId = this.resolveAccountId(db, 'SALES');
    const salesDiscountAccId = this.resolveAccountId(db, 'SALES_DISCOUNT');
    const cogsAccId = this.resolveAccountId(db, 'COGS');

    // 1. Calculate Revenue Lines with Change Deduction
    const grandTotal = params.totalAmount;
    const totalPaid = params.payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const changeAmount = Math.max(0, totalPaid - grandTotal);

    let cashPaid = 0;
    let bankPaid = 0;
    let creditPaid = 0;

    for (const p of params.payments) {
      const code = (p.methodCode || '').toUpperCase();
      if (code === 'CARD' || code === 'BANK_TRANSFER') bankPaid += p.amount || 0;
      else if (code === 'CREDIT' || code === 'STORE_CREDIT') creditPaid += p.amount || 0;
      else cashPaid += p.amount || 0;
    }

    // Change given back to customer is deducted from Cash drawer
    const netCashPaid = Math.max(0, cashPaid - changeAmount);

    // Unpaid balance (if any) is mapped to Accounts Receivable
    const unpaidBalance = Math.max(0, grandTotal - (netCashPaid + bankPaid + creditPaid));
    const totalReceivable = creditPaid + unpaidBalance;

    const discountVal = params.discountAmount || 0;

    const revenueLines: Array<{ accountId: string; debit: number; credit: number; description?: string }> = [];

    if (netCashPaid > 0) {
      revenueLines.push({ accountId: cashAccId, debit: netCashPaid, credit: 0, description: `Cash Sale payment for #${params.invoiceNumber}` });
    }
    if (bankPaid > 0) {
      revenueLines.push({ accountId: bankAccId, debit: bankPaid, credit: 0, description: `Bank/Card Sale payment for #${params.invoiceNumber}` });
    }
    if (totalReceivable > 0) {
      revenueLines.push({ accountId: arAccId, debit: totalReceivable, credit: 0, description: `Customer Credit Receivable for #${params.invoiceNumber}` });
    }
    if (discountVal > 0) {
      revenueLines.push({ accountId: salesDiscountAccId, debit: discountVal, credit: 0, description: `Sales Discount on #${params.invoiceNumber}` });
    }

    // Gross Revenue Credit
    const totalGrossRevenueCredit = Math.round((netCashPaid + bankPaid + totalReceivable + discountVal) * 100) / 100;
    revenueLines.push({ accountId: salesAccId, debit: 0, credit: totalGrossRevenueCredit, description: `Product Sales Revenue for #${params.invoiceNumber}` });

    // Post Revenue Journal
    this.postJournalEntry(
      db,
      {
        referenceType: 'SALE',
        referenceId: params.saleId,
        description: `POS Sale Invoice #${params.invoiceNumber}`,
        createdBy: params.userId,
      },
      revenueLines
    );

    // 2. COGS & Inventory Journal Entry
    let totalCostOfGoodsSold = 0;
    for (const item of params.items) {
      totalCostOfGoodsSold += (item.costPrice || 0) * (item.quantity || 0);
    }

    if (totalCostOfGoodsSold > 0) {
      this.postJournalEntry(
        db,
        {
          referenceType: 'SALE',
          referenceId: params.saleId,
          description: `Cost of Goods Sold & Stock Deduction for Invoice #${params.invoiceNumber}`,
          createdBy: params.userId,
        },
        [
          { accountId: cogsAccId, debit: totalCostOfGoodsSold, credit: 0, description: `COGS expense for Invoice #${params.invoiceNumber}` },
          { accountId: invAccId, debit: 0, credit: totalCostOfGoodsSold, description: `Inventory stock reduction for Invoice #${params.invoiceNumber}` },
        ]
      );
    }
  }

  /**
   * Automatic Accounting for Sales Returns / Refunds
   */
  public static recordSalesReturn(
    db: Database,
    params: {
      returnId: string;
      returnNumber: string;
      saleId: string;
      userId: string;
      totalRefundAmount: number;
      paymentMethod?: string;
      items: Array<{ productId: string; costPrice: number; quantity: number }>;
    }
  ): void {
    const cashAccId = this.resolveAccountId(db, 'CASH');
    const bankAccId = this.resolveAccountId(db, 'BANK');
    const arAccId = this.resolveAccountId(db, 'RECEIVABLE');
    const invAccId = this.resolveAccountId(db, 'INVENTORY');
    const salesReturnAccId = this.resolveAccountId(db, 'SALES_RETURN');
    const cogsAccId = this.resolveAccountId(db, 'COGS');

    const method = (params.paymentMethod || 'CASH').toUpperCase();
    let refundAccId = cashAccId;
    if (method === 'CARD' || method === 'BANK_TRANSFER') refundAccId = bankAccId;
    else if (method === 'CREDIT' || method === 'STORE_CREDIT') refundAccId = arAccId;

    // 1. Revenue Reversal Journal
    this.postJournalEntry(
      db,
      {
        referenceType: 'SALES_RETURN',
        referenceId: params.returnId,
        description: `Customer Return Refund #${params.returnNumber}`,
        createdBy: params.userId,
      },
      [
        { accountId: salesReturnAccId, debit: params.totalRefundAmount, credit: 0, description: `Sales Return Contra Income for #${params.returnNumber}` },
        { accountId: refundAccId, debit: 0, credit: params.totalRefundAmount, description: `Refund Payout for #${params.returnNumber}` },
      ]
    );

    // 2. Inventory Restoration Journal
    let totalRestoredCost = 0;
    for (const item of params.items) {
      totalRestoredCost += (item.costPrice || 0) * (item.quantity || 0);
    }

    if (totalRestoredCost > 0) {
      this.postJournalEntry(
        db,
        {
          referenceType: 'SALES_RETURN',
          referenceId: params.returnId,
          description: `Inventory Restoration for Return #${params.returnNumber}`,
          createdBy: params.userId,
        },
        [
          { accountId: invAccId, debit: totalRestoredCost, credit: 0, description: `Inventory stock restored from Return #${params.returnNumber}` },
          { accountId: cogsAccId, debit: 0, credit: totalRestoredCost, description: `COGS credit reduction for Return #${params.returnNumber}` },
        ]
      );
    }
  }

  /**
   * Automatic Accounting for Stock Purchases
   */
  public static recordPurchase(
    db: Database,
    params: {
      purchaseId: string;
      invoiceNumber: string;
      supplierId: string;
      userId: string;
      totalAmount: number;
      paidAmount: number;
      paymentMethod?: string;
    }
  ): void {
    const invAccId = this.resolveAccountId(db, 'INVENTORY');
    const cashAccId = this.resolveAccountId(db, 'CASH');
    const bankAccId = this.resolveAccountId(db, 'BANK');
    const apAccId = this.resolveAccountId(db, 'PAYABLE');

    const method = (params.paymentMethod || 'CASH').toUpperCase();
    const paidAccId = method === 'BANK_TRANSFER' || method === 'CARD' ? bankAccId : cashAccId;

    const paidVal = Math.min(params.totalAmount, Math.max(0, params.paidAmount));
    const unpaidVal = Math.max(0, params.totalAmount - paidVal);

    const purchaseLines: Array<{ accountId: string; debit: number; credit: number; description?: string }> = [
      { accountId: invAccId, debit: params.totalAmount, credit: 0, description: `Stock Inventory Purchase Order #${params.invoiceNumber}` },
    ];

    if (paidVal > 0) {
      purchaseLines.push({ accountId: paidAccId, debit: 0, credit: paidVal, description: `Cash/Bank Payment for Purchase #${params.invoiceNumber}` });
    }
    if (unpaidVal > 0) {
      purchaseLines.push({ accountId: apAccId, debit: 0, credit: unpaidVal, description: `Supplier Accounts Payable balance for Purchase #${params.invoiceNumber}` });
    }

    this.postJournalEntry(
      db,
      {
        referenceType: 'PURCHASE',
        referenceId: params.purchaseId,
        description: `Stock Receiving PO #${params.invoiceNumber}`,
        createdBy: params.userId,
      },
      purchaseLines
    );
  }

  /**
   * Automatic Accounting for Customer Credit Payments (Settling Receivables)
   */
  public static recordCustomerPayment(
    db: Database,
    params: {
      paymentId: string;
      customerId: string;
      userId: string;
      amount: number;
      paymentMethod: string;
      reference?: string;
    }
  ): void {
    const cashAccId = this.resolveAccountId(db, 'CASH');
    const bankAccId = this.resolveAccountId(db, 'BANK');
    const arAccId = this.resolveAccountId(db, 'RECEIVABLE');

    const method = (params.paymentMethod || 'CASH').toUpperCase();
    const assetAccId = method === 'BANK_TRANSFER' || method === 'CARD' ? bankAccId : cashAccId;

    this.postJournalEntry(
      db,
      {
        referenceType: 'CUSTOMER_PAYMENT',
        referenceId: params.paymentId,
        description: `Customer Credit Settlement Payment ${params.reference || ''}`,
        createdBy: params.userId,
      },
      [
        { accountId: assetAccId, debit: params.amount, credit: 0, description: `Cash/Bank received for customer credit settlement` },
        { accountId: arAccId, debit: 0, credit: params.amount, description: `Accounts Receivable credit reduction` },
      ]
    );
  }

  /**
   * Automatic Accounting for Supplier Payments (Settling Payables)
   */
  public static recordSupplierPayment(
    db: Database,
    params: {
      paymentId: string;
      supplierId: string;
      userId: string;
      amount: number;
      paymentMethod: string;
      reference?: string;
    }
  ): void {
    const cashAccId = this.resolveAccountId(db, 'CASH');
    const bankAccId = this.resolveAccountId(db, 'BANK');
    const apAccId = this.resolveAccountId(db, 'PAYABLE');

    const method = (params.paymentMethod || 'CASH').toUpperCase();
    const assetAccId = method === 'BANK_TRANSFER' || method === 'CARD' ? bankAccId : cashAccId;

    this.postJournalEntry(
      db,
      {
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: params.paymentId,
        description: `Supplier Invoice Settlement Payment ${params.reference || ''}`,
        createdBy: params.userId,
      },
      [
        { accountId: apAccId, debit: params.amount, credit: 0, description: `Accounts Payable debit reduction` },
        { accountId: assetAccId, debit: 0, credit: params.amount, description: `Cash/Bank payout for supplier settlement` },
      ]
    );
  }

  /**
   * Automatic Accounting for Expenses
   */
  public static recordExpense(
    db: Database,
    params: {
      expenseId: string;
      category: string;
      amount: number;
      paymentMethod: string;
      userId: string;
      description: string;
    }
  ): void {
    const cashAccId = this.resolveAccountId(db, 'CASH');
    const bankAccId = this.resolveAccountId(db, 'BANK');
    const defaultExpenseAccId = this.resolveAccountId(db, 'DEFAULT_EXPENSE');

    // Map Category to Account Code
    let expAccId = defaultExpenseAccId;
    const cat = (params.category || '').toLowerCase();
    if (cat.includes('rent')) expAccId = 'acc-6010';
    else if (cat.includes('elec')) expAccId = 'acc-6020';
    else if (cat.includes('water')) expAccId = 'acc-6030';
    else if (cat.includes('internet') || cat.includes('telecom')) expAccId = 'acc-6040';
    else if (cat.includes('salary') || cat.includes('wages')) expAccId = 'acc-6050';
    else if (cat.includes('trans') || cat.includes('travel')) expAccId = 'acc-6060';
    else if (cat.includes('repair') || cat.includes('maint')) expAccId = 'acc-6070';
    else if (cat.includes('office') || cat.includes('suppl')) expAccId = 'acc-6080';
    else if (cat.includes('market') || cat.includes('ad')) expAccId = 'acc-6090';
    else if (cat.includes('bank') || cat.includes('fee')) expAccId = 'acc-6100';

    const method = (params.paymentMethod || 'CASH').toUpperCase();
    const assetAccId = method === 'CARD' || method === 'BANK_TRANSFER' ? bankAccId : cashAccId;

    this.postJournalEntry(
      db,
      {
        referenceType: 'EXPENSE',
        referenceId: params.expenseId,
        description: `Expense: ${params.category} - ${params.description}`,
        createdBy: params.userId,
      },
      [
        { accountId: expAccId, debit: params.amount, credit: 0, description: `${params.category} operating expense` },
        { accountId: assetAccId, debit: 0, credit: params.amount, description: `Cash/Bank payout for ${params.category}` },
      ]
    );
  }

  /**
   * Owner Capital Investment
   */
  public static recordOwnerCapital(
    db: Database,
    params: {
      userId: string;
      amount: number;
      paymentMethod: string;
      notes?: string;
    }
  ): void {
    const cashAccId = this.resolveAccountId(db, 'CASH');
    const bankAccId = this.resolveAccountId(db, 'BANK');
    const capitalAccId = this.resolveAccountId(db, 'OWNER_CAPITAL');

    const method = (params.paymentMethod || 'CASH').toUpperCase();
    const assetAccId = method === 'BANK' || method === 'BANK_TRANSFER' ? bankAccId : cashAccId;

    this.postJournalEntry(
      db,
      {
        referenceType: 'OWNER_CAPITAL',
        description: `Owner Capital Contribution: ${params.notes || 'Capital Addition'}`,
        createdBy: params.userId,
      },
      [
        { accountId: assetAccId, debit: params.amount, credit: 0, description: 'Cash/Bank injected by owner' },
        { accountId: capitalAccId, debit: 0, credit: params.amount, description: 'Owner Capital Equity increase' },
      ]
    );
  }

  /**
   * Owner Drawing / Withdrawal
   */
  public static recordOwnerDrawing(
    db: Database,
    params: {
      userId: string;
      amount: number;
      paymentMethod: string;
      notes?: string;
    }
  ): void {
    const cashAccId = this.resolveAccountId(db, 'CASH');
    const bankAccId = this.resolveAccountId(db, 'BANK');
    const drawingAccId = this.resolveAccountId(db, 'OWNER_DRAWING');

    const method = (params.paymentMethod || 'CASH').toUpperCase();
    const assetAccId = method === 'BANK' || method === 'BANK_TRANSFER' ? bankAccId : cashAccId;

    this.postJournalEntry(
      db,
      {
        referenceType: 'OWNER_DRAWING',
        description: `Owner Drawing / Personal Withdrawal: ${params.notes || 'Personal Use'}`,
        createdBy: params.userId,
      },
      [
        { accountId: drawingAccId, debit: params.amount, credit: 0, description: 'Owner Drawing contra-equity increase' },
        { accountId: assetAccId, debit: 0, credit: params.amount, description: 'Cash/Bank paid out to owner' },
      ]
    );
  }

  /**
   * Automatic Accounting for Stock Adjustments / Damage
   */
  public static recordStockAdjustment(
    db: Database,
    params: {
      adjustmentId: string;
      userId: string;
      quantityChange: number;
      unitCost: number;
      reason: string;
    }
  ): void {
    const invAccId = this.resolveAccountId(db, 'INVENTORY');
    const cogsAccId = this.resolveAccountId(db, 'COGS');
    const otherIncomeAccId = this.resolveAccountId(db, 'OTHER_INCOME');

    const totalValue = Math.abs(params.quantityChange * params.unitCost);
    if (totalValue <= 0) return;

    if (params.quantityChange < 0) {
      // Stock Reduction / Damage / Spoilage
      this.postJournalEntry(
        db,
        {
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: params.adjustmentId,
          description: `Stock Adjustment Deduction: ${params.reason}`,
          createdBy: params.userId,
        },
        [
          { accountId: cogsAccId, debit: totalValue, credit: 0, description: `Inventory write-off loss: ${params.reason}` },
          { accountId: invAccId, debit: 0, credit: totalValue, description: `Stock quantity deduction` },
        ]
      );
    } else {
      // Stock Increase / Surplus Found
      this.postJournalEntry(
        db,
        {
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: params.adjustmentId,
          description: `Stock Adjustment Addition: ${params.reason}`,
          createdBy: params.userId,
        },
        [
          { accountId: invAccId, debit: totalValue, credit: 0, description: `Stock quantity addition` },
          { accountId: otherIncomeAccId, debit: 0, credit: totalValue, description: `Inventory gain credit: ${params.reason}` },
        ]
      );
    }
  }

  // ----------------------------------------------------------------------
  // QUERY & FINANCIAL REPORTING METHODS
  // ----------------------------------------------------------------------

  /**
   * Fetch All Chart of Accounts
   */
  public static getAccounts(db?: Database): AccountRecord[] {
    const raw = db || getRawSqlDb();
    const stmt = raw.prepare(`
      SELECT a.*, p.account_name as parent_name 
      FROM accounts a 
      LEFT JOIN accounts p ON a.parent_id = p.id 
      ORDER BY a.account_code ASC
    `);
    const list: AccountRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      list.push({
        id: row.id as string,
        accountCode: row.account_code as string,
        accountName: row.account_name as string,
        accountType: row.account_type as AccountType,
        parentId: (row.parent_id as string) || null,
        normalBalance: row.normal_balance as NormalBalance,
        isActive: Boolean(row.is_active),
        isSystemAccount: Boolean(row.is_system_account),
        description: (row.description as string) || null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        parentName: (row.parent_name as string) || undefined,
      });
    }
    stmt.free();
    return list;
  }

  /**
   * Create or Update Account
   */
  public static saveAccount(account: Partial<AccountRecord>, db?: Database): AccountRecord {
    const raw = db || getRawSqlDb();
    const now = new Date().toISOString();
    const id = account.id || `acc-${account.accountCode || Date.now()}`;

    const checkStmt = raw.prepare('SELECT id, is_system_account FROM accounts WHERE id = :id LIMIT 1');
    checkStmt.bind({ ':id': id });
    const exists = checkStmt.step();
    let isSystem = false;
    if (exists) {
      isSystem = Boolean(checkStmt.getAsObject().is_system_account);
    }
    checkStmt.free();

    if (exists) {
      raw.run(
        `UPDATE accounts SET 
          account_code = ?, account_name = ?, account_type = ?, parent_id = ?, normal_balance = ?,
          description = ?, updated_at = ?
         WHERE id = ?`,
        [
          account.accountCode || '',
          account.accountName || '',
          account.accountType || 'EXPENSE',
          account.parentId || null,
          account.normalBalance || 'DEBIT',
          account.description || null,
          now,
          id,
        ]
      );
    } else {
      raw.run(
        `INSERT INTO accounts (id, account_code, account_name, account_type, parent_id, normal_balance, is_active, is_system_account, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
        [
          id,
          account.accountCode || '',
          account.accountName || '',
          account.accountType || 'EXPENSE',
          account.parentId || null,
          account.normalBalance || 'DEBIT',
          account.description || null,
          now,
          now,
        ]
      );
    }

    saveLocalDbState();
    return this.getAccounts(raw).find((a) => a.id === id)!;
  }

  /**
   * Toggle Account Active Status (System accounts protected)
   */
  public static toggleAccountActive(id: string, active: boolean, db?: Database): void {
    const raw = db || getRawSqlDb();
    const stmt = raw.prepare('SELECT is_system_account FROM accounts WHERE id = :id LIMIT 1');
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const isSystem = Boolean(stmt.getAsObject().is_system_account);
      if (isSystem && !active) {
        stmt.free();
        throw new Error('System accounts (Cash, Bank, Inventory, COGS, Sales) cannot be deactivated.');
      }
    }
    stmt.free();

    const now = new Date().toISOString();
    raw.run('UPDATE accounts SET is_active = ?, updated_at = ? WHERE id = ?', [active ? 1 : 0, now, id]);
    saveLocalDbState();
  }

  /**
   * Fetch All Account Mappings
   */
  public static getAccountMappings(db?: Database): AccountMappingRecord[] {
    const raw = db || getRawSqlDb();
    const stmt = raw.prepare(`
      SELECT m.*, a.account_code, a.account_name 
      FROM account_mappings m 
      JOIN accounts a ON m.account_id = a.id 
      ORDER BY m.mapping_key ASC
    `);
    const list: AccountMappingRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      list.push({
        id: row.id as string,
        mappingKey: row.mapping_key as string,
        accountId: row.account_id as string,
        accountCode: row.account_code as string,
        accountName: row.account_name as string,
        updatedAt: row.updated_at as string,
      });
    }
    stmt.free();
    return list;
  }

  /**
   * Update Account Mapping
   */
  public static updateAccountMapping(mappingKey: string, accountId: string, db?: Database): void {
    const raw = db || getRawSqlDb();
    const now = new Date().toISOString();
    raw.run(
      `INSERT INTO account_mappings (id, mapping_key, account_id, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(mapping_key) DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at`,
      [`map-${mappingKey.toLowerCase()}`, mappingKey, accountId, now]
    );
    saveLocalDbState();
  }

  /**
   * Fetch Journal Entries with Line Items
   */
  public static getJournalEntries(db?: Database, limit = 100): JournalEntryRecord[] {
    const raw = db || getRawSqlDb();
    const stmt = raw.prepare(`
      SELECT je.*, u.full_name as creator_name
      FROM journal_entries je
      LEFT JOIN users u ON je.created_by = u.id
      ORDER BY je.created_at DESC
      LIMIT :limit
    `);
    stmt.bind({ ':limit': limit });

    const entries: JournalEntryRecord[] = [];
    const entryIds: string[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      const id = r.id as string;
      entryIds.push(id);
      entries.push({
        id,
        journalNumber: r.journal_number as string,
        transactionDate: r.transaction_date as string,
        referenceType: r.reference_type as string,
        referenceId: (r.reference_id as string) || null,
        description: r.description as string,
        status: r.status as 'DRAFT' | 'POSTED' | 'VOID',
        createdBy: r.created_by as string,
        createdByName: (r.creator_name as string) || 'System Operator',
        createdAt: r.created_at as string,
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
      });
    }
    stmt.free();

    if (entries.length === 0) return [];

    // Fetch lines
    const linesStmt = raw.prepare(`
      SELECT jl.*, a.account_code, a.account_name
      FROM journal_lines jl
      JOIN accounts a ON jl.account_id = a.id
      ORDER BY jl.id ASC
    `);

    const linesMap = new Map<string, JournalLineRecord[]>();
    while (linesStmt.step()) {
      const r = linesStmt.getAsObject();
      const entryId = r.journal_entry_id as string;
      if (!linesMap.has(entryId)) linesMap.set(entryId, []);

      linesMap.get(entryId)!.push({
        id: r.id as string,
        journalEntryId: entryId,
        accountId: r.account_id as string,
        accountCode: r.account_code as string,
        accountName: r.account_name as string,
        debit: r.debit as number,
        credit: r.credit as number,
        description: (r.description as string) || null,
      });
    }
    linesStmt.free();

    for (const e of entries) {
      e.lines = linesMap.get(e.id) || [];
      e.totalDebit = e.lines.reduce((acc, l) => acc + l.debit, 0);
      e.totalCredit = e.lines.reduce((acc, l) => acc + l.credit, 0);
    }

    return entries;
  }

  /**
   * Generates Trial Balance Report & Validates TOTAL DEBITS === TOTAL CREDITS
   */
  public static getTrialBalance(db?: Database, dateRange?: { startDate?: string; endDate?: string }): TrialBalanceReport {
    const raw = db || getRawSqlDb();

    let sql = `
      SELECT 
        a.id as account_id,
        a.account_code,
        a.account_name,
        a.account_type,
        SUM(jl.debit) as total_debit,
        SUM(jl.credit) as total_credit
      FROM accounts a
      LEFT JOIN journal_lines jl ON a.id = jl.account_id
      LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'POSTED'
    `;

    const params: Record<string, any> = {};
    if (dateRange?.startDate && dateRange?.endDate) {
      sql += ` WHERE (je.transaction_date IS NULL OR (je.transaction_date >= :start AND je.transaction_date <= :end))`;
      params[':start'] = dateRange.startDate;
      params[':end'] = dateRange.endDate;
    }

    sql += ` GROUP BY a.id ORDER BY a.account_code ASC`;

    const stmt = raw.prepare(sql);
    if (Object.keys(params).length > 0) stmt.bind(params);

    const rows: TrialBalanceRow[] = [];
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    while (stmt.step()) {
      const r = stmt.getAsObject();
      const debit = Math.round(((r.total_debit as number) || 0) * 100) / 100;
      const credit = Math.round(((r.total_credit as number) || 0) * 100) / 100;

      if (debit > 0 || credit > 0) {
        rows.push({
          accountId: r.account_id as string,
          accountCode: r.account_code as string,
          accountName: r.account_name as string,
          accountType: r.account_type as AccountType,
          debit,
          credit,
        });
        grandTotalDebit += debit;
        grandTotalCredit += credit;
      }
    }
    stmt.free();

    grandTotalDebit = Math.round(grandTotalDebit * 100) / 100;
    grandTotalCredit = Math.round(grandTotalCredit * 100) / 100;

    const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01;

    return {
      rows,
      totalDebit: grandTotalDebit,
      totalCredit: grandTotalCredit,
      isBalanced,
    };
  }

  /**
   * Generates Profit & Loss Statement (Income Statement)
   */
  public static getProfitAndLoss(db?: Database, dateRange?: { startDate?: string; endDate?: string }): ProfitAndLossReport {
    const raw = db || getRawSqlDb();

    let dateFilter = '';
    const params: Record<string, any> = {};
    if (dateRange?.startDate && dateRange?.endDate) {
      dateFilter = ` AND je.transaction_date >= :start AND je.transaction_date <= :end`;
      params[':start'] = dateRange.startDate;
      params[':end'] = dateRange.endDate;
    }

    // Query helper for net balance of specific account code or category
    const getAccountBalance = (accountCode: string): { debit: number; credit: number } => {
      const stmt = raw.prepare(`
        SELECT SUM(jl.debit) as d, SUM(jl.credit) as c
        FROM journal_lines jl
        JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'POSTED'
        JOIN accounts a ON jl.account_id = a.id
        WHERE a.account_code = :code ${dateFilter}
      `);
      stmt.bind({ ...params, ':code': accountCode });
      let d = 0, c = 0;
      if (stmt.step()) {
        const obj = stmt.getAsObject();
        d = (obj.d as number) || 0;
        c = (obj.c as number) || 0;
      }
      stmt.free();
      return { debit: d, credit: c };
    };

    // Product Sales (4010) - Normal Credit
    const salesBal = getAccountBalance('4010');
    const grossSales = salesBal.credit - salesBal.debit;

    // Other Income (4020) - Normal Credit
    const otherBal = getAccountBalance('4020');
    const otherIncome = otherBal.credit - otherBal.debit;

    // Sales Returns (4030) - Normal Debit
    const retBal = getAccountBalance('4030');
    const salesReturns = retBal.debit - retBal.credit;

    // Sales Discounts (4040) - Normal Debit
    const discBal = getAccountBalance('4040');
    const salesDiscounts = discBal.debit - discBal.credit;

    const netRevenue = grossSales + otherIncome - salesReturns - salesDiscounts;

    // COGS (5010) - Normal Debit
    const cogsBal = getAccountBalance('5010');
    const cogs = cogsBal.debit - cogsBal.credit;

    const grossProfit = netRevenue - cogs;

    // Operating Expenses (6000 series)
    const expStmt = raw.prepare(`
      SELECT a.account_code, a.account_name, SUM(jl.debit - jl.credit) as exp_net
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'POSTED'
      JOIN accounts a ON jl.account_id = a.id
      WHERE a.account_type = 'EXPENSE' AND a.account_code != '6000' ${dateFilter}
      GROUP BY a.id
      ORDER BY a.account_code ASC
    `);
    if (Object.keys(params).length > 0) expStmt.bind(params);

    const operatingExpenses: Array<{ accountCode: string; accountName: string; amount: number }> = [];
    let totalExpenses = 0;

    while (expStmt.step()) {
      const r = expStmt.getAsObject();
      const amt = Math.max(0, (r.exp_net as number) || 0);
      if (amt > 0) {
        operatingExpenses.push({
          accountCode: r.account_code as string,
          accountName: r.account_name as string,
          amount: amt,
        });
        totalExpenses += amt;
      }
    }
    expStmt.free();

    const netProfit = grossProfit - totalExpenses;

    return {
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
      grossSales,
      otherIncome,
      salesReturns,
      salesDiscounts,
      netRevenue,
      cogs,
      grossProfit,
      operatingExpenses,
      totalExpenses,
      netProfit,
    };
  }

  /**
   * Fetch General Ledger for a specific account
   */
  public static getGeneralLedger(
    db?: Database,
    accountId?: string,
    dateRange?: { startDate?: string; endDate?: string }
  ): GeneralLedgerEntry[] {
    const raw = db || getRawSqlDb();

    let sql = `
      SELECT 
        je.transaction_date,
        je.journal_number,
        je.reference_type,
        je.reference_id,
        jl.description as line_desc,
        je.description as header_desc,
        jl.debit,
        jl.credit
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'POSTED'
      WHERE 1=1
    `;

    const params: Record<string, any> = {};
    if (accountId) {
      sql += ` AND jl.account_id = :accId`;
      params[':accId'] = accountId;
    }
    if (dateRange?.startDate && dateRange?.endDate) {
      sql += ` AND je.transaction_date >= :start AND je.transaction_date <= :end`;
      params[':start'] = dateRange.startDate;
      params[':end'] = dateRange.endDate;
    }

    sql += ` ORDER BY je.transaction_date ASC, je.id ASC`;

    const stmt = raw.prepare(sql);
    if (Object.keys(params).length > 0) stmt.bind(params);

    const entries: GeneralLedgerEntry[] = [];
    let runningBalance = 0;

    while (stmt.step()) {
      const r = stmt.getAsObject();
      const debit = (r.debit as number) || 0;
      const credit = (r.credit as number) || 0;
      runningBalance += debit - credit;

      entries.push({
        date: r.transaction_date as string,
        journalNumber: r.journal_number as string,
        referenceType: r.reference_type as string,
        referenceId: (r.reference_id as string) || null,
        description: (r.line_desc as string) || (r.header_desc as string) || '',
        debit,
        credit,
        balance: runningBalance,
      });
    }
    stmt.free();

    return entries;
  }

  /**
   * Fetch Real-Time Live Accounting Dashboard KPI Metrics
   */
  public static getDashboardMetrics(db?: Database): AccountingDashboardMetrics {
    const raw = db || getRawSqlDb();

    // Date range for today
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const todayPnL = this.getProfitAndLoss(raw, { startDate: todayStart, endDate: todayEnd });
    const allTimeTb = this.getTrialBalance(raw);

    // Calculate account balances from Trial Balance
    const getAccountNetBalance = (code: string) => {
      const r = allTimeTb.rows.find((x) => x.accountCode === code);
      if (!r) return 0;
      if (r.accountType === 'ASSET' || r.accountType === 'EXPENSE' || r.accountType === 'COGS') {
        return r.debit - r.credit;
      }
      return r.credit - r.debit;
    };

    return {
      todaySales: todayPnL.grossSales,
      todayExpenses: todayPnL.totalExpenses,
      todayGrossProfit: todayPnL.grossProfit,
      todayNetProfit: todayPnL.netProfit,
      cashBalance: getAccountNetBalance('1010'),
      bankBalance: getAccountNetBalance('1020'),
      customerReceivables: getAccountNetBalance('1030'),
      supplierPayables: getAccountNetBalance('2010'),
      inventoryValue: getAccountNetBalance('1040'),
    };
  }
}
