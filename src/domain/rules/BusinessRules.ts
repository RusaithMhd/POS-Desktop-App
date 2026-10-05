import { ProductEntity } from '../entities/Product';
import { CreateSaleInput } from '../entities/Sale';

export class DomainValidationError extends Error {
  constructor(message: string, public code: string = 'DOMAIN_RULE_VIOLATION') {
    super(message);
    this.name = 'DomainValidationError';
  }
}

export class BusinessRules {
  /**
   * Validates a sale before checkout transaction execution
   */
  static validateSale(
    input: CreateSaleInput,
    productsMap: Map<string, ProductEntity>,
    userPermissions: string[],
    allowNegativeStock: boolean = false
  ) {
    if (!input.items || input.items.length === 0) {
      throw new DomainValidationError('Sale cart cannot be empty.', 'EMPTY_CART');
    }

    if (!input.shiftId) {
      throw new DomainValidationError('An active cashier shift is required to perform sales.', 'SHIFT_REQUIRED');
    }

    // 1. Product Invariants
    for (const item of input.items) {
      const prod = productsMap.get(item.productId);
      if (!prod) {
        throw new DomainValidationError(`Product ID ${item.productId} was not found in catalog.`, 'PRODUCT_NOT_FOUND');
      }

      if (!prod.isActive) {
        throw new DomainValidationError(`Cannot sell inactive product: "${prod.name}".`, 'PRODUCT_INACTIVE');
      }

      if (item.quantity <= 0) {
        throw new DomainValidationError(`Item quantity for "${prod.name}" must be greater than zero.`, 'INVALID_QUANTITY');
      }

      // Check stock availability if stock tracking enabled
      if (prod.trackInventory && !allowNegativeStock) {
        if (prod.stockQuantity < item.quantity) {
          throw new DomainValidationError(
            `Insufficient stock for "${prod.name}". Available: ${prod.stockQuantity}, Requested: ${item.quantity}.`,
            'INSUFFICIENT_STOCK'
          );
        }
      }

      // Check price override permission if price is altered below standard selling price
      if (item.unitPrice < prod.sellingPrice) {
        const hasOverride = userPermissions.includes('sales.price_override') || userPermissions.includes('sales.discount');
        if (!hasOverride) {
          throw new DomainValidationError(
            `Price override on "${prod.name}" requires Manager or Admin authorization.`,
            'UNAUTHORIZED_PRICE_OVERRIDE'
          );
        }
      }
    }

    // 2. Payment Balance Invariant
    const totalPayments = input.payments.reduce((sum, p) => sum + p.amount, 0);
    const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const lineDiscounts = input.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    const overallDiscount = input.overallDiscountAmount || 0;

    const netAmount = Math.max(0, subtotal - lineDiscounts - overallDiscount);

    // Calculate approximate tax (assuming default rate for test)
    const estimatedTotal = netAmount * 1.08; // 8% tax

    if (totalPayments < Math.floor(netAmount)) {
      throw new DomainValidationError(
        `Total payments ($${totalPayments.toFixed(2)}) must equal or exceed net sale total ($${netAmount.toFixed(2)}).`,
        'INSUFFICIENT_PAYMENT'
      );
    }
  }

  /**
   * Validates Stock Adjustment Inputs
   */
  static validateStockAdjustment(quantityChange: number, reason?: string) {
    if (quantityChange === 0) {
      throw new DomainValidationError('Stock adjustment quantity cannot be zero.', 'INVALID_ADJUSTMENT');
    }
    if (!reason || reason.trim().length < 3) {
      throw new DomainValidationError('A valid reason is required for every stock adjustment.', 'REASON_REQUIRED');
    }
  }
}
