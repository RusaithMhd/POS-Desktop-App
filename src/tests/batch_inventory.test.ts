import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from 'sql.js';
import { getLocalDb, getRawSqlDb } from '../infrastructure/database/sqlite/db';
import { seedAccountingData } from '../infrastructure/database/sqlite/seed';
import { AccountingService } from '../services/accounting/AccountingService';
import {
  SQLiteProductRepository,
  SQLiteSupplierRepository,
  SQLiteInventoryBatchRepository,
  SQLiteSaleRepository,
} from '../infrastructure/repositories/SQLiteRepositories';

describe('SUPPLIER & BATCH-WISE INVENTORY SYSTEM — END-TO-END SPECIFICATION TEST', () => {
  let db: Database;

  beforeEach(async () => {
    await getLocalDb();
    db = getRawSqlDb();

    // Ensure clean state for test tables
    try {
      db.run('DELETE FROM sale_item_batch_allocations;');
      db.run('DELETE FROM inventory_batch_transactions;');
      db.run('DELETE FROM inventory_batches;');
      db.run('DELETE FROM purchase_items;');
      db.run('DELETE FROM purchases;');
      db.run('DELETE FROM supplier_payments;');
      db.run('DELETE FROM suppliers;');
      db.run('DELETE FROM sale_payments;');
      db.run('DELETE FROM sale_items;');
      db.run('DELETE FROM sales;');
      db.run('DELETE FROM products;');
    } catch {}

    seedAccountingData(db);
  });

  it('PROPERLY EXECUTES MULTI-SUPPLIER PURCHASES, FIFO STOCK CONSUMPTION, BATCH COGS, AND ACCOUNTING', async () => {
    const prodRepo = new SQLiteProductRepository();
    const supplierRepo = new SQLiteSupplierRepository();
    const batchRepo = new SQLiteInventoryBatchRepository();
    const saleRepo = new SQLiteSaleRepository();

    // 1. Create Suppliers
    const supplierABC = await supplierRepo.save({
      code: 'SUP-0001',
      name: 'ABC Distributors',
      companyName: 'ABC Corp',
      phone: '+94771234567',
      paymentTerms: '30 Days',
      creditLimit: 500000,
    });

    const supplierXYZ = await supplierRepo.save({
      code: 'SUP-0002',
      name: 'XYZ Traders',
      companyName: 'XYZ Ltd',
      phone: '+94779876543',
      paymentTerms: '15 Days',
      creditLimit: 300000,
    });

    // 2. Create Master Product: Coca Cola 500ml
    const product = await prodRepo.save({
      name: 'Coca Cola 500ml',
      sku: 'CC500',
      barcode: '5449000000996',
      costPrice: 120, // Default master cost
      sellingPrice: 180, // Master Selling Price
      stockQuantity: 0,
      minStockLevel: 10,
    });

    expect(product.id).toBeDefined();

    // 3. Purchase 1: ABC Distributors — 100 units @ Rs. 120 (Cash Purchase)
    const purch1 = await batchRepo.createPurchaseWithBatches({
      supplierId: supplierABC.id,
      invoiceNumber: 'SUP-INV-10025',
      branchId: 'branch-001',
      userId: 'usr-admin',
      items: [
        {
          productId: product.id,
          quantity: 100,
          unitCost: 120,
          supplierBatchNumber: 'LOT-ABC-2026-001',
        },
      ],
      paidAmount: 12000,
      paymentMethod: 'CASH',
      notes: 'First Purchase from ABC',
    });

    expect(purch1.totalAmount).toBe(12000);
    expect(purch1.paymentStatus).toBe('PAID');

    // 4. Purchase 2: XYZ Traders — 100 units @ Rs. 135 (Credit Purchase)
    const purch2 = await batchRepo.createPurchaseWithBatches({
      supplierId: supplierXYZ.id,
      invoiceNumber: 'SUP-INV-9908',
      branchId: 'branch-001',
      userId: 'usr-admin',
      items: [
        {
          productId: product.id,
          quantity: 100,
          unitCost: 135,
          supplierBatchNumber: 'LOT-XYZ-2026-09',
        },
      ],
      paidAmount: 0, // 0 paid = full credit purchase
      paymentMethod: 'CREDIT',
      notes: 'Second Purchase from XYZ on credit',
    });

    expect(purch2.totalAmount).toBe(13500);
    expect(purch2.paymentStatus).toBe('UNPAID');

    // Verify Product Stock = 200 (ONE Product Master, NO Duplication)
    const updatedProd = await prodRepo.getById(product.id);
    expect(updatedProd?.stockQuantity).toBe(200);

    // Verify Active Batches count & remaining stock
    const activeBatches = await batchRepo.getBatchesByProductId(product.id);
    expect(activeBatches.length).toBe(2);

    const batch1 = activeBatches.find((b) => b.supplierId === supplierABC.id);
    const batch2 = activeBatches.find((b) => b.supplierId === supplierXYZ.id);

    expect(batch1?.unitCost).toBe(120);
    expect(batch1?.quantityRemaining).toBe(100);

    expect(batch2?.unitCost).toBe(135);
    expect(batch2?.quantityRemaining).toBe(100);

    // Verify Supplier XYZ Outstanding Balance = Rs. 13,500
    const xyzSup = await supplierRepo.getById(supplierXYZ.id);
    expect(xyzSup?.currentOutstanding).toBe(13500);

    // Verify Total Inventory Valuation before Sale:
    // (100 * 120) + (100 * 135) = 12,000 + 13,500 = 25,500
    const valBefore = await batchRepo.getInventoryValuation();
    expect(valBefore.totalValue).toBe(25500);

    // 5. Customer Buys 120 units of Coca Cola 500ml @ Rs. 180 (Total Sale = 21,600)
    const saleResult = await saleRepo.createSaleTransaction({
      clientTransactionId: 'tx-001',
      businessId: 'biz-001',
      branchId: 'branch-001',
      terminalId: 'term-001',
      userId: 'usr-admin',
      shiftId: 'shift-001',
      items: [
        {
          productId: product.id,
          productName: product.name,
          unitPrice: 180,
          costPrice: 120, // baseline price passed
          quantity: 120,
        },
      ],
      payments: [{ paymentMethodId: 'pm-cash', methodCode: 'CASH', amount: 21600 }],
    });

    expect(saleResult.totalAmount).toBe(21600);

    // 6. Verify FIFO Batch Consumption:
    // Batch 1 (ABC @ 120): 100 consumed, 0 remaining -> DEPLETED
    // Batch 2 (XYZ @ 135): 20 consumed, 80 remaining -> ACTIVE
    const batchesAfterSale = await batchRepo.getBatchesByProductId(product.id);
    const batch1After = batchesAfterSale.find((b) => b.id === batch1?.id);
    const batch2After = batchesAfterSale.find((b) => b.id === batch2?.id);

    expect(batch1After?.quantityRemaining).toBe(0);
    expect(batch1After?.status).toBe('DEPLETED');

    expect(batch2After?.quantityRemaining).toBe(80);
    expect(batch2After?.status).toBe('ACTIVE');

    // 7. Verify Exact Calculated COGS:
    // 100 * 120 + 20 * 135 = 12,000 + 2,700 = Rs. 14,700
    // Gross Profit = 21,600 - 14,700 = Rs. 6,900
    const cogsAccount = AccountingService.getTrialBalance(db).rows.find((r) => r.accountCode === '5010');
    expect(cogsAccount?.debit).toBe(14700);

    // 8. Verify Remaining Inventory Valuation:
    // 80 * 135 = Rs. 10,800
    const valAfter = await batchRepo.getInventoryValuation();
    expect(valAfter.totalValue).toBe(10800);

    // 9. Verify Double-Entry Accounting Trial Balance is strictly balanced
    const tb = AccountingService.getTrialBalance(db);
    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);

    // 10. Perform Stock Adjustment on Batch 2 (XYZ) — Damaged 5 units
    await batchRepo.adjustBatchStock({
      batchId: batch2!.id,
      quantityChange: -5,
      reason: 'DAMAGED: Bottles broken during stock move',
      userId: 'usr-admin',
    });

    const batch2AfterAdj = (await batchRepo.getBatchesByProductId(product.id)).find((b) => b.id === batch2?.id);
    expect(batch2AfterAdj?.quantityRemaining).toBe(75);

    const finalProd = await prodRepo.getById(product.id);
    expect(finalProd?.stockQuantity).toBe(75);
  });
});
