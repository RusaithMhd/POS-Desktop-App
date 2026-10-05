import { create } from 'zustand';
import { ProductEntity } from '@/domain/entities/Product';

export interface CartItem {
  product: ProductEntity;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  currentCredit: number;
  loyaltyPoints: number;
}

export interface HeldSale {
  id: string;
  timestamp: string;
  items: CartItem[];
  customer: Customer | null;
  note?: string;
}

interface CartStore {
  items: CartItem[];
  customer: Customer | null;
  overallDiscountAmount: number;
  notes: string;
  heldSales: HeldSale[];

  addItem: (product: ProductEntity, qty?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateLineDiscount: (productId: string, discount: number) => void;
  updateUnitPrice: (productId: string, price: number) => void;
  removeItem: (productId: string) => void;
  setCustomer: (customer: Customer | null) => void;
  setOverallDiscount: (amount: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
  holdCurrentSale: (note?: string) => void;
  resumeHeldSale: (heldId: string) => void;
  deleteHeldSale: (heldId: string) => void;
  clearAllHeldSales: () => void;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  customer: {
    id: 'cust-001',
    name: 'Walk-in Customer',
    phone: '+1 (000) 000-0000',
    creditLimit: 0,
    currentCredit: 0,
    loyaltyPoints: 0,
  },
  overallDiscountAmount: 0,
  notes: '',
  heldSales: [],

  addItem: (product: ProductEntity, qty = 1) => {
    const { items } = get();
    const existingIndex = items.findIndex((i) => i.product.id === product.id);

    if (existingIndex > -1) {
      const updated = [...items];
      updated[existingIndex].quantity += qty;
      set({ items: updated });
    } else {
      set({
        items: [
          ...items,
          {
            product,
            quantity: qty,
            unitPrice: product.sellingPrice,
            discountAmount: 0,
            taxRate: product.taxRate || 8.0,
          },
        ],
      });
    }
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    const updated = get().items.map((item) =>
      item.product.id === productId ? { ...item, quantity } : item
    );
    set({ items: updated });
  },

  updateLineDiscount: (productId: string, discountAmount: number) => {
    const updated = get().items.map((item) =>
      item.product.id === productId ? { ...item, discountAmount: Math.max(0, discountAmount) } : item
    );
    set({ items: updated });
  },

  updateUnitPrice: (productId: string, price: number) => {
    const updated = get().items.map((item) =>
      item.product.id === productId ? { ...item, unitPrice: Math.max(0, price) } : item
    );
    set({ items: updated });
  },

  removeItem: (productId: string) => {
    set({ items: get().items.filter((i) => i.product.id !== productId) });
  },

  setCustomer: (customer) => set({ customer }),
  setOverallDiscount: (amount) => set({ overallDiscountAmount: Math.max(0, amount) }),
  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({
      items: [],
      overallDiscountAmount: 0,
      notes: '',
      customer: {
        id: 'cust-001',
        name: 'Walk-in Customer',
        phone: '+1 (000) 000-0000',
        creditLimit: 0,
        currentCredit: 0,
        loyaltyPoints: 0,
      },
    }),

  holdCurrentSale: (note?: string) => {
    const { items, customer, heldSales } = get();
    if (items.length === 0) return;
    const newHold: HeldSale = {
      id: `HOLD-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      items: [...items],
      customer,
      note: note || `Held Sale ${heldSales.length + 1}`,
    };
    set({
      heldSales: [newHold, ...heldSales],
      items: [],
      overallDiscountAmount: 0,
      notes: '',
    });
  },

  resumeHeldSale: (heldId: string) => {
    const { heldSales } = get();
    const target = heldSales.find((h) => h.id === heldId);
    if (!target) return;
    set({
      items: target.items,
      customer: target.customer,
      heldSales: heldSales.filter((h) => h.id !== heldId),
    });
  },

  deleteHeldSale: (heldId: string) => {
    set({ heldSales: get().heldSales.filter((h) => h.id !== heldId) });
  },

  clearAllHeldSales: () => {
    set({ heldSales: [] });
  },
}));
