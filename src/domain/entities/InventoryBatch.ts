export interface InventoryBatchEntity {
  id: string;
  productId: string;
  productName?: string;
  sku?: string;
  productSku?: string;
  supplierId?: string | null;
  supplierName?: string;
  purchaseId?: string | null;
  purchaseItemId?: string | null;
  batchNumber: string;
  supplierBatchNumber?: string | null;
  unitCost: number;
  quantityReceived: number;
  quantityRemaining: number;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  receivedDate: string;
  warehouseId?: string | null;
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'BLOCKED' | 'RETURNED';
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBatchTransactionEntity {
  id: string;
  batchId: string;
  transactionType: 'PURCHASE' | 'SALE' | 'SALES_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRED' | 'TRANSFER';
  referenceType?: string | null;
  referenceId?: string | null;
  quantityIn: number;
  quantityOut: number;
  unitCost: number;
  balanceQuantity: number;
  createdBy?: string | null;
  createdAt: string;
}

export interface SaleItemBatchAllocationEntity {
  id: string;
  saleItemId: string;
  batchId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}
