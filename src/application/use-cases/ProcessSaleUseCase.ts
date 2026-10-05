import { CreateSaleInput, SaleEntity } from '@/domain/entities/Sale';
import { BusinessRules } from '@/domain/rules/BusinessRules';
import { IProductRepository, ISaleRepository, IShiftRepository } from '../interfaces/IRepositories';

export class ProcessSaleUseCase {
  constructor(
    private saleRepo: ISaleRepository,
    private productRepo: IProductRepository,
    private shiftRepo: IShiftRepository
  ) {}

  async execute(input: CreateSaleInput, userPermissions: string[]): Promise<SaleEntity> {
    // 1. Verify Active Cashier Shift
    const activeShift = await this.shiftRepo.getActiveShift(input.terminalId);
    if (!activeShift) {
      throw new Error('No open cashier shift found on this terminal. Please open a shift before selling.');
    }
    input.shiftId = activeShift.id;

    // 2. Fetch products to validate inventory & invariants
    const productIds = input.items.map((i) => i.productId);
    const productsMap = new Map();
    for (const pid of productIds) {
      const prod = await this.productRepo.getById(pid);
      if (prod) productsMap.set(pid, prod);
    }

    // 3. Domain Business Rule Validations
    BusinessRules.validateSale(input, productsMap, userPermissions, false);

    // 4. Perform Atomic Sale Checkout Transaction
    return await this.saleRepo.createSaleTransaction(input);
  }
}
