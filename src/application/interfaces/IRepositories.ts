import { ProductEntity, CategoryEntity, UnitEntity } from '@/domain/entities/Product';
import { SaleEntity, CreateSaleInput } from '@/domain/entities/Sale';
import { InventoryMovementEntity } from '@/domain/entities/InventoryMovement';
import { CashierShiftEntity, CashMovementEntity } from '@/domain/entities/CashierShift';

export interface IProductRepository {
  getAll(): Promise<ProductEntity[]>;
  getById(id: string): Promise<ProductEntity | null>;
  getBySkuOrBarcode(query: string): Promise<ProductEntity | null>;
  search(query: string, categoryId?: string): Promise<ProductEntity[]>;
  save(product: Partial<ProductEntity>): Promise<ProductEntity>;
  delete(id: string): Promise<void>;
  updateStock(productId: string, deltaQuantity: number): Promise<void>;
  getCategories(): Promise<CategoryEntity[]>;
  saveCategory(category: Partial<CategoryEntity>): Promise<CategoryEntity>;
  deleteCategory(id: string): Promise<void>;
  getUnits(): Promise<UnitEntity[]>;
}

export interface ISaleRepository {
  createSaleTransaction(input: CreateSaleInput): Promise<SaleEntity>;
  getById(id: string): Promise<SaleEntity | null>;
  getByInvoiceNumber(invoiceNumber: string): Promise<SaleEntity | null>;
  getByClientTransactionId(clientTxId: string): Promise<SaleEntity | null>;
  getRecentSales(limit?: number): Promise<SaleEntity[]>;
  getSalesByShift(shiftId: string): Promise<SaleEntity[]>;
}

export interface IInventoryRepository {
  recordMovement(movement: Omit<InventoryMovementEntity, 'id' | 'createdAt'>): Promise<InventoryMovementEntity>;
  getMovementsByProduct(productId: string): Promise<InventoryMovementEntity[]>;
  getRecentMovements(limit?: number): Promise<InventoryMovementEntity[]>;
}

export interface IShiftRepository {
  getActiveShift(terminalId: string): Promise<CashierShiftEntity | null>;
  openShift(terminalId: string, userId: string, openingCash: number): Promise<CashierShiftEntity>;
  closeShift(shiftId: string, closingCashActual: number, notes?: string): Promise<CashierShiftEntity>;
  recordCashMovement(movement: Omit<CashMovementEntity, 'id' | 'createdAt'>): Promise<CashMovementEntity>;
  getShiftMovements(shiftId: string): Promise<CashMovementEntity[]>;
}

export interface ISyncQueueRepository {
  enqueue(item: {
    clientTransactionId: string;
    entityType: string;
    entityId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    payload: any;
  }): Promise<void>;
  getPending(): Promise<any[]>;
  markSynced(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}
