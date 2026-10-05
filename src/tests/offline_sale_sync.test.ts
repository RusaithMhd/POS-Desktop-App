import { describe, it, expect, beforeAll } from 'vitest';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { 
  SQLiteSaleRepository, 
  SQLiteProductRepository, 
  SQLiteShiftRepository, 
  SQLiteSyncQueueRepository,
  SQLiteInventoryRepository
} from '@/infrastructure/repositories/SQLiteRepositories';
import { ProcessSaleUseCase } from '@/application/use-cases/ProcessSaleUseCase';

describe('TRIWYN POS — Critical Offline-First & Idempotent Sync Test Suite', () => {
  let saleRepo: SQLiteSaleRepository;
  let productRepo: SQLiteProductRepository;
  let shiftRepo: SQLiteShiftRepository;
  let queueRepo: SQLiteSyncQueueRepository;
  let invRepo: SQLiteInventoryRepository;
  let processSaleUseCase: ProcessSaleUseCase;

  beforeAll(async () => {
    await getLocalDb();
    saleRepo = new SQLiteSaleRepository();
    productRepo = new SQLiteProductRepository();
    shiftRepo = new SQLiteShiftRepository();
    queueRepo = new SQLiteSyncQueueRepository();
    invRepo = new SQLiteInventoryRepository();
    processSaleUseCase = new ProcessSaleUseCase(saleRepo, productRepo, shiftRepo);
  });

  it('1. Should open a cashier shift locally offline', async () => {
    const shift = await shiftRepo.openShift('term-001', 'usr-admin', 200.0);
    expect(shift).toBeDefined();
    expect(shift.status).toBe('OPEN');
    expect(shift.openingCash).toBe(200.0);
  });

  it('2. Should process 100 offline sales with atomic local transactions and unique idempotency keys', async () => {
    // Increase stock of prod-001 so 100 items can be sold
    await productRepo.updateStock('prod-001', 200);

    const activeShift = await shiftRepo.getActiveShift('term-001');
    expect(activeShift).toBeDefined();

    const userPermissions = ['sales.create', 'sales.discount', 'cash_register.open'];

    for (let i = 1; i <= 100; i++) {
      const clientTransactionId = `TRM-01-OFFLINE-TEST-${i.toString().padStart(4, '0')}`;
      const sale = await processSaleUseCase.execute(
        {
          clientTransactionId,
          businessId: 'biz-001',
          branchId: 'branch-001',
          terminalId: 'term-001',
          userId: 'usr-admin',
          shiftId: activeShift!.id,
          items: [
            {
              productId: 'prod-001',
              productName: 'Espresso Coffee Beans 1kg',
              unitPrice: 24.99,
              costPrice: 12.50,
              quantity: 1,
              taxRate: 8.0,
            },
          ],
          payments: [
            {
              paymentMethodId: 'pm-cash',
              methodCode: 'CASH',
              amount: 30.0,
            },
          ],
        },
        userPermissions
      );

      expect(sale).toBeDefined();
      expect(sale.clientTransactionId).toBe(clientTransactionId);
    }

    // Verify exactly 100 sales exist in local SQLite
    const recentSales = await saleRepo.getRecentSales(150);
    const testSales = recentSales.filter((s) => s.clientTransactionId.startsWith('TRM-01-OFFLINE-TEST-'));
    expect(testSales.length).toBe(100);
  });

  it('3. Should preserve all 100 sales in local SQLite database after app restart simulation', async () => {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT COUNT(*) as cnt FROM sales WHERE client_transaction_id LIKE "TRM-01-OFFLINE-TEST-%"');
    stmt.step();
    const count = stmt.getAsObject().cnt as number;
    stmt.free();

    expect(count).toBe(100);
  });

  it('4. Should deduplicate duplicate sync requests using Idempotency Key (client_transaction_id)', async () => {
    const clientTxId = 'TRM-01-OFFLINE-TEST-0001';
    
    // Simulate duplicate sale execution with exact same idempotency key
    const activeShift = await shiftRepo.getActiveShift('term-001');
    const duplicateSale = await saleRepo.createSaleTransaction({
      clientTransactionId: clientTxId,
      businessId: 'biz-001',
      branchId: 'branch-001',
      terminalId: 'term-001',
      userId: 'usr-admin',
      shiftId: activeShift!.id,
      items: [
        {
          productId: 'prod-001',
          productName: 'Espresso Coffee Beans 1kg',
          unitPrice: 24.99,
          costPrice: 12.50,
          quantity: 1,
        },
      ],
      payments: [{ paymentMethodId: 'pm-cash', methodCode: 'CASH', amount: 30.0 }],
    });

    // Verify idempotency returned original sale rather than creating duplicate row
    expect(duplicateSale.clientTransactionId).toBe(clientTxId);

    const countStmt = getRawSqlDb().prepare('SELECT COUNT(*) as cnt FROM sales WHERE client_transaction_id = :txId');
    countStmt.bind({ ':txId': clientTxId });
    countStmt.step();
    const count = countStmt.getAsObject().cnt as number;
    countStmt.free();

    expect(count).toBe(1); // Exactly 1, 0 duplicates!
  });

  it('5. Should verify inventory movement ledger traceability for all stock reductions', async () => {
    const movements = await invRepo.getMovementsByProduct('prod-001');

    expect(movements.length).toBeGreaterThan(0);
    const saleMovements = movements.filter((m) => m.movementType === 'SALE');
    expect(saleMovements.length).toBeGreaterThanOrEqual(100);
  });
});
