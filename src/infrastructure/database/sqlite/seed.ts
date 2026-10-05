import { Database } from 'sql.js';
import bcrypt from 'bcryptjs';

export function seedInitialData(db: Database) {
  const now = new Date().toISOString();

  // 1. Business with LKR Currency
  db.run(`
    INSERT INTO businesses (id, name, tax_number, currency, currency_symbol, address, phone, email, created_at, updated_at)
    VALUES ('biz-001', 'TRIWYN Store Colombo', 'TAX-889920', 'LKR', 'Rs.', '100 Commercial Plaza, Colombo 03', '+94 11 234 5678', 'contact@triwynpos.lk', '${now}', '${now}');

    INSERT INTO branches (id, business_id, name, code, address, phone, is_main, created_at, updated_at)
    VALUES ('branch-001', 'biz-001', 'Colombo Flagship Branch', 'BR-COLOMBO', '100 Commercial Plaza, Colombo 03', '+94 11 234 5678', 1, '${now}', '${now}');

    INSERT INTO terminals (id, branch_id, name, code, mac_address, is_active, created_at, updated_at)
    VALUES ('term-001', 'branch-001', 'POS Terminal 01', 'POS-01', '00:1B:44:11:3A:B7', 1, '${now}', '${now}');
  `);

  // 2. Roles & Permissions (Multi-Tenant RBAC)
  const superPassHash = bcrypt.hashSync('Super@123', 10);
  const superPinHash = bcrypt.hashSync('1111', 10);

  const adminPassHash = bcrypt.hashSync('Admin@123', 10);
  const adminPinHash = bcrypt.hashSync('1234', 10);

  const managerPassHash = bcrypt.hashSync('Manager@123', 10);
  const managerPinHash = bcrypt.hashSync('2345', 10);

  const cashierPassHash = bcrypt.hashSync('Cashier@123', 10);
  const cashierPinHash = bcrypt.hashSync('9999', 10);

  const kitchenPassHash = bcrypt.hashSync('Kitchen@123', 10);
  const kitchenPinHash = bcrypt.hashSync('7777', 10);

  const invPassHash = bcrypt.hashSync('Inventory@123', 10);
  const invPinHash = bcrypt.hashSync('3456', 10);

  const accPassHash = bcrypt.hashSync('Accountant@123', 10);
  const accPinHash = bcrypt.hashSync('4567', 10);

  const audPassHash = bcrypt.hashSync('Auditor@123', 10);
  const audPinHash = bcrypt.hashSync('8888', 10);

  db.run(`
    INSERT INTO roles (id, name, description, is_system, created_at, updated_at) VALUES
    ('role-superadmin', 'SUPER_ADMIN', 'Super Administrator with unconditional system access & ownership', 1, '${now}', '${now}'),
    ('role-admin', 'ADMIN_MANAGER', 'Store General Manager handling operational business administration', 1, '${now}', '${now}'),
    ('role-sysadmin', 'ADMIN', 'Store Administrator with full administrative access', 1, '${now}', '${now}'),
    ('role-cashier', 'CASHIER', 'Frontline Point of Sale register operator', 1, '${now}', '${now}'),
    ('role-kitchen', 'KITCHEN_USER', 'Kitchen Display System operator managing order preparation', 1, '${now}', '${now}'),
    ('role-inventory', 'INVENTORY_USER', 'Stock room & warehouse inventory manager', 1, '${now}', '${now}'),
    ('role-accountant', 'ACCOUNTANT', 'Financial analyst managing sales reports & tax ledgers', 1, '${now}', '${now}'),
    ('role-auditor', 'AUDITOR', 'Completely read-only system auditor and reviewer', 1, '${now}', '${now}');

    INSERT INTO permissions (id, name, module, action_type, description, created_at) VALUES
    ('p-dash-view', 'dashboard.view', 'dashboard', 'VIEW', 'View main operational dashboard', '${now}'),
    ('p-pos-access', 'pos.access', 'pos', 'VIEW', 'Access POS terminal checkout', '${now}'),
    ('p-orders-view', 'orders.view', 'orders', 'VIEW', 'View order transactions', '${now}'),
    ('p-orders-create', 'orders.create', 'orders', 'CREATE', 'Create POS orders', '${now}'),
    ('p-orders-edit', 'orders.edit', 'orders', 'EDIT', 'Edit existing orders', '${now}'),
    ('p-orders-cancel', 'orders.cancel', 'orders', 'DELETE', 'Cancel active order', '${now}'),
    ('p-orders-void', 'orders.void', 'orders', 'OVERRIDE', 'Void order line items or cart', '${now}'),
    ('p-orders-reopen', 'orders.reopen', 'orders', 'OVERRIDE', 'Reopen completed sales order', '${now}'),
    ('p-pay-view', 'payments.view', 'payments', 'VIEW', 'View payment transaction ledger', '${now}'),
    ('p-pay-accept', 'payments.accept', 'payments', 'CREATE', 'Accept customer payment', '${now}'),
    ('p-pay-refund', 'payments.refund', 'payments', 'APPROVE', 'Process customer refunds', '${now}'),
    ('p-pay-void', 'payments.void', 'payments', 'OVERRIDE', 'Void payment transaction', '${now}'),
    ('p-prod-view', 'products.view', 'products', 'VIEW', 'View catalog products', '${now}'),
    ('p-prod-create', 'products.create', 'products', 'CREATE', 'Create new products', '${now}'),
    ('p-prod-edit', 'products.edit', 'products', 'EDIT', 'Edit product prices & details', '${now}'),
    ('p-prod-delete', 'products.delete', 'products', 'DELETE', 'Delete catalog products', '${now}'),
    ('p-prod-price', 'products.change_price', 'products', 'OVERRIDE', 'Override selling price at POS', '${now}'),
    ('p-inv-view', 'inventory.view', 'inventory', 'VIEW', 'View stock balances & ledger', '${now}'),
    ('p-inv-adjust', 'inventory.adjust', 'inventory', 'EDIT', 'Perform stock in/out adjustments', '${now}'),
    ('p-purch-view', 'purchasing.view', 'purchasing', 'VIEW', 'View purchase orders', '${now}'),
    ('p-purch-create', 'purchasing.create', 'purchasing', 'CREATE', 'Create purchase orders', '${now}'),
    ('p-purch-receive', 'purchasing.receive', 'purchasing', 'EDIT', 'Receive stock deliveries', '${now}'),
    ('p-cust-view', 'customers.view', 'customers', 'VIEW', 'View customer list', '${now}'),
    ('p-cust-manage', 'customers.manage', 'customers', 'EDIT', 'Create & edit customer records', '${now}'),
    ('p-supp-manage', 'suppliers.manage', 'suppliers', 'EDIT', 'Manage suppliers & vendors', '${now}'),
    ('p-disc-view', 'discounts.view', 'discounts', 'VIEW', 'View discount rules', '${now}'),
    ('p-disc-apply', 'discounts.apply', 'discounts', 'CREATE', 'Apply standard line discounts', '${now}'),
    ('p-disc-override', 'discounts.override', 'discounts', 'OVERRIDE', 'Apply custom or high discounts', '${now}'),
    ('p-kit-view', 'kitchen.view', 'kitchen', 'VIEW', 'View Kitchen Display System (KOT)', '${now}'),
    ('p-kit-status', 'kitchen.update_status', 'kitchen', 'EDIT', 'Update order kitchen status', '${now}'),
    ('p-rep-view', 'reports.view', 'reports', 'VIEW', 'View operational reports', '${now}'),
    ('p-rep-fin', 'reports.financial', 'reports', 'EXPORT', 'View financial revenue & P&L reports', '${now}'),
    ('p-rep-export', 'reports.export', 'reports', 'EXPORT', 'Export report data to CSV/Excel', '${now}'),
    ('p-user-view', 'users.view', 'users', 'VIEW', 'View staff user list', '${now}'),
    ('p-user-manage', 'users.manage', 'users', 'EDIT', 'Create, edit & disable staff users', '${now}'),
    ('p-role-view', 'roles.view', 'roles', 'VIEW', 'View roles & permission matrix', '${now}'),
    ('p-role-manage', 'roles.manage', 'roles', 'EDIT', 'Create & edit custom roles', '${now}'),
    ('p-set-view', 'settings.view', 'settings', 'VIEW', 'View system settings', '${now}'),
    ('p-set-manage', 'settings.manage', 'settings', 'EDIT', 'Manage terminal & store settings', '${now}'),
    ('p-db-backup', 'database.backup', 'database', 'EXPORT', 'Backup SQLite database', '${now}'),
    ('p-db-restore', 'database.restore', 'database', 'OVERRIDE', 'Restore system database backup', '${now}'),
    ('p-audit-view', 'audit_logs.view', 'audit_logs', 'VIEW', 'View immutable audit logs', '${now}'),
    ('p-shift-open', 'cash_register.open', 'shift', 'CREATE', 'Open cashier register shift', '${now}'),
    ('p-shift-close', 'cash_register.close', 'shift', 'EDIT', 'Close cashier register shift', '${now}');

    INSERT INTO role_permissions (role_id, permission_id) VALUES
    -- SUPER_ADMIN (All 44 permissions)
    ('role-superadmin', 'p-dash-view'), ('role-superadmin', 'p-pos-access'), ('role-superadmin', 'p-orders-view'),
    ('role-superadmin', 'p-orders-create'), ('role-superadmin', 'p-orders-edit'), ('role-superadmin', 'p-orders-cancel'),
    ('role-superadmin', 'p-orders-void'), ('role-superadmin', 'p-orders-reopen'), ('role-superadmin', 'p-pay-view'),
    ('role-superadmin', 'p-pay-accept'), ('role-superadmin', 'p-pay-refund'), ('role-superadmin', 'p-pay-void'),
    ('role-superadmin', 'p-prod-view'), ('role-superadmin', 'p-prod-create'), ('role-superadmin', 'p-prod-edit'),
    ('role-superadmin', 'p-prod-delete'), ('role-superadmin', 'p-prod-price'), ('role-superadmin', 'p-inv-view'),
    ('role-superadmin', 'p-inv-adjust'), ('role-superadmin', 'p-purch-view'), ('role-superadmin', 'p-purch-create'),
    ('role-superadmin', 'p-purch-receive'), ('role-superadmin', 'p-cust-view'), ('role-superadmin', 'p-cust-manage'),
    ('role-superadmin', 'p-supp-manage'), ('role-superadmin', 'p-disc-view'), ('role-superadmin', 'p-disc-apply'),
    ('role-superadmin', 'p-disc-override'), ('role-superadmin', 'p-kit-view'), ('role-superadmin', 'p-kit-status'),
    ('role-superadmin', 'p-rep-view'), ('role-superadmin', 'p-rep-fin'), ('role-superadmin', 'p-rep-export'),
    ('role-superadmin', 'p-user-view'), ('role-superadmin', 'p-user-manage'), ('role-superadmin', 'p-role-view'),
    ('role-superadmin', 'p-role-manage'), ('role-superadmin', 'p-set-view'), ('role-superadmin', 'p-set-manage'),
    ('role-superadmin', 'p-db-backup'), ('role-superadmin', 'p-db-restore'), ('role-superadmin', 'p-audit-view'),
    ('role-superadmin', 'p-shift-open'), ('role-superadmin', 'p-shift-close'),

    -- ADMIN (All 44 permissions)
    ('role-sysadmin', 'p-dash-view'), ('role-sysadmin', 'p-pos-access'), ('role-sysadmin', 'p-orders-view'),
    ('role-sysadmin', 'p-orders-create'), ('role-sysadmin', 'p-orders-edit'), ('role-sysadmin', 'p-orders-cancel'),
    ('role-sysadmin', 'p-orders-void'), ('role-sysadmin', 'p-orders-reopen'), ('role-sysadmin', 'p-pay-view'),
    ('role-sysadmin', 'p-pay-accept'), ('role-sysadmin', 'p-pay-refund'), ('role-sysadmin', 'p-pay-void'),
    ('role-sysadmin', 'p-prod-view'), ('role-sysadmin', 'p-prod-create'), ('role-sysadmin', 'p-prod-edit'),
    ('role-sysadmin', 'p-prod-delete'), ('role-sysadmin', 'p-prod-price'), ('role-sysadmin', 'p-inv-view'),
    ('role-sysadmin', 'p-inv-adjust'), ('role-sysadmin', 'p-purch-view'), ('role-sysadmin', 'p-purch-create'),
    ('role-sysadmin', 'p-purch-receive'), ('role-sysadmin', 'p-cust-view'), ('role-sysadmin', 'p-cust-manage'),
    ('role-sysadmin', 'p-supp-manage'), ('role-sysadmin', 'p-disc-view'), ('role-sysadmin', 'p-disc-apply'),
    ('role-sysadmin', 'p-disc-override'), ('role-sysadmin', 'p-kit-view'), ('role-sysadmin', 'p-kit-status'),
    ('role-sysadmin', 'p-rep-view'), ('role-sysadmin', 'p-rep-fin'), ('role-sysadmin', 'p-rep-export'),
    ('role-sysadmin', 'p-user-view'), ('role-sysadmin', 'p-user-manage'), ('role-sysadmin', 'p-role-view'),
    ('role-sysadmin', 'p-role-manage'), ('role-sysadmin', 'p-set-view'), ('role-sysadmin', 'p-set-manage'),
    ('role-sysadmin', 'p-db-backup'), ('role-sysadmin', 'p-db-restore'), ('role-sysadmin', 'p-audit-view'),
    ('role-sysadmin', 'p-shift-open'), ('role-sysadmin', 'p-shift-close'),

    -- ADMIN_MANAGER (All except database.restore)
    ('role-admin', 'p-dash-view'), ('role-admin', 'p-pos-access'), ('role-admin', 'p-orders-view'),
    ('role-admin', 'p-orders-create'), ('role-admin', 'p-orders-edit'), ('role-admin', 'p-orders-cancel'),
    ('role-admin', 'p-orders-void'), ('role-admin', 'p-orders-reopen'), ('role-admin', 'p-pay-view'),
    ('role-admin', 'p-pay-accept'), ('role-admin', 'p-pay-refund'), ('role-admin', 'p-prod-view'),
    ('role-admin', 'p-prod-create'), ('role-admin', 'p-prod-edit'), ('role-admin', 'p-prod-price'),
    ('role-admin', 'p-inv-view'), ('role-admin', 'p-inv-adjust'), ('role-admin', 'p-purch-view'),
    ('role-admin', 'p-purch-create'), ('role-admin', 'p-purch-receive'), ('role-admin', 'p-cust-view'),
    ('role-admin', 'p-cust-manage'), ('role-admin', 'p-supp-manage'), ('role-admin', 'p-disc-view'),
    ('role-admin', 'p-disc-apply'), ('role-admin', 'p-disc-override'), ('role-admin', 'p-kit-view'),
    ('role-admin', 'p-kit-status'), ('role-admin', 'p-rep-view'), ('role-admin', 'p-rep-fin'),
    ('role-admin', 'p-rep-export'), ('role-admin', 'p-user-view'), ('role-admin', 'p-user-manage'),
    ('role-admin', 'p-role-view'), ('role-admin', 'p-set-view'), ('role-admin', 'p-set-manage'),
    ('role-admin', 'p-db-backup'), ('role-admin', 'p-audit-view'), ('role-admin', 'p-shift-open'), ('role-admin', 'p-shift-close'),

    -- CASHIER
    ('role-cashier', 'p-dash-view'), ('role-cashier', 'p-pos-access'), ('role-cashier', 'p-orders-view'),
    ('role-cashier', 'p-orders-create'), ('role-cashier', 'p-pay-view'), ('role-cashier', 'p-pay-accept'),
    ('role-cashier', 'p-cust-view'), ('role-cashier', 'p-cust-manage'), ('role-cashier', 'p-disc-view'),
    ('role-cashier', 'p-disc-apply'), ('role-cashier', 'p-shift-open'), ('role-cashier', 'p-shift-close'),

    -- KITCHEN_USER
    ('role-kitchen', 'p-kit-view'), ('role-kitchen', 'p-kit-status'), ('role-kitchen', 'p-orders-view'),

    -- INVENTORY_USER
    ('role-inventory', 'p-prod-view'), ('role-inventory', 'p-prod-create'), ('role-inventory', 'p-prod-edit'),
    ('role-inventory', 'p-inv-view'), ('role-inventory', 'p-inv-adjust'), ('role-inventory', 'p-purch-view'),
    ('role-inventory', 'p-purch-create'), ('role-inventory', 'p-purch-receive'), ('role-inventory', 'p-supp-manage'),

    -- ACCOUNTANT
    ('role-accountant', 'p-dash-view'), ('role-accountant', 'p-orders-view'), ('role-accountant', 'p-pay-view'),
    ('role-accountant', 'p-rep-view'), ('role-accountant', 'p-rep-fin'), ('role-accountant', 'p-rep-export'),
    ('role-accountant', 'p-purch-view'),

    -- AUDITOR (Read-only)
    ('role-auditor', 'p-dash-view'), ('role-auditor', 'p-orders-view'), ('role-auditor', 'p-pay-view'),
    ('role-auditor', 'p-prod-view'), ('role-auditor', 'p-inv-view'), ('role-auditor', 'p-rep-view'),
    ('role-auditor', 'p-audit-view');
  `);

  // 3. System Users
  db.run(`
    INSERT INTO users (id, business_id, branch_id, role_id, username, email, password_hash, pin_hash, full_name, phone, status, is_active, created_at, updated_at) VALUES
    ('usr-superadmin', 'biz-001', 'branch-001', 'role-superadmin', 'superadmin', 'owner@triwynpos.lk', '${superPassHash}', '${superPinHash}', 'Arthur Pendelton (Owner)', '+94 77 000 0000', 'ACTIVE', 1, '${now}', '${now}'),
    ('usr-admin', 'biz-001', 'branch-001', 'role-admin', 'admin', 'admin@triwynpos.lk', '${adminPassHash}', '${adminPinHash}', 'Alexander Pierce (Manager)', '+94 77 123 4567', 'ACTIVE', 1, '${now}', '${now}'),
    ('usr-cashier', 'biz-001', 'branch-001', 'role-cashier', 'cashier', 'cashier@triwynpos.lk', '${cashierPassHash}', '${cashierPinHash}', 'David Miller (Cashier)', '+94 77 345 6789', 'ACTIVE', 1, '${now}', '${now}'),
    ('usr-kitchen', 'biz-001', 'branch-001', 'role-kitchen', 'kitchen', 'kitchen@triwynpos.lk', '${kitchenPassHash}', '${kitchenPinHash}', 'Chef Gordon (Kitchen)', '+94 77 999 8888', 'ACTIVE', 1, '${now}', '${now}'),
    ('usr-inventory', 'biz-001', 'branch-001', 'role-inventory', 'inventory', 'inventory@triwynpos.lk', '${invPassHash}', '${invPinHash}', 'Marcus Brody (Stock)', '+94 77 456 7890', 'ACTIVE', 1, '${now}', '${now}'),
    ('usr-accountant', 'biz-001', 'branch-001', 'role-accountant', 'accountant', 'accountant@triwynpos.lk', '${accPassHash}', '${accPinHash}', 'Rachel Green (Finance)', '+94 77 567 8901', 'ACTIVE', 1, '${now}', '${now}'),
    ('usr-auditor', 'biz-001', 'branch-001', 'role-auditor', 'auditor', 'auditor@triwynpos.lk', '${audPassHash}', '${audPinHash}', 'Inspector Clouseau (Auditor)', '+94 77 888 7777', 'ACTIVE', 1, '${now}', '${now}');
  `);

  // 4. Default Approval Rules
  db.run(`
    INSERT INTO approval_rules (id, business_id, rule_type, min_value, max_value, required_role, created_at, updated_at) VALUES
    ('rule-disc-cashier', 'biz-001', 'DISCOUNT_PERCENT', 0, 10, 'CASHIER', '${now}', '${now}'),
    ('rule-disc-manager', 'biz-001', 'DISCOUNT_PERCENT', 10, 25, 'ADMIN_MANAGER', '${now}', '${now}'),
    ('rule-disc-admin', 'biz-001', 'DISCOUNT_PERCENT', 25, 100, 'SUPER_ADMIN', '${now}', '${now}'),
    ('rule-refund-mgr', 'biz-001', 'REFUND_AMOUNT', 0, 50000, 'ADMIN_MANAGER', '${now}', '${now}'),
    ('rule-refund-sup', 'biz-001', 'REFUND_AMOUNT', 50000, 9999999, 'SUPER_ADMIN', '${now}', '${now}'),
    ('rule-override-mgr', 'biz-001', 'PRICE_OVERRIDE', 0, 9999999, 'ADMIN_MANAGER', '${now}', '${now}');
  `);

  // 4. Units & Categories
  db.run(`
    INSERT INTO units (id, name, short_name) VALUES
    ('unit-pcs', 'Piece', 'pcs'),
    ('unit-kg', 'Kilogram', 'kg'),
    ('unit-box', 'Box', 'box'),
    ('unit-ltr', 'Liter', 'ltr'),
    ('unit-pack', 'Pack', 'pack');

    INSERT INTO categories (id, business_id, name, code, description, is_active, created_at, updated_at) VALUES
    ('cat-bev', 'biz-001', 'Beverages & Coffee', 'BEV', 'Fresh coffee, juices, sodas and bottled drinks', 1, '${now}', '${now}'),
    ('cat-bakery', 'biz-001', 'Bakery & Snacks', 'BAK', 'Fresh pastries, breads, chips and snacks', 1, '${now}', '${now}'),
    ('cat-dairy', 'biz-001', 'Dairy & Refrigerated', 'DAI', 'Milk, cheese, butter and yogurt', 1, '${now}', '${now}'),
    ('cat-elec', 'biz-001', 'Electronics & Accessories', 'ELE', 'Cables, chargers, earphones and tech accessories', 1, '${now}', '${now}'),
    ('cat-house', 'biz-001', 'Household & Personal Care', 'HOU', 'Soaps, tissues, cleaners and daily essentials', 1, '${now}', '${now}');
  `);

  // 5. Payment Methods, Taxes & Discounts
  db.run(`
    INSERT INTO payment_methods (id, name, code, is_active) VALUES
    ('pm-cash', 'Cash', 'CASH', 1),
    ('pm-card', 'Credit/Debit Card', 'CARD', 1),
    ('pm-bank', 'Bank Transfer / QR', 'BANK_TRANSFER', 1),
    ('pm-credit', 'Customer Credit Account', 'CREDIT', 1);

    INSERT INTO taxes (id, business_id, name, rate, is_inclusive, is_default) VALUES
    ('tax-std', 'biz-001', 'Standard VAT (8%)', 8.0, 0, 1),
    ('tax-zero', 'biz-001', 'Zero Tax (0%)', 0.0, 0, 0);

    INSERT INTO discounts (id, business_id, name, code, discount_type, value, min_purchase_amount, is_active) VALUES
    ('disc-vip', 'biz-001', 'VIP Customer Discount 10%', 'VIP10', 'PERCENTAGE', 10.0, 2000.0, 1),
    ('disc-flat500', 'biz-001', 'Flat Rs. 500 Off', 'FLAT500', 'FIXED', 500.0, 5000.0, 1);
  `);

  // 6. Products List in LKR (Sri Lankan Rupees)
  const productsList = [
    { id: 'prod-001', cat: 'cat-bev', name: 'Espresso Coffee Beans 1kg', sku: 'SKU-BEV-001', barcode: '890100010001', cost: 3500.00, price: 6500.00, stock: 45, unit: 'unit-kg' },
    { id: 'prod-002', cat: 'cat-bev', name: 'Organic Almond Milk 1L', sku: 'SKU-BEV-002', barcode: '890100010002', cost: 450.00, price: 850.00, stock: 120, unit: 'unit-ltr' },
    { id: 'prod-003', cat: 'cat-bev', name: 'Sparkling Mineral Water 500ml', sku: 'SKU-BEV-003', barcode: '890100010003', cost: 150.00, price: 350.00, stock: 200, unit: 'unit-pcs' },
    { id: 'prod-004', cat: 'cat-bakery', name: 'Artisan Butter Croissant', sku: 'SKU-BAK-001', barcode: '890100010004', cost: 200.00, price: 450.00, stock: 35, unit: 'unit-pcs' },
    { id: 'prod-005', cat: 'cat-bakery', name: 'Chocolate Chip Cookie 6-Pack', sku: 'SKU-BAK-002', barcode: '890100010005', cost: 400.00, price: 950.00, stock: 50, unit: 'unit-pack' },
    { id: 'prod-006', cat: 'cat-dairy', name: 'Greek Yogurt Vanilla 500g', sku: 'SKU-DAI-001', barcode: '890100010006', cost: 500.00, price: 1150.00, stock: 60, unit: 'unit-pcs' },
    { id: 'prod-007', cat: 'cat-dairy', name: 'Aged Cheddar Cheese Slice 200g', sku: 'SKU-DAI-002', barcode: '890100010007', cost: 800.00, price: 1650.00, stock: 40, unit: 'unit-pcs' },
    { id: 'prod-008', cat: 'cat-elec', name: 'USB-C Fast Charging Cable 2m', sku: 'SKU-ELE-001', barcode: '890100010008', cost: 900.00, price: 2200.00, stock: 80, unit: 'unit-pcs' },
    { id: 'prod-009', cat: 'cat-elec', name: 'Wireless Bluetooth Earbuds Pro', sku: 'SKU-ELE-002', barcode: '890100010009', cost: 4500.00, price: 12500.00, stock: 25, unit: 'unit-box' },
    { id: 'prod-010', cat: 'cat-house', name: 'Eco Bamboo Facial Tissues 3-Pack', sku: 'SKU-HOU-001', barcode: '890100010010', cost: 350.00, price: 750.00, stock: 90, unit: 'unit-pack' },
    { id: 'prod-011', cat: 'cat-house', name: 'Antibacterial Hand Sanitizer 250ml', sku: 'SKU-HOU-002', barcode: '890100010011', cost: 250.00, price: 550.00, stock: 150, unit: 'unit-pcs' },
    { id: 'prod-012', cat: 'cat-bev', name: 'Fresh Cold Pressed Orange Juice 330ml', sku: 'SKU-BEV-004', barcode: '890100010012', cost: 300.00, price: 650.00, stock: 4, unit: 'unit-pcs' },
  ];

  for (const p of productsList) {
    db.run(`
      INSERT INTO products (id, business_id, category_id, unit_id, name, sku, barcode, brand, description, cost_price, selling_price, tax_rate, stock_quantity, min_stock_level, reorder_level, track_inventory, is_active, created_at, updated_at)
      VALUES ('${p.id}', 'biz-001', '${p.cat}', '${p.unit}', '${p.name}', '${p.sku}', '${p.barcode}', 'TRIWYN Brand', '${p.name} premium quality product', ${p.cost}, ${p.price}, 8.0, ${p.stock}, 10, 15, 1, 1, '${now}', '${now}');

      INSERT INTO product_barcodes (id, product_id, barcode, is_primary)
      VALUES ('bc-${p.id}', '${p.id}', '${p.barcode}', 1);

      INSERT INTO inventory (id, branch_id, product_id, quantity, reserved_quantity, updated_at)
      VALUES ('inv-${p.id}', 'branch-001', '${p.id}', ${p.stock}, 0, '${now}');

      INSERT INTO inventory_movements (id, branch_id, product_id, movement_type, reference_type, reference_id, quantity_change, previous_quantity, new_quantity, user_id, reason, created_at)
      VALUES ('mov-open-${p.id}', 'branch-001', '${p.id}', 'OPENING_STOCK', 'initialization', 'init-seed', ${p.stock}, 0, ${p.stock}, 'usr-admin', 'Initial system opening stock seed', '${now}');
    `);
  }

  // 7. Customers & Cash Register Float in LKR
  db.run(`
    INSERT INTO customers (id, business_id, name, phone, email, credit_limit, current_credit, loyalty_points, created_at, updated_at) VALUES
    ('cust-001', 'biz-001', 'Walk-in Customer', '+94 00 000 0000', 'walkin@triwynpos.lk', 0, 0, 0, '${now}', '${now}'),
    ('cust-002', 'biz-001', 'Eleanor Vance', '+94 77 234 5678', 'eleanor.vance@example.com', 50000.0, 4500.0, 120, '${now}', '${now}'),
    ('cust-003', 'biz-001', 'Marcus Sterling', '+94 77 876 5432', 'marcus.s@example.com', 100000.0, 0.0, 350, '${now}', '${now}');

    INSERT INTO cash_registers (id, terminal_id, name, opening_balance, current_balance, is_open, updated_at)
    VALUES ('reg-001', 'term-001', 'Register Terminal 01', 20000.0, 20000.0, 0, '${now}');

    INSERT INTO settings (id, business_id, branch_id, terminal_id, key, value, updated_at) VALUES
    ('set-001', 'biz-001', 'branch-001', 'term-001', 'receipt_header', '"TRIWYN STORE COLOMBO\\n100 Commercial Plaza, Colombo 03\\nTel: +94 11 234 5678"', '${now}'),
    ('set-002', 'biz-001', 'branch-001', 'term-001', 'receipt_footer', '"Thank you for shopping with TRIWYN POS!\\nPlease come again."', '${now}'),
    ('set-003', 'biz-001', 'branch-001', 'term-001', 'auto_print_receipt', 'true', '${now}'),
    ('set-004', 'biz-001', 'branch-001', 'term-001', 'sound_effects', 'true', '${now}');

    INSERT OR IGNORE INTO suppliers (id, business_id, code, name, company_name, contact_person, phone, email, address, tax_number, payment_terms, credit_limit, opening_balance, current_outstanding, status, notes, created_at, updated_at) VALUES
    ('sup-001', 'biz-001', 'SUP-0001', 'ABC Distributors Ltd', 'ABC Holdings PLC', 'Mohamed Rishad', '+94 77 123 4567', 'orders@abcdistributors.lk', '45 Industrial Zone, Colombo 10', 'VAT-998877', '30 Days', 500000.0, 0.0, 0.0, 'ACTIVE', 'Primary FMCG Supplier', '${now}', '${now}'),
    ('sup-002', 'biz-001', 'SUP-0002', 'Ceylon Wholesale Traders', 'Ceylon Traders Ltd', 'Samantha Perera', '+94 71 987 6543', 'sales@ceylontraders.lk', '12 Main Street, Pettah, Colombo 11', 'VAT-554433', '15 Days', 300000.0, 0.0, 0.0, 'ACTIVE', 'Beverage & Dairy Supplier', '${now}', '${now}'),
    ('sup-003', 'biz-001', 'SUP-0003', 'Lanka Imports & Logistics', 'Lanka Imports Pvt Ltd', 'Kavinda Silva', '+94 11 456 7890', 'info@lankaimports.lk', '88 Port Road, Colombo 13', 'VAT-112233', '30 Days', 750000.0, 0.0, 0.0, 'ACTIVE', 'Electronics & Household Imports', '${now}', '${now}');
  `);
}

export function ensurePermissionsMigrated(db: Database) {
  try {
    const checkRole = db.prepare("SELECT count(*) as cnt FROM roles WHERE id = 'role-sysadmin'");
    let count = 0;
    if (checkRole.step()) {
      count = Number(checkRole.getAsObject().cnt || 0);
    }
    checkRole.free();

    const now = new Date().toISOString();
    if (count === 0) {
      db.run(`
        INSERT OR IGNORE INTO roles (id, name, description, is_system, created_at, updated_at)
        VALUES ('role-sysadmin', 'ADMIN', 'Store Administrator with full administrative access', 1, '${now}', '${now}');
      `);
    }

    const checkRP = db.prepare("SELECT count(*) as cnt FROM role_permissions WHERE role_id = 'role-sysadmin'");
    let rpCount = 0;
    if (checkRP.step()) {
      rpCount = Number(checkRP.getAsObject().cnt || 0);
    }
    checkRP.free();

    if (rpCount === 0) {
      db.run(`
        INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
        ('role-sysadmin', 'p-dash-view'), ('role-sysadmin', 'p-pos-access'), ('role-sysadmin', 'p-orders-view'),
        ('role-sysadmin', 'p-orders-create'), ('role-sysadmin', 'p-orders-edit'), ('role-sysadmin', 'p-orders-cancel'),
        ('role-sysadmin', 'p-orders-void'), ('role-sysadmin', 'p-orders-reopen'), ('role-sysadmin', 'p-pay-view'),
        ('role-sysadmin', 'p-pay-accept'), ('role-sysadmin', 'p-pay-refund'), ('role-sysadmin', 'p-pay-void'),
        ('role-sysadmin', 'p-prod-view'), ('role-sysadmin', 'p-prod-create'), ('role-sysadmin', 'p-prod-edit'),
        ('role-sysadmin', 'p-prod-delete'), ('role-sysadmin', 'p-prod-price'), ('role-sysadmin', 'p-inv-view'),
        ('role-sysadmin', 'p-inv-adjust'), ('role-sysadmin', 'p-purch-view'), ('role-sysadmin', 'p-purch-create'),
        ('role-sysadmin', 'p-purch-receive'), ('role-sysadmin', 'p-cust-view'), ('role-sysadmin', 'p-cust-manage'),
        ('role-sysadmin', 'p-supp-manage'), ('role-sysadmin', 'p-disc-view'), ('role-sysadmin', 'p-disc-apply'),
        ('role-sysadmin', 'p-disc-override'), ('role-sysadmin', 'p-kit-view'), ('role-sysadmin', 'p-kit-status'),
        ('role-sysadmin', 'p-rep-view'), ('role-sysadmin', 'p-rep-fin'), ('role-sysadmin', 'p-rep-export'),
        ('role-sysadmin', 'p-user-view'), ('role-sysadmin', 'p-user-manage'), ('role-sysadmin', 'p-role-view'),
        ('role-sysadmin', 'p-role-manage'), ('role-sysadmin', 'p-set-view'), ('role-sysadmin', 'p-set-manage'),
        ('role-sysadmin', 'p-db-backup'), ('role-sysadmin', 'p-db-restore'), ('role-sysadmin', 'p-audit-view'),
        ('role-sysadmin', 'p-shift-open'), ('role-sysadmin', 'p-shift-close');
      `);
    }

    db.run(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
      ('role-cashier', 'p-pos-access'),
      ('role-cashier', 'p-orders-view'),
      ('role-cashier', 'p-orders-create'),
      ('role-cashier', 'p-pay-view'),
      ('role-cashier', 'p-pay-accept'),
      ('role-cashier', 'p-cust-view'),
      ('role-cashier', 'p-cust-manage'),
      ('role-cashier', 'p-disc-view'),
      ('role-cashier', 'p-disc-apply'),
      ('role-cashier', 'p-shift-open'),
      ('role-cashier', 'p-shift-close');
    `);

    const checkSupp = db.prepare("SELECT count(*) as cnt FROM suppliers");
    let suppCount = 0;
    if (checkSupp.step()) {
      suppCount = Number(checkSupp.getAsObject().cnt || 0);
    }
    checkSupp.free();

    if (suppCount === 0) {
      db.run(`
        INSERT OR IGNORE INTO suppliers (id, business_id, code, name, company_name, contact_person, phone, email, address, tax_number, payment_terms, credit_limit, opening_balance, current_outstanding, status, notes, created_at, updated_at) VALUES
        ('sup-001', 'biz-001', 'SUP-0001', 'ABC Distributors Ltd', 'ABC Holdings PLC', 'Mohamed Rishad', '+94 77 123 4567', 'orders@abcdistributors.lk', '45 Industrial Zone, Colombo 10', 'VAT-998877', '30 Days', 500000.0, 0.0, 0.0, 'ACTIVE', 'Primary FMCG Supplier', '${now}', '${now}'),
        ('sup-002', 'biz-001', 'SUP-0002', 'Ceylon Wholesale Traders', 'Ceylon Traders Ltd', 'Samantha Perera', '+94 71 987 6543', 'sales@ceylontraders.lk', '12 Main Street, Pettah, Colombo 11', 'VAT-554433', '15 Days', 300000.0, 0.0, 0.0, 'ACTIVE', 'Beverage & Dairy Supplier', '${now}', '${now}'),
        ('sup-003', 'biz-001', 'SUP-0003', 'Lanka Imports & Logistics', 'Lanka Imports Pvt Ltd', 'Kavinda Silva', '+94 11 456 7890', 'info@lankaimports.lk', '88 Port Road, Colombo 13', 'VAT-112233', '30 Days', 750000.0, 0.0, 0.0, 'ACTIVE', 'Electronics & Household Imports', '${now}', '${now}');
      `);
    }

    seedAccountingData(db);
  } catch (err) {
    console.error('Failed to sync permissions migration:', err);
  }
}

export function seedAccountingData(db: Database) {
  const now = new Date().toISOString();

  // Create tables if missing (migration safety)
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      account_code TEXT NOT NULL UNIQUE,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      parent_id TEXT REFERENCES accounts(id),
      normal_balance TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_system_account INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      journal_number TEXT NOT NULL UNIQUE,
      transaction_date TEXT NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id TEXT,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'POSTED',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_lines (
      id TEXT PRIMARY KEY,
      journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      module TEXT NOT NULL,
      action_type TEXT DEFAULT 'VIEW',
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS account_mappings (
      id TEXT PRIMARY KEY,
      mapping_key TEXT NOT NULL UNIQUE,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      updated_at TEXT NOT NULL
    );
  `);

  // Seed default Chart of Accounts
  const accountsToSeed = [
    // 1000 ASSETS
    { id: 'acc-1000', code: '1000', name: 'Assets', type: 'ASSET', parentId: null, balance: 'DEBIT', isSystem: 1, desc: 'Root Assets Category' },
    { id: 'acc-1010', code: '1010', name: 'Cash', type: 'ASSET', parentId: 'acc-1000', balance: 'DEBIT', isSystem: 1, desc: 'Physical cash in store register drawer' },
    { id: 'acc-1020', code: '1020', name: 'Bank', type: 'ASSET', parentId: 'acc-1000', balance: 'DEBIT', isSystem: 1, desc: 'Store bank account for transfers & card payouts' },
    { id: 'acc-1030', code: '1030', name: 'Accounts Receivable', type: 'ASSET', parentId: 'acc-1000', balance: 'DEBIT', isSystem: 1, desc: 'Customer credit outstanding balances' },
    { id: 'acc-1040', code: '1040', name: 'Inventory', type: 'ASSET', parentId: 'acc-1000', balance: 'DEBIT', isSystem: 1, desc: 'Total merchandise inventory asset value' },

    // 2000 LIABILITIES
    { id: 'acc-2000', code: '2000', name: 'Liabilities', type: 'LIABILITY', parentId: null, balance: 'CREDIT', isSystem: 1, desc: 'Root Liabilities Category' },
    { id: 'acc-2010', code: '2010', name: 'Accounts Payable', type: 'LIABILITY', parentId: 'acc-2000', balance: 'CREDIT', isSystem: 1, desc: 'Supplier & vendor unpaid bills' },
    { id: 'acc-2020', code: '2020', name: 'Loans Payable', type: 'LIABILITY', parentId: 'acc-2000', balance: 'CREDIT', isSystem: 0, desc: 'Bank or third-party loans' },

    // 3000 EQUITY
    { id: 'acc-3000', code: '3000', name: 'Equity', type: 'EQUITY', parentId: null, balance: 'CREDIT', isSystem: 1, desc: 'Root Equity Category' },
    { id: 'acc-3010', code: '3010', name: 'Owner Capital', type: 'EQUITY', parentId: 'acc-3000', balance: 'CREDIT', isSystem: 1, desc: 'Capital invested by business owner' },
    { id: 'acc-3020', code: '3020', name: 'Owner Drawings', type: 'EQUITY', parentId: 'acc-3000', balance: 'DEBIT', isSystem: 1, desc: 'Drawings & funds withdrawn by owner' },

    // 4000 INCOME
    { id: 'acc-4000', code: '4000', name: 'Income', type: 'INCOME', parentId: null, balance: 'CREDIT', isSystem: 1, desc: 'Root Income Category' },
    { id: 'acc-4010', code: '4010', name: 'Product Sales', type: 'INCOME', parentId: 'acc-4000', balance: 'CREDIT', isSystem: 1, desc: 'Revenue generated from product sales' },
    { id: 'acc-4020', code: '4020', name: 'Other Income', type: 'INCOME', parentId: 'acc-4000', balance: 'CREDIT', isSystem: 0, desc: 'Secondary or miscellaneous income' },
    { id: 'acc-4030', code: '4030', name: 'Sales Returns', type: 'INCOME', parentId: 'acc-4000', balance: 'DEBIT', isSystem: 1, desc: 'Contra income for customer sale refunds' },
    { id: 'acc-4040', code: '4040', name: 'Sales Discounts', type: 'INCOME', parentId: 'acc-4000', balance: 'DEBIT', isSystem: 1, desc: 'Contra income for customer promotional discounts' },

    // 5000 COST OF SALES
    { id: 'acc-5000', code: '5000', name: 'Cost of Sales', type: 'COGS', parentId: null, balance: 'DEBIT', isSystem: 1, desc: 'Root Cost of Goods Sold Category' },
    { id: 'acc-5010', code: '5010', name: 'Cost of Goods Sold', type: 'COGS', parentId: 'acc-5000', balance: 'DEBIT', isSystem: 1, desc: 'Direct product acquisition cost of sold items' },

    // 6000 EXPENSES
    { id: 'acc-6000', code: '6000', name: 'Expenses', type: 'EXPENSE', parentId: null, balance: 'DEBIT', isSystem: 1, desc: 'Root Operating Expenses Category' },
    { id: 'acc-6010', code: '6010', name: 'Rent', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 0, desc: 'Building & premise lease expenses' },
    { id: 'acc-6020', code: '6020', name: 'Electricity', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 0, desc: 'Power & electricity utility costs' },
    { id: 'acc-6030', code: '6030', name: 'Water', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 0, desc: 'Water utility costs' },
    { id: 'acc-6040', code: '6040', name: 'Internet', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 0, desc: 'Broadband & telecommunication costs' },
    { id: 'acc-6050', code: '6050', name: 'Salaries', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 0, desc: 'Staff wages & compensation' },
    { id: 'acc-6060', code: '6060', name: 'Transport', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 0, desc: 'Delivery, freight & travel expenses' },
    { id: 'acc-6070', code: '6070', name: 'Repairs & Maintenance', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 0, desc: 'Equipment repair & store maintenance' },
    { id: 'acc-6080', code: '6080', name: 'Office Expenses', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 0, desc: 'Stationery & administrative office supplies' },
    { id: 'acc-6090', code: '6090', name: 'Marketing', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 0, desc: 'Advertising & store promotion costs' },
    { id: 'acc-6100', code: '6100', name: 'Bank Charges', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 0, desc: 'Bank processing fees & card charges' },
    { id: 'acc-6110', code: '6110', name: 'Other Expenses', type: 'EXPENSE', parentId: 'acc-6000', balance: 'DEBIT', isSystem: 1, desc: 'General miscellaneous operating expenses' },
  ];

  for (const a of accountsToSeed) {
    db.run(
      `INSERT OR IGNORE INTO accounts (id, account_code, account_name, account_type, parent_id, normal_balance, is_active, is_system_account, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [a.id, a.code, a.name, a.type, a.parentId, a.balance, a.isSystem, a.desc, now, now]
    );
  }

  // Seed Account Mappings
  const mappingsToSeed = [
    { key: 'CASH', accountId: 'acc-1010' },
    { key: 'BANK', accountId: 'acc-1020' },
    { key: 'RECEIVABLE', accountId: 'acc-1030' },
    { key: 'INVENTORY', accountId: 'acc-1040' },
    { key: 'PAYABLE', accountId: 'acc-2010' },
    { key: 'OWNER_CAPITAL', accountId: 'acc-3010' },
    { key: 'OWNER_DRAWING', accountId: 'acc-3020' },
    { key: 'SALES', accountId: 'acc-4010' },
    { key: 'OTHER_INCOME', accountId: 'acc-4020' },
    { key: 'SALES_RETURN', accountId: 'acc-4030' },
    { key: 'SALES_DISCOUNT', accountId: 'acc-4040' },
    { key: 'COGS', accountId: 'acc-5010' },
    { key: 'DEFAULT_EXPENSE', accountId: 'acc-6110' },
  ];

  for (const m of mappingsToSeed) {
    db.run(
      `INSERT OR IGNORE INTO account_mappings (id, mapping_key, account_id, updated_at)
       VALUES (?, ?, ?, ?)`,
      [`map-${m.key.toLowerCase()}`, m.key, m.accountId, now]
    );
  }

  // Seed permissions
  const accPerms = [
    { id: 'p-acc-view', name: 'accounting.view', module: 'accounting', action_type: 'VIEW', desc: 'Access accounting module and overview' },
    { id: 'p-acc-coa', name: 'accounting.manage_coa', module: 'accounting', action_type: 'EDIT', desc: 'Manage chart of accounts' },
    { id: 'p-acc-journal', name: 'accounting.post_manual', module: 'accounting', action_type: 'CREATE', desc: 'Post manual journal entries' },
    { id: 'p-acc-void', name: 'accounting.void', module: 'accounting', action_type: 'OVERRIDE', desc: 'Void posted journal entries' },
    { id: 'p-acc-reports', name: 'accounting.reports', module: 'accounting', action_type: 'EXPORT', desc: 'View financial P&L, Trial Balance, Ledger' },
    { id: 'p-acc-settings', name: 'accounting.settings', module: 'accounting', action_type: 'EDIT', desc: 'Configure account mappings and opening balances' },
  ];

  for (const p of accPerms) {
    db.run(
      `INSERT OR IGNORE INTO permissions (id, name, module, action_type, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.module, p.action_type, p.desc, now]
    );

    // Assign permissions to Admin/Superadmin/Accountant roles
    db.run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role-superadmin', '${p.id}')`);
    db.run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role-sysadmin', '${p.id}')`);
    db.run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role-admin', '${p.id}')`);
    db.run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role-accountant', '${p.id}')`);

    if (p.name === 'accounting.view' || p.name === 'accounting.reports') {
      db.run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('role-auditor', '${p.id}')`);
    }
  }
}

