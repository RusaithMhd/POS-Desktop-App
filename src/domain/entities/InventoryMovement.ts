export type InventoryMovementType = 
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'TRANSFER'
  | 'OPENING_STOCK';

export interface InventoryMovementEntity {
  id: string;
  branchId: string;
  productId: string;
  variantId?: string | null;
  movementType: InventoryMovementType;
  referenceType?: string | null;
  referenceId?: string | null;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  userId: string;
  reason?: string | null;
  createdAt: string;
}
