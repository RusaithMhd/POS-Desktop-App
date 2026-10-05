import { getRawSqlDb, saveLocalDbState } from '../database/sqlite/db';
import { ProductEntity, CategoryEntity, UnitEntity } from '@/domain/entities/Product';
import { SaleEntity, CreateSaleInput } from '@/domain/entities/Sale';
import { InventoryMovementEntity } from '@/domain/entities/InventoryMovement';
import { CashierShiftEntity, CashMovementEntity } from '@/domain/entities/CashierShift';
import { AccountingService } from '@/services/accounting/AccountingService';
import {
  IProductRepository,
  ISaleRepository,
  IInventoryRepository,
  IShiftRepository,
  ISyncQueueRepository,
} from '@/application/interfaces/IRepositories';

// ----------------------------------------------------------------------
// 1. PRODUCT REPOSITORY
// ----------------------------------------------------------------------

export class SQLiteProductRepository implements IProductRepository {
  async getAll(): Promise<ProductEntity[]> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT * FROM products ORDER BY name ASC');
    const products: ProductEntity[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      products.push(mapProductRow(row));
    }
    stmt.free();
    return products;
  }

  async getById(id: string): Promise<ProductEntity | null> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT * FROM products WHERE id = :id');
    stmt.bind({ ':id': id });
    let result: ProductEntity | null = null;
    if (stmt.step()) {
      result = mapProductRow(stmt.getAsObject());
    }
    stmt.free();
    return result;
  }

  async getBySkuOrBarcode(query: string): Promise<ProductEntity | null> {
    const db = getRawSqlDb();
    const q = query.trim();
    const stmt = db.prepare('SELECT * FROM products WHERE sku = :q OR barcode = :q LIMIT 1');
    stmt.bind({ ':q': q });
    let result: ProductEntity | null = null;
    if (stmt.step()) {
      result = mapProductRow(stmt.getAsObject());
    }
    stmt.free();

    if (!result) {
      // Check secondary barcode table
      const bcStmt = db.prepare('SELECT product_id FROM product_barcodes WHERE barcode = :q LIMIT 1');
      bcStmt.bind({ ':q': q });
      if (bcStmt.step()) {
        const prodId = bcStmt.getAsObject().product_id as string;
        bcStmt.free();
        return this.getById(prodId);
      }
      bcStmt.free();
    }

    return result;
  }

  async search(query: string, categoryId?: string): Promise<ProductEntity[]> {
    const db = getRawSqlDb();
    const q = `%${query.trim()}%`;
    let sql = 'SELECT * FROM products WHERE (name LIKE :q OR sku LIKE :q OR barcode LIKE :q)';
    const params: Record<string, any> = { ':q': q };

    if (categoryId) {
      sql += ' AND category_id = :catId';
      params[':catId'] = categoryId;
    }
    sql += ' ORDER BY name ASC LIMIT 50';

    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results: ProductEntity[] = [];
    while (stmt.step()) {
      results.push(mapProductRow(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  async save(product: Partial<ProductEntity>): Promise<ProductEntity> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const id = product.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const existing = product.id ? await this.getById(product.id) : null;

    if (existing) {
      db.run(
        `UPDATE products SET 
          category_id = ?, unit_id = ?, name = ?, sku = ?, barcode = ?, brand = ?, description = ?,
          cost_price = ?, selling_price = ?, wholesale_price = ?, tax_rate = ?, stock_quantity = ?,
          min_stock_level = ?, reorder_level = ?, track_inventory = ?, is_active = ?, updated_at = ?
         WHERE id = ?`,
        [
          product.categoryId || null,
          product.unitId || null,
          product.name ?? '',
          product.sku ?? '',
          product.barcode || null,
          product.brand || null,
          product.description || null,
          product.costPrice ?? 0,
          product.sellingPrice ?? 0,
          product.wholesalePrice || null,
          product.taxRate ?? 0,
          product.stockQuantity ?? 0,
          product.minStockLevel ?? 5,
          product.reorderLevel ?? 10,
          product.trackInventory ? 1 : 0,
          product.isActive !== false ? 1 : 0,
          now,
          id,
        ]
      );
    } else {
      db.run(
        `INSERT INTO products (id, business_id, category_id, unit_id, name, sku, barcode, brand, description, cost_price, selling_price, wholesale_price, tax_rate, stock_quantity, min_stock_level, reorder_level, track_inventory, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          product.businessId || 'biz-001',
          product.categoryId || null,
          product.unitId || null,
          product.name ?? '',
          product.sku ?? '',
          product.barcode || null,
          product.brand || null,
          product.description || null,
          product.costPrice ?? 0,
          product.sellingPrice ?? 0,
          product.wholesalePrice || null,
          product.taxRate ?? 0,
          product.stockQuantity ?? 0,
          product.minStockLevel ?? 5,
          product.reorderLevel ?? 10,
          product.trackInventory ? 1 : 0,
          product.isActive !== false ? 1 : 0,
          now,
          now,
        ]
      );

      if (product.barcode) {
        db.run(
          `INSERT INTO product_barcodes (id, product_id, barcode, is_primary) VALUES (?, ?, ?, 1)`,
          [`bc-${id}`, id, product.barcode]
        );
      }
    }

    saveLocalDbState();
    return (await this.getById(id))!;
  }

  async delete(id: string): Promise<void> {
    const db = getRawSqlDb();
    db.run('DELETE FROM products WHERE id = ?', [id]);
    db.run('DELETE FROM product_barcodes WHERE product_id = ?', [id]);
    saveLocalDbState();
  }

  async updateStock(productId: string, deltaQuantity: number): Promise<void> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    db.run(
      'UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?',
      [deltaQuantity, now, productId]
    );
    db.run(
      'UPDATE inventory SET quantity = quantity + ?, updated_at = ? WHERE product_id = ?',
      [deltaQuantity, now, productId]
    );
    saveLocalDbState();
  }

  async getCategories(): Promise<CategoryEntity[]> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY name ASC');
    const res: CategoryEntity[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      res.push({
        id: row.id as string,
        businessId: row.business_id as string,
        name: row.name as string,
        code: row.code as string,
        description: row.description as string,
        isActive: Boolean(row.is_active),
      });
    }
    stmt.free();
    return res;
  }

  async saveCategory(category: Partial<CategoryEntity>): Promise<CategoryEntity> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const id = category.id || `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const businessId = category.businessId || 'biz-001';

    const checkStmt = db.prepare('SELECT id FROM categories WHERE id = :id LIMIT 1');
    checkStmt.bind({ ':id': id });
    const exists = checkStmt.step();
    checkStmt.free();

    if (exists) {
      db.run(
        `UPDATE categories SET name = ?, code = ?, description = ?, is_active = ?, updated_at = ? WHERE id = ?`,
        [
          category.name || '',
          category.code || null,
          category.description || null,
          category.isActive !== undefined ? (category.isActive ? 1 : 0) : 1,
          now,
          id,
        ]
      );
    } else {
      db.run(
        `INSERT INTO categories (id, business_id, name, code, description, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          businessId,
          category.name || '',
          category.code || null,
          category.description || null,
          category.isActive !== undefined ? (category.isActive ? 1 : 0) : 1,
          now,
          now,
        ]
      );
    }

    saveLocalDbState();
    const all = await this.getCategories();
    return all.find((c) => c.id === id) || {
      id,
      businessId,
      name: category.name || '',
      code: category.code || '',
      description: category.description || '',
      isActive: true,
    };
  }

  async deleteCategory(id: string): Promise<void> {
    const db = getRawSqlDb();
    db.run('UPDATE categories SET is_active = 0 WHERE id = ?', [id]);
    saveLocalDbState();
  }

  async getUnits(): Promise<UnitEntity[]> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT * FROM units ORDER BY name ASC');
    const res: UnitEntity[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      res.push({
        id: row.id as string,
        name: row.name as string,
        shortName: row.short_name as string,
      });
    }
    stmt.free();
    return res;
  }
}

// ----------------------------------------------------------------------
// 2. SALE REPOSITORY WITH ATOMIC ACID TRANSACTIONS
// ----------------------------------------------------------------------

export class SQLiteSaleRepository implements ISaleRepository {
  async createSaleTransaction(input: CreateSaleInput): Promise<SaleEntity> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();

    // 1. Idempotency Check: Verify if clientTransactionId already exists
    const checkStmt = db.prepare('SELECT id FROM sales WHERE client_transaction_id = :txId LIMIT 1');
    checkStmt.bind({ ':txId': input.clientTransactionId });
    if (checkStmt.step()) {
      const existingId = checkStmt.getAsObject().id as string;
      checkStmt.free();
      return (await this.getById(existingId))!;
    }
    checkStmt.free();

    // Load tax configuration settings
    let isTaxInclusive = false;
    let defaultTaxRate = 0.0;
    const taxSetStmt = db.prepare('SELECT key, value FROM settings WHERE key IN ("is_tax_inclusive", "default_tax_rate")');
    while (taxSetStmt.step()) {
      const row = taxSetStmt.getAsObject();
      let val = row.value as string;
      try { val = JSON.parse(val); } catch {}
      if (row.key === 'is_tax_inclusive') isTaxInclusive = Boolean(val);
      if (row.key === 'default_tax_rate') {
        const parsed = parseFloat(String(val));
        defaultTaxRate = isNaN(parsed) ? 0.0 : parsed;
      }
    }
    taxSetStmt.free();

    const saleId = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Calculate Financial Totals
    let subtotal = 0;
    let totalDiscount = input.overallDiscountAmount || 0;
    let totalTax = 0;

    const itemsToInsert = input.items.map((item) => {
      const lineSubtotal = item.unitPrice * item.quantity;
      const lineDiscount = item.discountAmount || 0;
      const netLine = Math.max(0, lineSubtotal - lineDiscount);
      const taxRate = item.taxRate !== undefined && item.taxRate !== null ? item.taxRate : defaultTaxRate;

      let lineTax = 0;
      let lineTotal = 0;
      if (isTaxInclusive) {
        lineTax = netLine - (netLine / (1 + taxRate / 100));
        lineTotal = netLine;
      } else {
        lineTax = netLine * (taxRate / 100);
        lineTotal = netLine + lineTax;
      }

      subtotal += lineSubtotal;
      totalDiscount += lineDiscount;
      totalTax += lineTax;

      return {
        id: `sitem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        saleId,
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        quantity: item.quantity,
        discountAmount: lineDiscount,
        taxAmount: lineTax,
        totalAmount: lineTotal,
      };
    });

    const netSubtotal = Math.max(0, subtotal - totalDiscount);
    const grandTotal = isTaxInclusive ? netSubtotal : netSubtotal + totalTax;
    const paidAmount = input.payments.reduce((acc, p) => acc + p.amount, 0);
    const changeAmount = Math.max(0, paidAmount - grandTotal);

    // ==========================================
    // EXECUTE ATOMIC SQLITE TRANSACTION
    // ==========================================
    db.run('BEGIN TRANSACTION;');
    try {
      // 1. Insert Sales Header
      db.run(
        `INSERT INTO sales (id, client_transaction_id, business_id, branch_id, terminal_id, user_id, customer_id, shift_id, invoice_number, subtotal, discount_amount, tax_amount, total_amount, paid_amount, change_amount, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)`,
        [
          saleId,
          input.clientTransactionId,
          input.businessId,
          input.branchId,
          input.terminalId,
          input.userId,
          input.customerId || null,
          input.shiftId,
          invoiceNumber,
          subtotal,
          totalDiscount,
          totalTax,
          grandTotal,
          paidAmount,
          changeAmount,
          input.notes || null,
          now,
          now,
        ]
      );

      // 2. Insert Sale Items, Reduce Stock, & Log Traceable Ledger Movements
      for (const item of itemsToInsert) {
        db.run(
          `INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_price, cost_price, quantity, discount_amount, tax_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.saleId,
            item.productId,
            item.productName,
            item.unitPrice,
            item.costPrice,
            item.quantity,
            item.discountAmount,
            item.taxAmount,
            item.totalAmount,
          ]
        );

        // Fetch current stock for movement log
        const pStmt = db.prepare('SELECT stock_quantity FROM products WHERE id = :id');
        pStmt.bind({ ':id': item.productId });
        let currentStock = 0;
        if (pStmt.step()) {
          currentStock = (pStmt.getAsObject().stock_quantity as number) || 0;
        }
        pStmt.free();

        const newStock = currentStock - item.quantity;

        // Reduce Product & Inventory table stock
        db.run('UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?', [newStock, now, item.productId]);
        db.run('UPDATE inventory SET quantity = ?, updated_at = ? WHERE product_id = ?', [newStock, now, item.productId]);

        // Insert Traceable Inventory Movement Ledger
        db.run(
          `INSERT INTO inventory_movements (id, branch_id, product_id, movement_type, reference_type, reference_id, quantity_change, previous_quantity, new_quantity, user_id, reason, created_at)
           VALUES (?, ?, ?, 'SALE', 'sale', ?, ?, ?, ?, ?, 'Completed POS Checkout', ?)`,
          [
            `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            input.branchId,
            item.productId,
            saleId,
            -item.quantity,
            currentStock,
            newStock,
            input.userId,
            now,
          ]
        );
      }

      // 3. Insert Payments
      for (const pay of input.payments) {
        db.run(
          `INSERT INTO sale_payments (id, sale_id, payment_method_id, method_code, amount, reference_number, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            `spay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            saleId,
            pay.paymentMethodId,
            pay.methodCode,
            pay.amount,
            pay.referenceNumber || null,
            now,
          ]
        );
      }

      // 4. Update Customer Credit Balance if sale paid via CREDIT / STORE_CREDIT
      if (input.customerId) {
        let creditPaid = 0;
        for (const pay of input.payments) {
          const code = (pay.methodCode || '').toUpperCase();
          if (code === 'CREDIT' || code === 'STORE_CREDIT') {
            creditPaid += pay.amount;
          }
        }
        if (creditPaid > 0) {
          db.run(
            `UPDATE customers SET current_credit = current_credit + ?, updated_at = ? WHERE id = ?`,
            [creditPaid, now, input.customerId]
          );
        }
      }

      // 5. Update Cashier Shift Running Totals
      db.run(
        `UPDATE cashier_shifts SET total_sales = total_sales + ? WHERE id = ?`,
        [grandTotal, input.shiftId]
      );

      // 6. Add Audit Log
      db.run(
        `INSERT INTO audit_logs (id, business_id, branch_id, terminal_id, user_id, action, entity_type, entity_id, new_values, created_at)
         VALUES (?, ?, ?, ?, ?, 'SALE_CREATED', 'sale', ?, ?, ?)`,
        [
          `audit-${Date.now()}`,
          input.businessId,
          input.branchId,
          input.terminalId,
          input.userId,
          saleId,
          JSON.stringify({ invoiceNumber, grandTotal, paidAmount }),
          now,
        ]
      );

      // 7. Post Automatic Double-Entry Accounting Entry
      AccountingService.recordSale(db, {
        saleId,
        invoiceNumber,
        userId: input.userId,
        subtotal,
        discountAmount: totalDiscount,
        taxAmount: totalTax,
        totalAmount: grandTotal,
        paidAmount,
        customerId: input.customerId || undefined,
        payments: input.payments,
        items: itemsToInsert.map((item) => ({
          productId: item.productId,
          costPrice: item.costPrice,
          quantity: item.quantity,
        })),
      });

      // 8. Enqueue into Offline Sync Engine Queue
      db.run(
        `INSERT INTO sync_queue (id, client_transaction_id, entity_type, entity_id, operation, payload, attempt_count, status, created_at)
         VALUES (?, ?, 'sale', ?, 'CREATE', ?, 0, 'PENDING', ?)`,
        [
          `sq-${Date.now()}`,
          input.clientTransactionId,
          saleId,
          JSON.stringify({ saleId, invoiceNumber, grandTotal, items: itemsToInsert }),
          now,
        ]
      );

      db.run('COMMIT;');
      saveLocalDbState();

      return (await this.getById(saleId))!;
    } catch (error) {
      db.run('ROLLBACK;');
      console.error('Sale Transaction Aborted & Rolled back:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<SaleEntity | null> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT * FROM sales WHERE id = :id LIMIT 1');
    stmt.bind({ ':id': id });
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const saleRow = stmt.getAsObject();
    stmt.free();

    // Fetch customer name if customer_id is attached
    let customerName: string | undefined = undefined;
    if (saleRow.customer_id) {
      const custStmt = db.prepare('SELECT name FROM customers WHERE id = :cId LIMIT 1');
      custStmt.bind({ ':cId': saleRow.customer_id as string });
      if (custStmt.step()) {
        customerName = custStmt.getAsObject().name as string;
      }
      custStmt.free();
    }

    // Fetch items
    const itemsStmt = db.prepare('SELECT * FROM sale_items WHERE sale_id = :saleId');
    itemsStmt.bind({ ':saleId': id });
    const items: any[] = [];
    while (itemsStmt.step()) {
      const r = itemsStmt.getAsObject();
      items.push({
        id: r.id,
        saleId: r.sale_id,
        productId: r.product_id,
        variantId: r.variant_id,
        productName: r.product_name,
        unitPrice: r.unit_price,
        costPrice: r.cost_price,
        quantity: r.quantity,
        discountAmount: r.discount_amount,
        taxAmount: r.tax_amount,
        totalAmount: r.total_amount,
      });
    }
    itemsStmt.free();

    // Fetch payments
    const payStmt = db.prepare('SELECT * FROM sale_payments WHERE sale_id = :saleId');
    payStmt.bind({ ':saleId': id });
    const payments: any[] = [];
    while (payStmt.step()) {
      const r = payStmt.getAsObject();
      payments.push({
        id: r.id,
        saleId: r.sale_id,
        paymentMethodId: r.payment_method_id,
        methodCode: r.method_code,
        amount: r.amount,
        referenceNumber: r.reference_number,
        createdAt: r.created_at,
      });
    }
    payStmt.free();

    return {
      id: saleRow.id as string,
      clientTransactionId: saleRow.client_transaction_id as string,
      businessId: saleRow.business_id as string,
      branchId: saleRow.branch_id as string,
      terminalId: saleRow.terminal_id as string,
      userId: saleRow.user_id as string,
      customerId: saleRow.customer_id as string,
      customerName: customerName || undefined,
      shiftId: saleRow.shift_id as string,
      invoiceNumber: saleRow.invoice_number as string,
      subtotal: saleRow.subtotal as number,
      discountAmount: saleRow.discount_amount as number,
      taxAmount: saleRow.tax_amount as number,
      totalAmount: saleRow.total_amount as number,
      paidAmount: saleRow.paid_amount as number,
      changeAmount: saleRow.change_amount as number,
      status: saleRow.status as any,
      notes: saleRow.notes as string,
      createdAt: saleRow.created_at as string,
      updatedAt: saleRow.updated_at as string,
      items,
      payments,
    };
  }

  async getByInvoiceNumber(invoiceNumber: string): Promise<SaleEntity | null> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT id FROM sales WHERE invoice_number = :inv LIMIT 1');
    stmt.bind({ ':inv': invoiceNumber });
    if (stmt.step()) {
      const id = stmt.getAsObject().id as string;
      stmt.free();
      return this.getById(id);
    }
    stmt.free();
    return null;
  }

  async getByClientTransactionId(clientTxId: string): Promise<SaleEntity | null> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT id FROM sales WHERE client_transaction_id = :tx LIMIT 1');
    stmt.bind({ ':tx': clientTxId });
    if (stmt.step()) {
      const id = stmt.getAsObject().id as string;
      stmt.free();
      return this.getById(id);
    }
    stmt.free();
    return null;
  }

  async getRecentSales(limit: number = 50): Promise<SaleEntity[]> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT id FROM sales ORDER BY created_at DESC LIMIT :lim');
    stmt.bind({ ':lim': limit });
    const ids: string[] = [];
    while (stmt.step()) {
      ids.push(stmt.getAsObject().id as string);
    }
    stmt.free();

    const salesList: SaleEntity[] = [];
    for (const id of ids) {
      const sale = await this.getById(id);
      if (sale) salesList.push(sale);
    }
    return salesList;
  }

  async getSalesByShift(shiftId: string): Promise<SaleEntity[]> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT id FROM sales WHERE shift_id = :shiftId ORDER BY created_at DESC');
    stmt.bind({ ':shiftId': shiftId });
    const ids: string[] = [];
    while (stmt.step()) {
      ids.push(stmt.getAsObject().id as string);
    }
    stmt.free();

    const salesList: SaleEntity[] = [];
    for (const id of ids) {
      const sale = await this.getById(id);
      if (sale) salesList.push(sale);
    }
    return salesList;
  }

  async deleteSale(saleId: string, deletedByUserId: string, deleteReason: string): Promise<boolean> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const sale = await this.getById(saleId);
    if (!sale) return false;

    db.run('BEGIN TRANSACTION;');
    try {
      db.run(
        `UPDATE sales SET status = 'DELETED', deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ? WHERE id = ?`,
        [now, deletedByUserId, deleteReason, now, saleId]
      );

      db.run(
        `INSERT INTO audit_logs (id, business_id, branch_id, terminal_id, user_id, action, entity_type, entity_id, old_values, new_values, created_at)
         VALUES (?, ?, ?, ?, ?, 'SALE_DELETED', 'sale', ?, ?, ?, ?)`,
        [
          `audit-del-${Date.now()}`,
          sale.businessId || 'biz-001',
          sale.branchId || 'branch-001',
          sale.terminalId || 'term-001',
          deletedByUserId,
          saleId,
          JSON.stringify({ invoiceNumber: sale.invoiceNumber, totalAmount: sale.totalAmount, status: sale.status }),
          JSON.stringify({ deletedBy: deletedByUserId, reason: deleteReason }),
          now,
        ]
      );

      db.run(
        `INSERT INTO sync_queue (id, client_transaction_id, entity_type, entity_id, operation, payload, attempt_count, status, created_at)
         VALUES (?, ?, 'sale', ?, 'DELETE', ?, 0, 'PENDING', ?)`,
        [
          `sq-del-${Date.now()}`,
          sale.clientTransactionId,
          saleId,
          JSON.stringify({ saleId, invoiceNumber: sale.invoiceNumber, deletedBy: deletedByUserId, reason: deleteReason }),
          now,
        ]
      );

      db.run('COMMIT;');
      saveLocalDbState();
      return true;
    } catch (err) {
      db.run('ROLLBACK;');
      console.error('[SQLiteSaleRepository] Delete Sale Error:', err);
      return false;
    }
  }

  async refundSale(saleId: string, userId: string, refundReason: string): Promise<boolean> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const sale = await this.getById(saleId);
    if (!sale) return false;

    db.run('BEGIN TRANSACTION;');
    try {
      db.run(`UPDATE sales SET status = 'REFUNDED', updated_at = ? WHERE id = ?`, [now, saleId]);

      // Post Reversal / Sales Return Accounting Journal
      AccountingService.recordSalesReturn(db, {
        returnId: `ret-${Date.now()}`,
        returnNumber: `RET-${Date.now().toString().slice(-6)}`,
        saleId: sale.id,
        userId,
        totalRefundAmount: sale.totalAmount,
        paymentMethod: sale.payments?.[0]?.methodCode || 'CASH',
        items: (sale.items || []).map((i) => ({
          productId: i.productId,
          costPrice: i.costPrice || 0,
          quantity: i.quantity || 0,
        })),
      });

      db.run(
        `INSERT INTO audit_logs (id, business_id, branch_id, terminal_id, user_id, action, entity_type, entity_id, old_values, new_values, created_at)
         VALUES (?, ?, ?, ?, ?, 'SALE_REFUNDED', 'sale', ?, ?, ?, ?)`,
        [
          `audit-ref-${Date.now()}`,
          sale.businessId || 'biz-001',
          sale.branchId || 'branch-001',
          sale.terminalId || 'term-001',
          userId,
          saleId,
          JSON.stringify({ invoiceNumber: sale.invoiceNumber, status: sale.status }),
          JSON.stringify({ refundedBy: userId, reason: refundReason, refundAmount: sale.totalAmount }),
          now,
        ]
      );

      db.run('COMMIT;');
      saveLocalDbState();
      return true;
    } catch (err) {
      db.run('ROLLBACK;');
      console.error('[SQLiteSaleRepository] Refund Sale Error:', err);
      return false;
    }
  }

  async voidSale(saleId: string, userId: string, voidReason: string): Promise<boolean> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const sale = await this.getById(saleId);
    if (!sale) return false;

    db.run('BEGIN TRANSACTION;');
    try {
      db.run(`UPDATE sales SET status = 'VOIDED', updated_at = ? WHERE id = ?`, [now, saleId]);

      db.run(
        `INSERT INTO audit_logs (id, business_id, branch_id, terminal_id, user_id, action, entity_type, entity_id, old_values, new_values, created_at)
         VALUES (?, ?, ?, ?, ?, 'SALE_VOIDED', 'sale', ?, ?, ?, ?)`,
        [
          `audit-void-${Date.now()}`,
          sale.businessId || 'biz-001',
          sale.branchId || 'branch-001',
          sale.terminalId || 'term-001',
          userId,
          saleId,
          JSON.stringify({ invoiceNumber: sale.invoiceNumber, status: sale.status }),
          JSON.stringify({ voidedBy: userId, reason: voidReason }),
          now,
        ]
      );

      db.run('COMMIT;');
      saveLocalDbState();
      return true;
    } catch (err) {
      db.run('ROLLBACK;');
      console.error('[SQLiteSaleRepository] Void Sale Error:', err);
      return false;
    }
  }

  async getSaleAuditTrail(saleId: string): Promise<any[]> {
    const db = getRawSqlDb();
    const stmt = db.prepare(
      'SELECT a.*, u.full_name as user_name, u.username FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id WHERE a.entity_id = :id ORDER BY a.created_at ASC'
    );
    stmt.bind({ ':id': saleId });
    const res: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      let oldVals = null;
      let newVals = null;
      try { oldVals = JSON.parse(row.old_values as string); } catch {}
      try { newVals = JSON.parse(row.new_values as string); } catch {}
      res.push({
        id: row.id,
        action: row.action,
        userId: row.user_id,
        userName: row.user_name || row.username || 'System User',
        createdAt: row.created_at,
        oldValues: oldVals,
        newValues: newVals,
      });
    }
    stmt.free();
    return res;
  }
}

// ----------------------------------------------------------------------
// 3. INVENTORY REPOSITORY
// ----------------------------------------------------------------------

export class SQLiteInventoryRepository implements IInventoryRepository {
  async recordMovement(movement: Omit<InventoryMovementEntity, 'id' | 'createdAt'>): Promise<InventoryMovementEntity> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const id = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    db.run(
      `INSERT INTO inventory_movements (id, branch_id, product_id, variant_id, movement_type, reference_type, reference_id, quantity_change, previous_quantity, new_quantity, user_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        movement.branchId,
        movement.productId,
        movement.variantId || null,
        movement.movementType,
        movement.referenceType || null,
        movement.referenceId || null,
        movement.quantityChange,
        movement.previousQuantity,
        movement.newQuantity,
        movement.userId,
        movement.reason || null,
        now,
      ]
    );

    saveLocalDbState();
    return {
      id,
      ...movement,
      createdAt: now,
    };
  }

  async getMovementsByProduct(productId: string): Promise<InventoryMovementEntity[]> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT * FROM inventory_movements WHERE product_id = :pId ORDER BY created_at DESC');
    stmt.bind({ ':pId': productId });
    const res: InventoryMovementEntity[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      res.push(mapMovementRow(r));
    }
    stmt.free();
    return res;
  }

  async getRecentMovements(limit: number = 50): Promise<InventoryMovementEntity[]> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT * FROM inventory_movements ORDER BY created_at DESC LIMIT :lim');
    stmt.bind({ ':lim': limit });
    const res: InventoryMovementEntity[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      res.push(mapMovementRow(r));
    }
    stmt.free();
    return res;
  }
}

// ----------------------------------------------------------------------
// 4. SHIFT REPOSITORY
// ----------------------------------------------------------------------

export class SQLiteShiftRepository implements IShiftRepository {
  async getActiveShift(terminalId: string): Promise<CashierShiftEntity | null> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT * FROM cashier_shifts WHERE terminal_id = :tId AND status = "OPEN" LIMIT 1');
    stmt.bind({ ':tId': terminalId });
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const r = stmt.getAsObject();
    stmt.free();
    return mapShiftRow(r);
  }

  async openShift(terminalId: string, userId: string, openingCash: number): Promise<CashierShiftEntity> {
    const existing = await this.getActiveShift(terminalId);
    if (existing) return existing;

    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const id = `shift-${Date.now()}`;

    db.run(
      `INSERT INTO cashier_shifts (id, terminal_id, user_id, opened_at, opening_cash, total_sales, total_refunds, total_cash_in, total_cash_out, status)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 'OPEN')`,
      [id, terminalId, userId, now, openingCash]
    );

    saveLocalDbState();
    return (await this.getActiveShift(terminalId))!;
  }

  async closeShift(shiftId: string, closingCashActual: number, notes?: string): Promise<CashierShiftEntity> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();

    const stmt = db.prepare('SELECT * FROM cashier_shifts WHERE id = :id LIMIT 1');
    stmt.bind({ ':id': shiftId });
    if (!stmt.step()) {
      stmt.free();
      throw new Error('Shift not found.');
    }
    const shift = stmt.getAsObject();
    stmt.free();

    const openingCash = (shift.opening_cash as number) || 0;
    const totalSales = (shift.total_sales as number) || 0;
    const totalCashIn = (shift.total_cash_in as number) || 0;
    const totalCashOut = (shift.total_cash_out as number) || 0;

    const closingCashExpected = openingCash + totalSales + totalCashIn - totalCashOut;
    const cashDifference = closingCashActual - closingCashExpected;

    db.run(
      `UPDATE cashier_shifts SET
        closed_at = ?, closing_cash_expected = ?, closing_cash_actual = ?, cash_difference = ?, status = 'CLOSED', notes = ?
       WHERE id = ?`,
      [now, closingCashExpected, closingCashActual, cashDifference, notes || null, shiftId]
    );

    saveLocalDbState();
    const resStmt = db.prepare('SELECT * FROM cashier_shifts WHERE id = :id');
    resStmt.bind({ ':id': shiftId });
    resStmt.step();
    const updated = resStmt.getAsObject();
    resStmt.free();
    return mapShiftRow(updated);
  }

  async recordCashMovement(movement: Omit<CashMovementEntity, 'id' | 'createdAt'>): Promise<CashMovementEntity> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const id = `cmov-${Date.now()}`;

    db.run(
      `INSERT INTO cash_movements (id, shift_id, user_id, type, amount, reason, reference, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, movement.shiftId, movement.userId, movement.type, movement.amount, movement.reason, movement.reference || null, now]
    );

    if (movement.type === 'CASH_IN') {
      db.run('UPDATE cashier_shifts SET total_cash_in = total_cash_in + ? WHERE id = ?', [movement.amount, movement.shiftId]);
    } else if (movement.type === 'CASH_OUT' || movement.type === 'EXPENSE') {
      db.run('UPDATE cashier_shifts SET total_cash_out = total_cash_out + ? WHERE id = ?', [movement.amount, movement.shiftId]);
    }

    saveLocalDbState();
    return { id, ...movement, createdAt: now };
  }

  async getShiftMovements(shiftId: string): Promise<CashMovementEntity[]> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT * FROM cash_movements WHERE shift_id = :id ORDER BY created_at DESC');
    stmt.bind({ ':id': shiftId });
    const res: CashMovementEntity[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      res.push({
        id: r.id as string,
        shiftId: r.shift_id as string,
        userId: r.user_id as string,
        type: r.type as any,
        amount: r.amount as number,
        reason: r.reason as string,
        reference: r.reference as string,
        createdAt: r.created_at as string,
      });
    }
    stmt.free();
    return res;
  }
}

// ----------------------------------------------------------------------
// 5. SYNC QUEUE REPOSITORY
// ----------------------------------------------------------------------

export class SQLiteSyncQueueRepository implements ISyncQueueRepository {
  async enqueue(item: { clientTransactionId: string; entityType: string; entityId: string; operation: 'CREATE' | 'UPDATE' | 'DELETE'; payload: any }): Promise<void> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    const id = `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    db.run(
      `INSERT INTO sync_queue (id, client_transaction_id, entity_type, entity_id, operation, payload, attempt_count, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'PENDING', ?)`,
      [id, item.clientTransactionId, item.entityType, item.entityId, item.operation, JSON.stringify(item.payload), now]
    );
    saveLocalDbState();
  }

  async getPending(): Promise<any[]> {
    const db = getRawSqlDb();
    const stmt = db.prepare('SELECT * FROM sync_queue WHERE status IN ("PENDING", "FAILED") ORDER BY created_at ASC LIMIT 50');
    const res: any[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      res.push({
        id: r.id,
        clientTransactionId: r.client_transaction_id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        operation: r.operation,
        payload: JSON.parse(r.payload as string),
        attemptCount: r.attempt_count,
        status: r.status,
        createdAt: r.created_at,
      });
    }
    stmt.free();
    return res;
  }

  async markSynced(id: string): Promise<void> {
    const db = getRawSqlDb();
    db.run('UPDATE sync_queue SET status = "SYNCED" WHERE id = ?', [id]);
    saveLocalDbState();
  }

  async markFailed(id: string, error: string): Promise<void> {
    const db = getRawSqlDb();
    const now = new Date().toISOString();
    db.run(
      'UPDATE sync_queue SET status = "FAILED", attempt_count = attempt_count + 1, last_attempt_at = ?, error_message = ? WHERE id = ?',
      [now, error, id]
    );
    saveLocalDbState();
  }
}

// Map Helper functions
function mapProductRow(row: any): ProductEntity {
  return {
    id: row.id,
    businessId: row.business_id,
    categoryId: row.category_id,
    unitId: row.unit_id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    brand: row.brand,
    description: row.description,
    costPrice: row.cost_price,
    sellingPrice: row.selling_price,
    wholesalePrice: row.wholesale_price,
    taxRate: row.tax_rate,
    stockQuantity: row.stock_quantity,
    minStockLevel: row.min_stock_level,
    reorderLevel: row.reorder_level,
    trackInventory: Boolean(row.track_inventory),
    trackExpiry: Boolean(row.track_expiry),
    isActive: Boolean(row.is_active),
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMovementRow(r: any): InventoryMovementEntity {
  return {
    id: r.id,
    branchId: r.branch_id,
    productId: r.product_id,
    variantId: r.variant_id,
    movementType: r.movement_type,
    referenceType: r.reference_type,
    referenceId: r.reference_id,
    quantityChange: r.quantity_change,
    previousQuantity: r.previous_quantity,
    newQuantity: r.new_quantity,
    userId: r.user_id,
    reason: r.reason,
    createdAt: r.created_at,
  };
}

function mapShiftRow(r: any): CashierShiftEntity {
  return {
    id: r.id,
    terminalId: r.terminal_id,
    userId: r.user_id,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    openingCash: r.opening_cash,
    closingCashExpected: r.closing_cash_expected,
    closingCashActual: r.closing_cash_actual,
    cashDifference: r.cash_difference,
    totalSales: r.total_sales,
    totalRefunds: r.total_refunds,
    totalCashIn: r.total_cash_in,
    totalCashOut: r.total_cash_out,
    status: r.status,
    notes: r.notes,
  };
}
