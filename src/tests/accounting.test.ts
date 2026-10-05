import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import { seedAccountingData } from '../infrastructure/database/sqlite/seed';
import { AccountingService } from '../services/accounting/AccountingService';

describe('BASIC ACCOUNTING MODULE — VALIDATION & INTEGRITY TEST SUITE', () => {
  let db: Database;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();

    // Create minimal core tables for test
    db.run(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT);
      INSERT INTO users (id, username) VALUES ('usr-admin', 'admin');
    `);

    seedAccountingData(db);
  });

  // Helper to query account net balance from Trial Balance
  const getAccountBalance = (accountCode: string): { debit: number; credit: number; net: number } => {
    const tb = AccountingService.getTrialBalance(db);
    const row = tb.rows.find((r) => r.accountCode === accountCode);
    if (!row) return { debit: 0, credit: 0, net: 0 };
    return {
      debit: row.debit,
      credit: row.credit,
      net: row.debit - row.credit,
    };
  };

  it('Test 1 — Cash Sale (Sale = Rs. 10,000, Cost = Rs. 6,000)', () => {
    db.run('BEGIN TRANSACTION;');
    AccountingService.recordSale(db, {
      saleId: 'sale-test-1',
      invoiceNumber: 'INV-1001',
      userId: 'usr-admin',
      subtotal: 10000,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 10000,
      paidAmount: 10000,
      payments: [{ methodCode: 'CASH', amount: 10000 }],
      items: [{ productId: 'prod-001', costPrice: 6000, quantity: 1 }],
    });
    db.run('COMMIT;');

    // Verify Cash (1010) +10,000 Debit
    const cash = getAccountBalance('1010');
    expect(cash.debit).toBe(10000);

    // Verify Sales (4010) +10,000 Credit
    const sales = getAccountBalance('4010');
    expect(sales.credit).toBe(10000);

    // Verify COGS (5010) +6,000 Debit
    const cogs = getAccountBalance('5010');
    expect(cogs.debit).toBe(6000);

    // Verify Inventory (1040) -6,000 Credit
    const inv = getAccountBalance('1040');
    expect(inv.credit).toBe(6000);

    // Verify Trial Balance is balanced
    const tb = AccountingService.getTrialBalance(db);
    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });

  it('Test 2 — Credit Sale (Receivable +10,000, Sales +10,000, COGS +6,000, Inventory -6,000)', () => {
    db.run('BEGIN TRANSACTION;');
    AccountingService.recordSale(db, {
      saleId: 'sale-test-2',
      invoiceNumber: 'INV-1002',
      userId: 'usr-admin',
      subtotal: 10000,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 10000,
      paidAmount: 0, // 0 paid upfront = full credit sale
      customerId: 'cust-002',
      payments: [{ methodCode: 'CREDIT', amount: 10000 }],
      items: [{ productId: 'prod-001', costPrice: 6000, quantity: 1 }],
    });
    db.run('COMMIT;');

    // Accounts Receivable (1030) +10,000 Debit
    const ar = getAccountBalance('1030');
    expect(ar.debit).toBe(10000);

    // Sales (4010) +10,000 Credit
    const sales = getAccountBalance('4010');
    expect(sales.credit).toBe(10000);

    // COGS (5010) +6,000 Debit
    const cogs = getAccountBalance('5010');
    expect(cogs.debit).toBe(6000);

    // Inventory (1040) +6,000 Credit
    const inv = getAccountBalance('1040');
    expect(inv.credit).toBe(6000);

    expect(AccountingService.getTrialBalance(db).isBalanced).toBe(true);
  });

  it('Test 3 — Customer Payment (Cash +5,000, Receivable -5,000)', () => {
    db.run('BEGIN TRANSACTION;');
    AccountingService.recordCustomerPayment(db, {
      paymentId: 'pay-cust-1',
      customerId: 'cust-002',
      userId: 'usr-admin',
      amount: 5000,
      paymentMethod: 'CASH',
      reference: 'Partial credit payment',
    });
    db.run('COMMIT;');

    const cash = getAccountBalance('1010');
    expect(cash.debit).toBe(5000);

    const ar = getAccountBalance('1030');
    expect(ar.credit).toBe(5000);

    expect(AccountingService.getTrialBalance(db).isBalanced).toBe(true);
  });

  it('Test 4 — Stock Purchase (Inventory +20,000, Cash/Payable +20,000)', () => {
    db.run('BEGIN TRANSACTION;');
    AccountingService.recordPurchase(db, {
      purchaseId: 'pur-test-1',
      invoiceNumber: 'PO-9001',
      supplierId: 'sup-001',
      userId: 'usr-admin',
      totalAmount: 20000,
      paidAmount: 20000,
      paymentMethod: 'CASH',
    });
    db.run('COMMIT;');

    const inv = getAccountBalance('1040');
    expect(inv.debit).toBe(20000);

    const cash = getAccountBalance('1010');
    expect(cash.credit).toBe(20000);

    expect(AccountingService.getTrialBalance(db).isBalanced).toBe(true);
  });

  it('Test 5 — Expense (Expense +5,000, Cash/Bank -5,000)', () => {
    db.run('BEGIN TRANSACTION;');
    AccountingService.recordExpense(db, {
      expenseId: 'exp-test-1',
      category: 'Electricity',
      amount: 5000,
      paymentMethod: 'CASH',
      userId: 'usr-admin',
      description: 'Electricity bill payment',
    });
    db.run('COMMIT;');

    const exp = getAccountBalance('6020'); // Electricity 6020
    expect(exp.debit).toBe(5000);

    const cash = getAccountBalance('1010');
    expect(cash.credit).toBe(5000);

    expect(AccountingService.getTrialBalance(db).isBalanced).toBe(true);
  });

  it('Test 6 — Supplier Payment (Payable -10,000, Cash/Bank -10,000)', () => {
    db.run('BEGIN TRANSACTION;');
    AccountingService.recordSupplierPayment(db, {
      paymentId: 'spay-test-1',
      supplierId: 'sup-001',
      userId: 'usr-admin',
      amount: 10000,
      paymentMethod: 'BANK_TRANSFER',
      reference: 'PO settlement',
    });
    db.run('COMMIT;');

    const ap = getAccountBalance('2010'); // Accounts Payable
    expect(ap.debit).toBe(10000);

    const bank = getAccountBalance('1020'); // Bank Account
    expect(bank.credit).toBe(10000);

    expect(AccountingService.getTrialBalance(db).isBalanced).toBe(true);
  });

  it('Test 7 — Owner Capital (Cash +100,000, Capital +100,000)', () => {
    db.run('BEGIN TRANSACTION;');
    AccountingService.recordOwnerCapital(db, {
      userId: 'usr-admin',
      amount: 100000,
      paymentMethod: 'CASH',
      notes: 'Initial capital investment',
    });
    db.run('COMMIT;');

    const cash = getAccountBalance('1010');
    expect(cash.debit).toBe(100000);

    const capital = getAccountBalance('3010'); // Owner Capital 3010
    expect(capital.credit).toBe(100000);

    expect(AccountingService.getTrialBalance(db).isBalanced).toBe(true);
  });

  it('Test 8 — Owner Drawing (Drawings +10,000, Cash -10,000)', () => {
    db.run('BEGIN TRANSACTION;');
    AccountingService.recordOwnerDrawing(db, {
      userId: 'usr-admin',
      amount: 10000,
      paymentMethod: 'CASH',
      notes: 'Personal store withdrawal',
    });
    db.run('COMMIT;');

    const drawings = getAccountBalance('3020'); // Owner Drawings 3020 (Normal Debit)
    expect(drawings.debit).toBe(10000);

    const cash = getAccountBalance('1010');
    expect(cash.credit).toBe(10000);

    expect(AccountingService.getTrialBalance(db).isBalanced).toBe(true);
  });

  it('Test 9 — Sales Return (Revenue reversal & Inventory restoration)', () => {
    db.run('BEGIN TRANSACTION;');
    AccountingService.recordSalesReturn(db, {
      returnId: 'ret-test-1',
      returnNumber: 'RET-0001',
      saleId: 'sale-test-1',
      userId: 'usr-admin',
      totalRefundAmount: 2000,
      paymentMethod: 'CASH',
      items: [{ productId: 'prod-001', costPrice: 1200, quantity: 1 }],
    });
    db.run('COMMIT;');

    // Revenue reversal: Sales Returns (4030) +2000 Debit
    const salesReturns = getAccountBalance('4030');
    expect(salesReturns.debit).toBe(2000);

    // Cash payout: Cash (1010) +2000 Credit
    const cash = getAccountBalance('1010');
    expect(cash.credit).toBe(2000);

    // Inventory restoration: Inventory (1040) +1200 Debit
    const inv = getAccountBalance('1040');
    expect(inv.debit).toBe(1200);

    // COGS credit reduction: COGS (5010) +1200 Credit
    const cogs = getAccountBalance('5010');
    expect(cogs.credit).toBe(1200);

    expect(AccountingService.getTrialBalance(db).isBalanced).toBe(true);
  });

  it('Test 10 — Accounting Integrity (Enforces SUM(debit) = SUM(credit) & rejects unbalanced entries)', () => {
    expect(() => {
      AccountingService.postJournalEntry(
        db,
        {
          referenceType: 'MANUAL',
          description: 'Intentionally Imbalanced Entry',
          createdBy: 'usr-admin',
        },
        [
          { accountId: 'acc-1010', debit: 1000, credit: 0 },
          { accountId: 'acc-4010', debit: 0, credit: 500 }, // Imbalanced! 1000 != 500
        ]
      );
    }).toThrow(/ACCOUNTING INTEGRITY ERROR/);
  });
});
