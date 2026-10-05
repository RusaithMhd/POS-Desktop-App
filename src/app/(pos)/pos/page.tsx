'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  User, 
  PauseCircle, 
  PlayCircle, 
  ShieldAlert,
  ShoppingBag,
  Tag,
  X,
  Clock,
  Wifi,
  WifiOff,
  UserPlus,
  Check
} from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteProductRepository, SQLiteShiftRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { ProductEntity, CategoryEntity } from '@/domain/entities/Product';
import { useCartStore } from '@/features/sales/useCartStore';
import { AuthService, UserSession } from '@/features/auth/AuthService';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { DiscountModal } from '@/components/pos/DiscountModal';
import { HeldSalesModal } from '@/components/pos/HeldSalesModal';
import { CustomerModal } from '@/components/pos/CustomerModal';
import { CategoryModal } from '@/components/pos/CategoryModal';
import { defaultSettingsService, ShopSettings, DEFAULT_SHOP_SETTINGS } from '@/services/settings/SettingsService';
import { calculateCartTaxAndTotals } from '@/lib/tax';
import { SaleEntity } from '@/domain/entities/Sale';

// Web Audio API Cashier Scan Feedback Synthesizer
function playScanBeep() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // High C pitch
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    // Ignore audio context errors silently
  }
}

export default function PosCheckoutPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<ProductEntity[]>([]);
  const [categories, setCategories] = useState<CategoryEntity[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isShiftLoading, setIsShiftLoading] = useState(true);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('0862');

  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isHeldSalesOpen, setIsHeldSalesOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<SaleEntity | null>(null);

  const {
    items,
    customer,
    overallDiscountAmount,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    holdCurrentSale,
    resumeHeldSale,
    heldSales,
    setOverallDiscount,
  } = useCartStore();

  useEffect(() => {
    setInvoiceRef(Math.floor(1000 + Math.random() * 9000).toString());
    const session = AuthService.getActiveSession();
    if (!session) {
      router.push('/login');
      return;
    }
    setUserSession(session);
    setIsOnline(navigator.onLine);
    loadInitialData();

    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const loadInitialData = async () => {
    try {
      await getLocalDb();
      const productRepo = new SQLiteProductRepository();
      const shiftRepo = new SQLiteShiftRepository();

      const [prods, cats, shift, loadedSettings] = await Promise.all([
        productRepo.getAll(),
        productRepo.getCategories(),
        shiftRepo.getActiveShift('term-001'),
        defaultSettingsService.getSettings(),
      ]);

      setProducts(prods);
      setCategories(cats);
      setActiveShift(shift);
      setSettings(loadedSettings);
    } catch (err) {
      console.error('Failed to load POS data:', err);
    } finally {
      setIsShiftLoading(false);
    }
  };

  const handleAddItem = (product: ProductEntity) => {
    if (product.stockQuantity <= 0) return;
    addItem(product);
    playScanBeep();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim();
    const exactMatch = products.find((p) => p.barcode === query || p.sku === query);
    if (exactMatch && exactMatch.stockQuantity > 0) {
      handleAddItem(exactMatch);
      setSearchQuery('');
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setIsCustomerModalOpen((prev) => !prev);
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (items.length > 0) holdCurrentSale();
      } else if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'h')) {
        e.preventDefault();
        if (heldSales.length > 0) setIsHeldSalesOpen((prev) => !prev);
      } else if (e.key === 'F6' && items.length > 0) {
        e.preventDefault();
        setIsPaymentOpen(true);
      } else if (e.key === 'F8' || (e.ctrlKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        if (items.length > 0) setIsDiscountOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsPaymentOpen(false);
        setIsDiscountOpen(false);
        setIsHeldSalesOpen(false);
        setIsCustomerModalOpen(false);
        setCompletedSale(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, heldSales, holdCurrentSale]);

  const filteredProducts = products.filter((p) => {
    const matchesCat = !selectedCategory || p.categoryId === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q));
    return matchesCat && matchesQuery;
  });

  const cartTotals = calculateCartTaxAndTotals(items, overallDiscountAmount, settings);
  const { subtotal, lineDiscounts, taxAmount, grandTotal, taxName, isTaxInclusive, taxRate } = cartTotals;

  return (
    <div className="h-full flex flex-col bg-slate-100 font-sans overflow-hidden select-none text-slate-900">
      {/* 1. POS HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shrink-0 shadow-2xs">
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Point of Sale</h1>
          <p className="text-[11px] text-slate-500 font-bold mt-0.5">{settings.businessName} — Main Terminal</p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* Shift Register Status */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
            <span className={`h-2 w-2 rounded-full ${activeShift ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span>{activeShift ? 'Register Open' : 'Register Closed'}</span>
          </div>

          {/* Sync Connection Status */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold">
            {isOnline ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                <span>Server Synced</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                <span>Offline Mode</span>
              </>
            )}
          </div>

          {/* Cashier Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900 text-white font-bold">
            <User className="h-3.5 w-3.5 text-amber-400" />
            <span>{userSession?.fullName || 'Alexander Pierce'}</span>
          </div>

          {/* Digital Clock */}
          <div className="hidden md:flex items-center gap-1 text-slate-500 font-mono font-bold text-xs pl-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{currentTime || '12:29:40'}</span>
          </div>
        </div>
      </header>

      {/* Register Closed Guard Banner */}
      {!isShiftLoading && !activeShift && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-amber-900 text-xs font-bold shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            <span>CASH REGISTER IS CLOSED: Open a shift register to allow customer checkout transactions.</span>
          </div>
          <Button size="sm" onClick={() => router.push('/shifts')} className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-7 text-xs cursor-pointer">
            Open Cash Register
          </Button>
        </div>
      )}

      {/* 2. POS MAIN WORKING AREA (3-COLUMN GRID) */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: SEARCH + CATEGORIES + PRODUCT GRID (8 COLS) */}
        <div className="col-span-8 flex flex-col h-full border-r border-slate-200 bg-slate-100 overflow-hidden">
          
          {/* PROMINENT SEARCH BAR [F1] */}
          <div className="p-3 bg-white border-b border-slate-200 shrink-0">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, SKU or scan barcode... [F1]"
                  className="pl-11 pr-10 h-11 bg-slate-50 border-slate-300 text-slate-900 text-sm font-bold focus:bg-white transition-all rounded-xl shadow-2xs"
                />
                <Barcode className="absolute right-3.5 top-3 h-5 w-5 text-slate-400 opacity-60" />
              </div>
              {searchQuery && (
                <Button type="button" variant="outline" onClick={() => setSearchQuery('')} className="h-11 font-bold">
                  Clear
                </Button>
              )}
            </form>
          </div>

          {/* COMPACT HORIZONTAL CATEGORY NAVIGATION */}
          <div className="bg-white border-b border-slate-200 py-2 px-3 flex gap-1.5 overflow-x-auto shrink-0 select-none no-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === null
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer flex items-center gap-1"
            >
              + Category
            </button>
          </div>

          {/* SPEED-OPTIMIZED PRODUCT CARDS GRID */}
          <div className="flex-1 p-3 overflow-y-auto min-h-0">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stockQuantity <= 0;
                const isLowStock = p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel;
                const cartItem = items.find((i) => i.product.id === p.id);
                const quantityInCart = cartItem ? cartItem.quantity : 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleAddItem(p)}
                    className={`bg-white border rounded-xl p-3.5 flex flex-col justify-between text-left transition-all duration-150 relative select-none ${
                      isOutOfStock
                        ? 'opacity-50 border-slate-200 bg-slate-50 cursor-not-allowed'
                        : quantityInCart > 0
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm cursor-pointer active:scale-98'
                        : 'border-slate-200 hover:border-emerald-400 hover:shadow-md cursor-pointer active:scale-98'
                    }`}
                  >
                    {/* Quantity In Cart Indicator Badge */}
                    {quantityInCart > 0 && (
                      <div className="absolute -top-2 -right-2 bg-emerald-600 text-white text-[10px] font-black h-5 px-1.5 rounded-full flex items-center justify-center shadow-sm font-mono border-2 border-white">
                        {quantityInCart} in cart
                      </div>
                    )}

                    <div>
                      {/* Top Row: SKU & Stock Level */}
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-mono text-slate-400 font-bold tracking-tight">{p.sku}</span>
                        {isOutOfStock ? (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-extrabold uppercase">
                            OUT OF STOCK
                          </Badge>
                        ) : isLowStock ? (
                          <span className="text-[10px] font-bold text-amber-600 font-mono">
                            Stock: {p.stockQuantity}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            Stock: {p.stockQuantity}
                          </span>
                        )}
                      </div>

                      {/* Product Name */}
                      <h4 className="font-extrabold text-xs text-slate-900 line-clamp-2 leading-snug">
                        {p.name}
                      </h4>
                    </div>

                    {/* Bottom Row: Price & Quick Plus Button */}
                    <div className="mt-3 flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className="text-sm font-black text-slate-900 font-mono">
                        {formatCurrency(p.sellingPrice)}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        disabled={isOutOfStock}
                        className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white font-black text-xs shrink-0 transition-colors"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CURRENT SALE CART & PAYMENT CTA (4 COLS) */}
        <div className="col-span-4 bg-white flex flex-col h-full border-l border-slate-200 overflow-hidden">
          
          {/* CART HEADER */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div>
              <div className="font-black text-xs text-slate-900 tracking-wider uppercase flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                <span>CURRENT SALE ({items.reduce((a, b) => a + b.quantity, 0)})</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">#INV-2026-{invoiceRef}</div>
            </div>
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-600 hover:underline font-bold cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* CUSTOMER SELECTOR STRIP */}
          <div className="p-2 border-b border-slate-200 bg-slate-100 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold truncate">
              <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{customer?.name || 'Walk-in Customer'}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCustomerModalOpen(true)}
              className="h-6 text-[10px] font-bold px-2 text-slate-700 bg-white hover:bg-slate-50 border-slate-300 cursor-pointer"
            >
              <UserPlus className="h-3 w-3 mr-1" /> Customer [F2]
            </Button>
          </div>

          {/* CART ITEMS LIST */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 min-h-0">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 p-6 text-center">
                <div className="p-4 rounded-full bg-slate-50 border border-slate-200">
                  <ShoppingBag className="h-10 w-10 text-slate-300 stroke-[1.5]" />
                </div>
                <p className="text-xs font-bold text-slate-600">Cart is empty</p>
                <p className="text-[11px] text-slate-400 max-w-[200px]">Click products or scan barcode to add items to current sale</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.product.id} className="p-2 space-y-1.5 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-extrabold text-xs text-slate-900 leading-snug">{item.product.name}</div>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="text-[11px] text-slate-500 font-mono">
                      {formatCurrency(item.unitPrice)} × {item.quantity}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-slate-300 rounded-md bg-white overflow-hidden shadow-2xs">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="h-6 w-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                          className="w-8 text-center text-xs font-bold font-mono focus:outline-hidden"
                        />
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="h-6 w-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <div className="font-extrabold text-slate-900 font-mono text-xs w-20 text-right">
                        {formatCurrency(item.unitPrice * item.quantity - item.discountAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* QUICK ACTIONS STRIP */}
          <div className="p-2 border-t border-slate-200 bg-slate-50 flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={items.length === 0}
              onClick={() => holdCurrentSale()}
              className="flex-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200 cursor-pointer"
            >
              <PauseCircle className="h-3.5 w-3.5 mr-1" /> Hold [F4]
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={items.length === 0}
              onClick={() => setIsDiscountOpen(true)}
              className={`flex-1 text-[11px] font-bold cursor-pointer ${
                overallDiscountAmount > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'text-slate-700 bg-white hover:bg-slate-100 border-slate-300'
              }`}
            >
              <Tag className="h-3.5 w-3.5 mr-1" />
              {overallDiscountAmount > 0 ? `-${formatCurrency(overallDiscountAmount)}` : 'Discount [F8]'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={heldSales.length === 0}
              onClick={() => setIsHeldSalesOpen(true)}
              className="flex-1 text-[11px] font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer"
            >
              <PlayCircle className="h-3.5 w-3.5 mr-1" /> Held ({heldSales.length}) [F5]
            </Button>
          </div>

          {/* TOTALS SUMMARY SECTION */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-1.5 font-mono text-xs text-slate-600 shrink-0">
            <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
            {lineDiscounts > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Line Discount:</span><span>-{formatCurrency(lineDiscounts)}</span></div>
            )}
            {overallDiscountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span className="flex items-center gap-1 font-sans">
                  <span>Order Discount:</span>
                  <button onClick={() => setOverallDiscount(0)} className="text-[10px] text-red-600 hover:underline cursor-pointer">(Remove)</button>
                </span>
                <span>-{formatCurrency(overallDiscountAmount)}</span>
              </div>
            )}
            {settings.showTaxOnPos && (
              <div className="flex justify-between text-slate-500">
                <span>{taxName}{taxRate > 0 ? ` (${taxRate}%)` : ''}{taxRate > 0 && isTaxInclusive ? ' [Incl]' : ''}:</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-black text-slate-900 pt-2 border-t border-slate-300">
              <span className="font-sans font-black">TOTAL:</span>
              <span className="text-emerald-600 font-mono font-black">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* DOMINANT PAY NOW CTA BUTTON */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <Button
              disabled={items.length === 0 || !activeShift}
              onClick={() => setIsPaymentOpen(true)}
              className="w-full h-13 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>PAY NOW ({formatCurrency(grandTotal)})</span>
              <span className="text-xs bg-emerald-700 px-2 py-0.5 rounded font-mono">[F6]</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Customer Selector Modal [F2] */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
      />

      {/* Held Sales Manager Modal [F5] */}
      <HeldSalesModal
        isOpen={isHeldSalesOpen}
        onClose={() => setIsHeldSalesOpen(false)}
        onSelectResume={(heldId) => resumeHeldSale(heldId)}
      />

      {/* Discount Manager Modal [F8] */}
      <DiscountModal
        isOpen={isDiscountOpen}
        onClose={() => setIsDiscountOpen(false)}
        subtotal={subtotal - lineDiscounts}
        currentDiscount={overallDiscountAmount}
        onApplyDiscount={(amount) => setOverallDiscount(amount)}
      />

      {/* Payment Checkout Modal [F6] */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={(sale) => {
          setIsPaymentOpen(false);
          setCompletedSale(sale);
          loadInitialData();
        }}
      />

      {/* Category Manager Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesUpdated={loadInitialData}
      />

      {/* Thermal Receipt Modal */}
      <ReceiptModal
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />
    </div>
  );
}
