import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

// ----------------------------------------------------------------------
// 1. ORGANIZATIONAL & SECURITY TABLES
// ----------------------------------------------------------------------

export const businesses = sqliteTable('businesses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  taxNumber: text('tax_number'),
  currency: text('currency').notNull().default('USD'),
  currencySymbol: text('currency_symbol').notNull().default('$'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const branches = sqliteTable('branches', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  code: text('code').notNull(),
  address: text('address'),
  phone: text('phone'),
  isMain: integer('is_main', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const terminals = sqliteTable('terminals', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.id),
  name: text('name').notNull(),
  code: text('code').notNull(),
  macAddress: text('mac_address'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // e.g. 'sales.create'
  module: text('module').notNull(), // e.g. 'sales'
  description: text('description'),
  createdAt: text('created_at').notNull(),
});

export const rolePermissions = sqliteTable('role_permissions', {
  roleId: text('role_id').notNull().references(() => roles.id),
  permissionId: text('permission_id').notNull().references(() => permissions.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  branchId: text('branch_id').notNull().references(() => branches.id),
  roleId: text('role_id').notNull().references(() => roles.id),
  username: text('username').notNull().unique(),
  email: text('email'),
  passwordHash: text('password_hash').notNull(),
  pinHash: text('pin_hash'),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ----------------------------------------------------------------------
// 2. PRODUCT CATALOG TABLES
// ----------------------------------------------------------------------

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const units = sqliteTable('units', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // e.g. 'Piece', 'Kilogram'
  shortName: text('short_name').notNull(), // e.g. 'pcs', 'kg'
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  categoryId: text('category_id').references(() => categories.id),
  unitId: text('unit_id').references(() => units.id),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  barcode: text('barcode'),
  brand: text('brand'),
  description: text('description'),
  costPrice: real('cost_price').notNull().default(0),
  sellingPrice: real('selling_price').notNull(),
  wholesalePrice: real('wholesale_price'),
  taxRate: real('tax_rate').notNull().default(0),
  stockQuantity: real('stock_quantity').notNull().default(0),
  minStockLevel: real('min_stock_level').notNull().default(5),
  reorderLevel: real('reorder_level').notNull().default(10),
  trackInventory: integer('track_inventory', { mode: 'boolean' }).notNull().default(true),
  trackExpiry: integer('track_expiry', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  imageUrl: text('image_url'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  skuIdx: index('products_sku_idx').on(table.sku),
  barcodeIdx: index('products_barcode_idx').on(table.barcode),
  nameIdx: index('products_name_idx').on(table.name),
}));

export const productVariants = sqliteTable('product_variants', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  name: text('name').notNull(), // e.g., 'Size L - Red'
  sku: text('sku').notNull().unique(),
  costPrice: real('cost_price').notNull(),
  sellingPrice: real('selling_price').notNull(),
  stockQuantity: real('stock_quantity').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const productBarcodes = sqliteTable('product_barcodes', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  barcode: text('barcode').notNull().unique(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
}, (table) => ({
  barcodeIdx: index('product_barcodes_barcode_idx').on(table.barcode),
}));

// ----------------------------------------------------------------------
// 3. CUSTOMER & SUPPLIER TABLES
// ----------------------------------------------------------------------

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  taxId: text('tax_id'),
  creditLimit: real('credit_limit').notNull().default(0),
  currentCredit: real('current_credit').notNull().default(0),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  phoneIdx: index('customers_phone_idx').on(table.phone),
  nameIdx: index('customers_name_idx').on(table.name),
}));

export const customerAddresses = sqliteTable('customer_addresses', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  city: text('city'),
  postalCode: text('postal_code'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(true),
});

export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  taxId: text('tax_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ----------------------------------------------------------------------
// 4. PURCHASES & INVENTORY MOVEMENTS (LEDGER)
// ----------------------------------------------------------------------

export const purchases = sqliteTable('purchases', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  branchId: text('branch_id').notNull().references(() => branches.id),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  invoiceNumber: text('invoice_number').notNull(),
  totalAmount: real('total_amount').notNull(),
  paidAmount: real('paid_amount').notNull(),
  paymentStatus: text('payment_status').notNull(), // 'PAID', 'PARTIAL', 'UNPAID'
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const purchaseItems = sqliteTable('purchase_items', {
  id: text('id').primaryKey(),
  purchaseId: text('purchase_id').notNull().references(() => purchases.id),
  productId: text('product_id').notNull().references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  quantity: real('quantity').notNull(),
  unitCost: real('unit_cost').notNull(),
  totalCost: real('total_cost').notNull(),
});

export const inventory = sqliteTable('inventory', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.id),
  productId: text('product_id').notNull().references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  quantity: real('quantity').notNull().default(0),
  reservedQuantity: real('reserved_quantity').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});

export const inventoryMovements = sqliteTable('inventory_movements', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.id),
  productId: text('product_id').notNull().references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  movementType: text('movement_type').notNull(), // 'PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'TRANSFER', 'OPENING_STOCK'
  referenceType: text('reference_type'), // 'sale', 'purchase', 'adjustment', 'return'
  referenceId: text('reference_id'),
  quantityChange: real('quantity_change').notNull(),
  previousQuantity: real('previous_quantity').notNull(),
  newQuantity: real('new_quantity').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  reason: text('reason'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  productIdx: index('inv_mov_product_idx').on(table.productId),
  refIdx: index('inv_mov_ref_idx').on(table.referenceId),
}));

export const stockAdjustments = sqliteTable('stock_adjustments', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.id),
  userId: text('user_id').notNull().references(() => users.id),
  reason: text('reason').notNull(),
  notes: text('notes'),
  status: text('status').notNull().default('COMPLETED'),
  createdAt: text('created_at').notNull(),
});

// ----------------------------------------------------------------------
// 5. SHIFT & CASH REGISTER MANAGEMENT
// ----------------------------------------------------------------------

export const cashRegisters = sqliteTable('cash_registers', {
  id: text('id').primaryKey(),
  terminalId: text('terminal_id').notNull().references(() => terminals.id),
  name: text('name').notNull(),
  openingBalance: real('opening_balance').notNull().default(0),
  currentBalance: real('current_balance').notNull().default(0),
  isOpen: integer('is_open', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
});

export const cashierShifts = sqliteTable('cashier_shifts', {
  id: text('id').primaryKey(),
  terminalId: text('terminal_id').notNull().references(() => terminals.id),
  userId: text('user_id').notNull().references(() => users.id),
  openedAt: text('opened_at').notNull(),
  closedAt: text('closed_at'),
  openingCash: real('opening_cash').notNull(),
  closingCashExpected: real('closing_cash_expected'),
  closingCashActual: real('closing_cash_actual'),
  cashDifference: real('cash_difference'),
  totalSales: real('total_sales').notNull().default(0),
  totalRefunds: real('total_refunds').notNull().default(0),
  totalCashIn: real('total_cash_in').notNull().default(0),
  totalCashOut: real('total_cash_out').notNull().default(0),
  status: text('status').notNull().default('OPEN'), // 'OPEN', 'CLOSED'
  notes: text('notes'),
});

export const cashMovements = sqliteTable('cash_movements', {
  id: text('id').primaryKey(),
  shiftId: text('shift_id').notNull().references(() => cashierShifts.id),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(), // 'CASH_IN', 'CASH_OUT', 'EXPENSE'
  amount: real('amount').notNull(),
  reason: text('reason').notNull(),
  reference: text('reference'),
  createdAt: text('created_at').notNull(),
});

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').notNull().references(() => branches.id),
  shiftId: text('shift_id').references(() => cashierShifts.id),
  userId: text('user_id').notNull().references(() => users.id),
  category: text('category').notNull(),
  amount: real('amount').notNull(),
  paymentMethod: text('payment_method').notNull().default('CASH'),
  description: text('description').notNull(),
  receiptRef: text('receipt_ref'),
  createdAt: text('created_at').notNull(),
});

// ----------------------------------------------------------------------
// 6. SALES, CHECKOUT & PAYMENTS
// ----------------------------------------------------------------------

export const paymentMethods = sqliteTable('payment_methods', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // 'Cash', 'Card', 'Bank Transfer', 'Store Credit'
  code: text('code').notNull().unique(), // 'CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT'
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const discounts = sqliteTable('discounts', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  code: text('code'),
  discountType: text('discount_type').notNull(), // 'PERCENTAGE', 'FIXED'
  value: real('value').notNull(),
  minPurchaseAmount: real('min_purchase_amount').default(0),
  startDate: text('start_date'),
  endDate: text('end_date'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const taxes = sqliteTable('taxes', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  rate: real('rate').notNull(), // e.g. 10 for 10%
  isInclusive: integer('is_inclusive', { mode: 'boolean' }).notNull().default(false),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
});

export const sales = sqliteTable('sales', {
  id: text('id').primaryKey(),
  clientTransactionId: text('client_transaction_id').notNull().unique(), // Key for Idempotency e.g. 'TRM-01-20260929-0001'
  businessId: text('business_id').notNull().references(() => businesses.id),
  branchId: text('branch_id').notNull().references(() => branches.id),
  terminalId: text('terminal_id').notNull().references(() => terminals.id),
  userId: text('user_id').notNull().references(() => users.id),
  customerId: text('customer_id').references(() => customers.id),
  shiftId: text('shift_id').notNull().references(() => cashierShifts.id),
  invoiceNumber: text('invoice_number').notNull().unique(),
  subtotal: real('subtotal').notNull(),
  discountAmount: real('discount_amount').notNull().default(0),
  taxAmount: real('tax_amount').notNull().default(0),
  totalAmount: real('total_amount').notNull(),
  paidAmount: real('paid_amount').notNull(),
  changeAmount: real('change_amount').notNull().default(0),
  status: text('status').notNull().default('COMPLETED'), // 'COMPLETED', 'HOLD', 'REFUNDED', 'CANCELLED'
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  invoiceIdx: index('sales_invoice_idx').on(table.invoiceNumber),
  clientTxIdx: index('sales_client_tx_idx').on(table.clientTransactionId),
  customerIdx: index('sales_customer_idx').on(table.customerId),
  shiftIdx: index('sales_shift_idx').on(table.shiftId),
}));

export const saleItems = sqliteTable('sale_items', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull().references(() => sales.id),
  productId: text('product_id').notNull().references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  productName: text('product_name').notNull(),
  unitPrice: real('unit_price').notNull(),
  costPrice: real('cost_price').notNull(),
  quantity: real('quantity').notNull(),
  discountAmount: real('discount_amount').notNull().default(0),
  taxAmount: real('tax_amount').notNull().default(0),
  totalAmount: real('total_amount').notNull(),
}, (table) => ({
  saleIdx: index('sale_items_sale_idx').on(table.saleId),
}));

export const salePayments = sqliteTable('sale_payments', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull().references(() => sales.id),
  paymentMethodId: text('payment_method_id').notNull().references(() => paymentMethods.id),
  methodCode: text('method_code').notNull(), // 'CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT'
  amount: real('amount').notNull(),
  referenceNumber: text('reference_number'),
  createdAt: text('created_at').notNull(),
});

export const returns = sqliteTable('returns', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull().references(() => sales.id),
  branchId: text('branch_id').notNull().references(() => branches.id),
  terminalId: text('terminal_id').notNull().references(() => terminals.id),
  userId: text('user_id').notNull().references(() => users.id),
  customerId: text('customer_id').references(() => customers.id),
  returnNumber: text('return_number').notNull().unique(),
  totalRefundAmount: real('total_refund_amount').notNull(),
  reason: text('reason').notNull(),
  createdAt: text('created_at').notNull(),
});

export const returnItems = sqliteTable('return_items', {
  id: text('id').primaryKey(),
  returnId: text('return_id').notNull().references(() => returns.id),
  saleItemId: text('sale_item_id').notNull().references(() => saleItems.id),
  productId: text('product_id').notNull().references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  quantity: real('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  refundAmount: real('refund_amount').notNull(),
});

// ----------------------------------------------------------------------
// 7. AUDIT & SYNC ENGINE QUEUE
// ----------------------------------------------------------------------

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  branchId: text('branch_id').notNull(),
  terminalId: text('terminal_id').notNull(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(), // e.g. 'PRICE_CHANGED', 'REFUND_CREATED', 'STOCK_ADJUSTED'
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  oldValues: text('old_values'), // JSON string
  newValues: text('new_values'), // JSON string
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull(),
});

export const syncQueue = sqliteTable('sync_queue', {
  id: text('id').primaryKey(),
  clientTransactionId: text('client_transaction_id').notNull(),
  entityType: text('entity_type').notNull(), // 'sale', 'customer', 'inventory_movement', 'shift'
  entityId: text('entity_id').notNull(),
  operation: text('operation').notNull(), // 'CREATE', 'UPDATE', 'DELETE'
  payload: text('payload').notNull(), // Full JSON DTO payload
  attemptCount: integer('attempt_count').notNull().default(0),
  lastAttemptAt: text('last_attempt_at'),
  status: text('status').notNull().default('PENDING'), // 'PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT'
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  statusIdx: index('sync_queue_status_idx').on(table.status),
  clientTxIdx: index('sync_queue_client_tx_idx').on(table.clientTransactionId),
}));

export const syncConflicts = sqliteTable('sync_conflicts', {
  id: text('id').primaryKey(),
  syncQueueId: text('sync_queue_id').notNull().references(() => syncQueue.id),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  clientPayload: text('client_payload').notNull(),
  serverPayload: text('server_payload').notNull(),
  resolutionStrategy: text('resolution_strategy'),
  resolvedAt: text('resolved_at'),
  resolvedBy: text('resolved_by'),
});

export const syncMetadata = sqliteTable('sync_metadata', {
  id: text('id').primaryKey(),
  terminalId: text('terminal_id').notNull(),
  lastSuccessfulSync: text('last_successful_sync'),
  serverVersion: text('server_version'),
  status: text('status').notNull().default('IDLE'),
});

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  branchId: text('branch_id').notNull(),
  terminalId: text('terminal_id').notNull(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(), // JSON string or scalar string
  updatedAt: text('updated_at').notNull(),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('INFO'), // 'INFO', 'WARNING', 'ALERT'
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

// ----------------------------------------------------------------------
// 8. DOUBLE-ENTRY ACCOUNTING TABLES
// ----------------------------------------------------------------------

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  accountCode: text('account_code').notNull().unique(),
  accountName: text('account_name').notNull(),
  accountType: text('account_type').notNull(), // 'ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'COGS', 'EXPENSE'
  parentId: text('parent_id'),
  normalBalance: text('normal_balance').notNull(), // 'DEBIT', 'CREDIT'
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isSystemAccount: integer('is_system_account', { mode: 'boolean' }).notNull().default(false),
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  codeIdx: index('accounts_code_idx').on(table.accountCode),
  typeIdx: index('accounts_type_idx').on(table.accountType),
}));

export const journalEntries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(),
  journalNumber: text('journal_number').notNull().unique(),
  transactionDate: text('transaction_date').notNull(),
  referenceType: text('reference_type').notNull(), // 'SALE', 'PURCHASE', 'EXPENSE', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'OWNER_CAPITAL', 'OWNER_DRAWING', 'SALES_RETURN', 'PURCHASE_RETURN', 'STOCK_ADJUSTMENT', 'MANUAL'
  referenceId: text('reference_id'),
  description: text('description').notNull(),
  status: text('status').notNull().default('POSTED'), // 'DRAFT', 'POSTED', 'VOID'
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  numberIdx: index('journal_entries_number_idx').on(table.journalNumber),
  dateIdx: index('journal_entries_date_idx').on(table.transactionDate),
  refIdx: index('journal_entries_ref_idx').on(table.referenceId),
}));

export const journalLines = sqliteTable('journal_lines', {
  id: text('id').primaryKey(),
  journalEntryId: text('journal_entry_id').notNull().references(() => journalEntries.id),
  accountId: text('account_id').notNull().references(() => accounts.id),
  debit: real('debit').notNull().default(0),
  credit: real('credit').notNull().default(0),
  description: text('description'),
}, (table) => ({
  entryIdx: index('journal_lines_entry_idx').on(table.journalEntryId),
  accountIdx: index('journal_lines_account_idx').on(table.accountId),
}));

export const accountMappings = sqliteTable('account_mappings', {
  id: text('id').primaryKey(),
  mappingKey: text('mapping_key').notNull().unique(), // 'CASH', 'BANK', 'RECEIVABLE', 'INVENTORY', 'PAYABLE', 'OWNER_CAPITAL', 'OWNER_DRAWING', 'SALES', 'OTHER_INCOME', 'SALES_RETURN', 'SALES_DISCOUNT', 'COGS', 'DEFAULT_EXPENSE'
  accountId: text('account_id').notNull().references(() => accounts.id),
  updatedAt: text('updated_at').notNull(),
});

