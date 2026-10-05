export interface SaleItemEntity {
  id: string;
  saleId: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface SalePaymentEntity {
  id: string;
  saleId: string;
  paymentMethodId: string;
  methodCode: string;
  amount: number;
  referenceNumber?: string | null;
  createdAt: string;
}

export interface SaleEntity {
  id: string;
  clientTransactionId: string; // Unique transaction token for Idempotency
  businessId: string;
  branchId: string;
  terminalId: string;
  userId: string;
  customerId?: string | null;
  customerName?: string | null;
  shiftId: string;
  invoiceNumber: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  status: 'COMPLETED' | 'HOLD' | 'REFUNDED' | 'CANCELLED' | 'VOIDED' | 'DELETED';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: SaleItemEntity[];
  payments: SalePaymentEntity[];
}

export interface CreateSaleInput {
  clientTransactionId: string;
  businessId: string;
  branchId: string;
  terminalId: string;
  userId: string;
  customerId?: string | null;
  shiftId: string;
  items: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    costPrice: number;
    quantity: number;
    discountAmount?: number;
    taxRate?: number;
  }>;
  payments: Array<{
    paymentMethodId: string;
    methodCode: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT';
    amount: number;
    referenceNumber?: string;
  }>;
  overallDiscountAmount?: number;
  notes?: string;
}
