import { ShopSettings } from '@/services/settings/SettingsService';

export interface TaxCalculationResult {
  subtotal: number;
  lineDiscounts: number;
  overallDiscountAmount: number;
  netSubtotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  taxName: string;
  isTaxInclusive: boolean;
}

export function calculateCartTaxAndTotals(
  items: Array<{ unitPrice: number; quantity: number; discountAmount: number; taxRate?: number }>,
  overallDiscountAmount: number = 0,
  settings: ShopSettings
): TaxCalculationResult {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const lineDiscounts = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const netSubtotal = Math.max(0, subtotal - lineDiscounts - overallDiscountAmount);

  const defaultRate = settings.defaultTaxRate !== undefined && !isNaN(settings.defaultTaxRate) ? settings.defaultTaxRate : 0.0;
  const isTaxInclusive = Boolean(settings.isTaxInclusive);
  const taxName = settings.taxName || (defaultRate === 0 ? 'Zero Tax / Exempt' : 'Sales Tax / VAT');

  let totalTaxAmount = 0;
  let grandTotal = 0;

  if (items.length > 0) {
    items.forEach((item) => {
      const lineSub = Math.max(0, item.unitPrice * item.quantity - item.discountAmount);
      const rate = item.taxRate !== undefined && item.taxRate !== null ? item.taxRate : defaultRate;

      if (isTaxInclusive) {
        // Price includes tax: Tax = lineSub - (lineSub / (1 + rate / 100))
        const netLine = lineSub / (1 + rate / 100);
        totalTaxAmount += lineSub - netLine;
      } else {
        // Price excludes tax: Tax = lineSub * (rate / 100)
        totalTaxAmount += lineSub * (rate / 100);
      }
    });

    if (isTaxInclusive) {
      grandTotal = netSubtotal;
    } else {
      grandTotal = netSubtotal + totalTaxAmount;
    }
  }

  return {
    subtotal,
    lineDiscounts,
    overallDiscountAmount,
    netSubtotal,
    taxRate: defaultRate,
    taxAmount: totalTaxAmount,
    grandTotal,
    taxName,
    isTaxInclusive,
  };
}
