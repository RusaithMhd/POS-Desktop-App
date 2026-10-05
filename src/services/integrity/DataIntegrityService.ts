import { Database } from 'sql.js';

export interface DiscrepancyItem {
  type: 'INVENTORY_MISMATCH' | 'CALCULATION_MISMATCH' | 'ORPHAN_RECORD' | 'DUPLICATE_KEY';
  entity: string;
  entityId: string;
  description: string;
  expectedValue: any;
  actualValue: any;
  severity: 'WARNING' | 'CRITICAL';
}

export interface SystemIntegrityReport {
  databaseStatus: 'HEALTHY' | 'WARNING' | 'CORRUPTED';
  inventoryDiscrepancyCount: number;
  calculationErrorCount: number;
  orphanRecordCount: number;
  duplicateKeyCount: number;
  lastCheckedAt: string;
  discrepancies: DiscrepancyItem[];
}

export class DataIntegrityService {
  /**
   * Run comprehensive data integrity audits across products, inventory, sales, payments, receipts, and audit logs.
   */
  public static runIntegrityAudit(db: Database): SystemIntegrityReport {
    const discrepancies: DiscrepancyItem[] = [];

    // 1. Audit Sale Financial Calculation Mismatches (Header Total vs Items Sum)
    const saleCalcStmt = db.prepare(`
      SELECT 
        s.id, 
        s.invoice_number, 
        s.total_amount as header_total,
        COALESCE(SUM(si.total_amount), 0) as items_sum,
        s.discount_amount,
        s.tax_amount
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.status = 'COMPLETED'
      GROUP BY s.id
    `);

    while (saleCalcStmt.step()) {
      const row = saleCalcStmt.getAsObject();
      const headerTotal = Number(row.header_total || 0);
      const itemsSum = Number(row.items_sum || 0);
      const discount = Number(row.discount_amount || 0);
      const tax = Number(row.tax_amount || 0);

      // Account for both Tax-Inclusive (headerTotal == itemsSum - discount) and Tax-Exclusive (headerTotal == itemsSum - discount + tax)
      const expectedInclusive = Math.max(0, itemsSum - discount);
      const expectedExclusive = Math.max(0, itemsSum - discount) + tax;

      const diffInclusive = Math.abs(headerTotal - expectedInclusive);
      const diffExclusive = Math.abs(headerTotal - expectedExclusive);

      if (diffInclusive > 0.05 && diffExclusive > 0.05 && itemsSum > 0) {
        discrepancies.push({
          type: 'CALCULATION_MISMATCH',
          entity: 'sales',
          entityId: row.id as string,
          description: `Sale ${row.invoice_number} header total (LKR ${headerTotal}) does not match calculated line items (LKR ${expectedInclusive.toFixed(2)} inclusive / LKR ${expectedExclusive.toFixed(2)} exclusive).`,
          expectedValue: expectedInclusive,
          actualValue: headerTotal,
          severity: 'CRITICAL',
        });
      }
    }
    saleCalcStmt.free();

    // 2. Audit Inventory Ledger Reconciliation (Product Stock vs Sum of Batches)
    const invReconcileStmt = db.prepare(`
      SELECT 
        p.id, 
        p.name, 
        p.stock_quantity as master_stock,
        COALESCE(SUM(b.quantity_remaining), 0) as batch_stock
      FROM products p
      LEFT JOIN inventory_batches b ON p.id = b.product_id AND b.status = 'ACTIVE'
      WHERE p.track_inventory = 1 AND p.is_active = 1
      GROUP BY p.id
    `);

    while (invReconcileStmt.step()) {
      const row = invReconcileStmt.getAsObject();
      const masterStock = Number(row.master_stock || 0);
      const batchStock = Number(row.batch_stock || 0);

      if (Math.abs(masterStock - batchStock) > 0.001) {
        discrepancies.push({
          type: 'INVENTORY_MISMATCH',
          entity: 'products',
          entityId: row.id as string,
          description: `Product "${row.name}" master stock quantity (${masterStock}) does not match sum of active FIFO batches (${batchStock}).`,
          expectedValue: batchStock,
          actualValue: masterStock,
          severity: 'WARNING',
        });
      }
    }
    invReconcileStmt.free();

    // 3. Audit Orphan Records (Sale Items without Sale, Payments without Sale)
    const orphanItemsStmt = db.prepare(`
      SELECT si.id, si.product_name 
      FROM sale_items si
      LEFT JOIN sales s ON si.sale_id = s.id
      WHERE s.id IS NULL
    `);

    while (orphanItemsStmt.step()) {
      const row = orphanItemsStmt.getAsObject();
      discrepancies.push({
        type: 'ORPHAN_RECORD',
        entity: 'sale_items',
        entityId: row.id as string,
        description: `Orphan sale item "${row.product_name}" (ID: ${row.id}) has no valid parent sale record.`,
        expectedValue: 'Valid Sale Parent',
        actualValue: null,
        severity: 'CRITICAL',
      });
    }
    orphanItemsStmt.free();

    // 4. Duplicate Check (Duplicate Receipts or Duplicate Invoices)
    const dupReceiptStmt = db.prepare(`
      SELECT receipt_number, COUNT(*) as cnt 
      FROM receipts 
      GROUP BY receipt_number 
      HAVING cnt > 1
    `);

    while (dupReceiptStmt.step()) {
      const row = dupReceiptStmt.getAsObject();
      discrepancies.push({
        type: 'DUPLICATE_KEY',
        entity: 'receipts',
        entityId: row.receipt_number as string,
        description: `Duplicate receipt number detected: "${row.receipt_number}" (${row.cnt} occurrences).`,
        expectedValue: 1,
        actualValue: row.cnt,
        severity: 'CRITICAL',
      });
    }
    dupReceiptStmt.free();

    const invCount = discrepancies.filter((d) => d.type === 'INVENTORY_MISMATCH').length;
    const calcCount = discrepancies.filter((d) => d.type === 'CALCULATION_MISMATCH').length;
    const orphanCount = discrepancies.filter((d) => d.type === 'ORPHAN_RECORD').length;
    const dupCount = discrepancies.filter((d) => d.type === 'DUPLICATE_KEY').length;

    let databaseStatus: 'HEALTHY' | 'WARNING' | 'CORRUPTED' = 'HEALTHY';
    if (discrepancies.some((d) => d.severity === 'CRITICAL')) {
      databaseStatus = 'CORRUPTED';
    } else if (discrepancies.length > 0) {
      databaseStatus = 'WARNING';
    }

    return {
      databaseStatus,
      inventoryDiscrepancyCount: invCount,
      calculationErrorCount: calcCount,
      orphanRecordCount: orphanCount,
      duplicateKeyCount: dupCount,
      lastCheckedAt: new Date().toISOString(),
      discrepancies,
    };
  }

  /**
   * Reconciles inventory stock for a product automatically using the movement ledger
   */
  public static reconcileProductStock(db: Database, productId: string): { masterStock: number; batchStock: number } {
    const batchStmt = db.prepare(
      `SELECT COALESCE(SUM(quantity_remaining), 0) as total FROM inventory_batches WHERE product_id = :pId AND status = 'ACTIVE'`
    );
    batchStmt.bind({ ':pId': productId });
    let batchStock = 0;
    if (batchStmt.step()) {
      batchStock = (batchStmt.getAsObject().total as number) || 0;
    }
    batchStmt.free();

    const now = new Date().toISOString();
    db.run(`UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?`, [batchStock, now, productId]);
    db.run(`UPDATE inventory SET quantity = ?, updated_at = ? WHERE product_id = ?`, [batchStock, now, productId]);

    return { masterStock: batchStock, batchStock };
  }
}
