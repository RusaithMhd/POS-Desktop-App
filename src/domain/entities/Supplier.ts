export interface SupplierEntity {
  id: string;
  businessId: string;
  code: string;
  name: string;
  companyName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  paymentTerms: string;
  creditLimit: number;
  openingBalance: number;
  currentOutstanding: number;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPaymentEntity {
  id: string;
  supplierId: string;
  purchaseId?: string | null;
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  referenceNumber?: string | null;
  notes?: string | null;
  createdAt: string;
}
