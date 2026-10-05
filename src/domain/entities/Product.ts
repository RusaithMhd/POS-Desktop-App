export interface ProductEntity {
  id: string;
  businessId: string;
  categoryId?: string | null;
  unitId?: string | null;
  name: string;
  sku: string;
  barcode?: string | null;
  brand?: string | null;
  description?: string | null;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number | null;
  taxRate: number;
  stockQuantity: number;
  minStockLevel: number;
  reorderLevel: number;
  trackInventory: boolean;
  trackExpiry: boolean;
  isActive: boolean;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryEntity {
  id: string;
  businessId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isActive: boolean;
}

export interface UnitEntity {
  id: string;
  name: string;
  shortName: string;
}
