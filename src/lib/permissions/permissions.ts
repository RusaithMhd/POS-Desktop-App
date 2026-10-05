export const PERMISSIONS = {
  SALES_CREATE: 'sales.create',
  SALES_REFUND: 'sales.refund',
  SALES_DISCOUNT: 'sales.discount',
  SALES_PRICE_OVERRIDE: 'sales.price_override',
  INVENTORY_ADJUST: 'inventory.adjust',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_EDIT: 'products.edit',
  REPORTS_VIEW: 'reports.view',
  USERS_MANAGE: 'users.manage',
  SETTINGS_MANAGE: 'settings.manage',
  REGISTER_OPEN: 'cash_register.open',
  REGISTER_CLOSE: 'cash_register.close',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export function hasPermission(userPermissions: string[], permission: PermissionKey): boolean {
  if (userPermissions.includes('*') || userPermissions.includes('all')) return true;
  return userPermissions.includes(permission);
}
