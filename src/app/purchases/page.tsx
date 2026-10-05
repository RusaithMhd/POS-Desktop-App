'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search, Trash2, Calendar, CheckCircle2, AlertCircle, Eye, Tag } from 'lucide-react';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteInventoryBatchRepository, SQLiteSupplierRepository, SQLiteProductRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { SupplierEntity } from '@/domain/entities/Supplier';
import { ProductEntity } from '@/domain/entities/Product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { AuthService } from '@/features/auth/AuthService';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface PurchaseLineItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  supplierBatchNumber: string;
  expiryDate: string;
}

export default function PurchasesPage() {
  return (
    <PermissionGuard permission={['purchasing.view', 'purchasing.create', 'purchasing.receive', 'purchases.manage']} moduleName="Purchase Orders & Batch Receiving">
      <PurchasesContent />
    </PermissionGuard>
  );
}

function PurchasesContent() {
  const batchRepo = new SQLiteInventoryBatchRepository();
  const supplierRepo = new SQLiteSupplierRepository();
  const productRepo = new SQLiteProductRepository();

  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierEntity[]>([]);
  const [products, setProducts] = useState<ProductEntity[]>([]);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);

  // Purchase Entry Form State
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentType, setPaymentType] = useState<'PAID' | 'PARTIAL' | 'CREDIT'>('PAID');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [notes, setNotes] = useState('');

  // Cart Line Items State
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [inputQty, setInputQty] = useState('100');
  const [inputCost, setInputCost] = useState('120.00');
  const [inputSupplierBatch, setInputSupplierBatch] = useState('');
  const [inputExpiry, setInputExpiry] = useState('');

  // Notifications & Pagination
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadPurchasesData();
  }, []);

  const loadPurchasesData = async () => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();

      // Fetch Purchases
      const pStmt = raw.prepare(`
        SELECT p.*, s.name as supplier_name, s.code as supplier_code
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ORDER BY p.created_at DESC
      `);
      const pList: any[] = [];
      while (pStmt.step()) {
        pList.push(pStmt.getAsObject());
      }
      pStmt.free();

      // Fetch Suppliers & Products
      const [sList, prodList] = await Promise.all([
        supplierRepo.getAll(),
        productRepo.getAll(),
      ]);

      setPurchases(pList);
      setSuppliers(sList);
      setProducts(prodList);

      if (sList.length > 0 && !supplierId) setSupplierId(sList[0].id);
      if (prodList.length > 0 && !selectedProductId) {
        setSelectedProductId(prodList[0].id);
        setInputCost(prodList[0].costPrice?.toString() || '100.00');
      }
      if (!invoiceNumber) setInvoiceNumber(`SUP-INV-${Date.now().toString().slice(-6)}`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleProductSelectChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const found = products.find((p) => p.id === prodId);
    if (found) {
      setInputCost(found.costPrice?.toString() || '100.00');
    }
  };

  const handleAddLineItem = () => {
    const found = products.find((p) => p.id === selectedProductId);
    if (!found) return;
    const qty = parseFloat(inputQty);
    const cost = parseFloat(inputCost);

    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid item quantity.');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      setError('Please enter a valid unit cost.');
      return;
    }

    const newItem: PurchaseLineItem = {
      productId: found.id,
      productName: found.name,
      sku: found.sku,
      quantity: qty,
      unitCost: cost,
      supplierBatchNumber: inputSupplierBatch.trim(),
      expiryDate: inputExpiry.trim(),
    };

    setLineItems([...lineItems, newItem]);
    setInputSupplierBatch('');
    setInputExpiry('');
    setError('');
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const totalPurchaseCost = lineItems.reduce((acc, item) => acc + item.quantity * item.unitCost, 0);

  const handleReceiveStockPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Please select a supplier vendor.');
      return;
    }
    if (lineItems.length === 0) {
      setError('Please add at least one product line item to the purchase.');
      return;
    }

    try {
      const user = AuthService.getActiveSession();
      const userId = user?.id || 'Admin';

      let actualPaid = totalPurchaseCost;
      if (paymentType === 'CREDIT') actualPaid = 0;
      else if (paymentType === 'PARTIAL') actualPaid = parseFloat(paidAmount) || 0;

      await batchRepo.createPurchaseWithBatches({
        supplierId,
        invoiceNumber: invoiceNumber.trim() || `SUP-INV-${Date.now().toString().slice(-6)}`,
        branchId: 'branch-001',
        userId,
        items: lineItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          supplierBatchNumber: i.supplierBatchNumber || undefined,
          expiryDate: i.expiryDate || undefined,
        })),
        paidAmount: actualPaid,
        paymentMethod,
        notes,
      });

      setMessage('Stock purchase received successfully! Inventory batches & accounting entries created.');
      setTimeout(() => setMessage(''), 4000);

      setIsFormOpen(false);
      setLineItems([]);
      setNotes('');
      setInvoiceNumber(`SUP-INV-${Date.now().toString().slice(-6)}`);
      await loadPurchasesData();
    } catch (err: any) {
      setError(`Failed to receive purchase: ${err.message}`);
    }
  };

  const openPurchaseDetail = async (p: any) => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const itemsStmt = raw.prepare(`
        SELECT pi.*, pr.name as product_name, pr.sku
        FROM purchase_items pi
        JOIN products pr ON pi.product_id = pr.id
        WHERE pi.purchase_id = :pId
      `);
      itemsStmt.bind({ ':pId': p.id });
      const items: any[] = [];
      while (itemsStmt.step()) {
        items.push(itemsStmt.getAsObject());
      }
      itemsStmt.free();

      // Fetch batch information
      const batchStmt = raw.prepare(`SELECT * FROM inventory_batches WHERE purchase_id = :pId`);
      batchStmt.bind({ ':pId': p.id });
      const batches: any[] = [];
      while (batchStmt.step()) {
        batches.push(batchStmt.getAsObject());
      }
      batchStmt.free();

      setSelectedPurchase({ ...p, items, batches });
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = purchases.filter(
    (p) =>
      p.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (p.supplier_name && p.supplier_name.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedPurchases = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-600" /> Stock Purchase Orders & Batch Receiving
          </h2>
          <p className="text-xs text-slate-500">
            Receive inventory stock from suppliers, record batch costs, track expiry, and automatically generate double-entry ledgers
          </p>
        </div>
        <Button
          onClick={() => { setIsFormOpen(!isFormOpen); setLineItems([]); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> {isFormOpen ? 'Close Receiving Form' : 'Receive New Stock Purchase'}
        </Button>
      </div>

      {/* Notifications */}
      {message && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {message}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600" /> {error}
        </div>
      )}

      {/* Stock Purchase Entry Form */}
      {isFormOpen && (
        <Card className="border-emerald-200 shadow-lg">
          <CardHeader><CardTitle className="text-sm font-bold">New Purchase Receiving Entry</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleReceiveStockPurchase} className="space-y-4 text-xs">
              {/* Header Details */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="font-bold text-slate-700">Supplier Vendor *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Supplier Invoice / PO No. *</label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    required
                    placeholder="SUP-INV-10025"
                    className="mt-1 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Payment Status</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                  >
                    <option value="PAID">Full Payment (Paid)</option>
                    <option value="PARTIAL">Partial Payment</option>
                    <option value="CREDIT">Full Supplier Credit (Unpaid)</option>
                  </select>
                </div>

                {paymentType === 'PARTIAL' && (
                  <div>
                    <label className="font-bold text-slate-700">Paid Amount (LKR)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder="0.00"
                      className="mt-1 font-mono font-bold"
                    />
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                  >
                    <option value="CASH">Cash Drawer</option>
                    <option value="BANK_TRANSFER">Bank Direct Transfer</option>
                  </select>
                </div>
              </div>

              {/* Add Item Builder */}
              <div className="p-3 border border-slate-200 rounded-lg space-y-3 bg-white">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Tag className="h-3.5 w-3.5 text-emerald-600" /> Add Product Items to Batch Receiving Order
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label className="font-semibold text-slate-700">Product</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleProductSelectChange(e.target.value)}
                      className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700">Quantity</label>
                    <Input
                      type="number"
                      value={inputQty}
                      onChange={(e) => setInputQty(e.target.value)}
                      placeholder="100"
                      className="mt-1 font-mono font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700">Unit Cost (LKR)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={inputCost}
                      onChange={(e) => setInputCost(e.target.value)}
                      placeholder="120.00"
                      className="mt-1 font-mono font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700">Supplier Batch #</label>
                    <Input
                      value={inputSupplierBatch}
                      onChange={(e) => setInputSupplierBatch(e.target.value)}
                      placeholder="LOT-ABC-2026"
                      className="mt-1 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Button type="button" onClick={handleAddLineItem} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-9">
                      Add Item
                    </Button>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 p-2.5 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200">
                  <span className="col-span-4">PRODUCT</span>
                  <span className="col-span-2 text-center">QTY</span>
                  <span className="col-span-2 text-right">UNIT COST</span>
                  <span className="col-span-3 text-right">TOTAL COST</span>
                  <span className="col-span-1 text-center">REMOVE</span>
                </div>
                {lineItems.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 font-medium italic">
                    No products added to this purchase order yet.
                  </div>
                ) : (
                  lineItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 p-2.5 items-center border-b border-slate-100 font-mono text-xs">
                      <div className="col-span-4 font-sans">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="text-[10px] text-slate-500">SKU: {item.sku} {item.supplierBatchNumber ? `| Batch: ${item.supplierBatchNumber}` : ''}</div>
                      </div>
                      <span className="col-span-2 text-center font-bold">{item.quantity}</span>
                      <span className="col-span-2 text-right text-slate-700">{formatCurrency(item.unitCost)}</span>
                      <span className="col-span-3 text-right font-bold text-slate-900">{formatCurrency(item.quantity * item.unitCost)}</span>
                      <div className="col-span-1 text-center">
                        <button type="button" onClick={() => handleRemoveLineItem(idx)} className="text-red-600 hover:text-red-800 p-1 cursor-pointer">
                          <Trash2 className="h-4 w-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Grand Total Summary & Submit */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="text-sm font-bold text-slate-900 font-mono">
                  TOTAL PURCHASE COST: <span className="text-emerald-700 font-black text-lg">{formatCurrency(totalPurchaseCost)}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 cursor-pointer">
                    Receive Stock & Create Batches
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search by purchase invoice number or supplier name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="pl-9 bg-white border-slate-200"
        />
      </div>

      {/* Purchase Orders Table */}
      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200">
              <span className="col-span-3">INVOICE NUMBER</span>
              <span className="col-span-3">SUPPLIER</span>
              <span className="col-span-2">DATE</span>
              <span className="col-span-2 text-right">TOTAL (LKR)</span>
              <span className="col-span-2 text-right">ACTION</span>
            </div>
            {paginatedPurchases.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                No purchase orders recorded yet.
              </div>
            ) : (
              paginatedPurchases.map((p) => (
                <div key={p.id} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors">
                  <span className="col-span-3 font-mono font-bold text-slate-900">{p.invoice_number}</span>
                  <div className="col-span-3">
                    <div className="font-bold">{p.supplier_name || 'Supplier Vendor'}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{p.supplier_code}</div>
                  </div>
                  <span className="col-span-2 text-slate-600 font-mono text-[11px]">{new Date(p.created_at).toLocaleDateString()}</span>
                  <span className="col-span-2 text-right font-mono font-bold text-slate-900">{formatCurrency(p.total_amount)}</span>
                  <div className="col-span-2 text-right">
                    <Button onClick={() => openPurchaseDetail(p)} variant="outline" size="sm" className="h-7 text-xs font-bold gap-1 cursor-pointer">
                      <Eye className="h-3.5 w-3.5 text-emerald-600" /> View Order
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          />
        </CardContent>
      </Card>

      {/* PURCHASE DETAIL MODAL */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Purchase Order #{selectedPurchase.invoice_number}</h3>
                <div className="text-xs text-slate-500">Supplier: {selectedPurchase.supplier_name}</div>
              </div>
              <Button onClick={() => setSelectedPurchase(null)} variant="outline" size="sm">Close</Button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded border border-slate-200 font-mono">
                <div>
                  <div className="text-slate-500 font-sans text-[10px]">TOTAL AMOUNT</div>
                  <div className="font-bold text-slate-900 text-sm">{formatCurrency(selectedPurchase.total_amount)}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-sans text-[10px]">PAID AMOUNT</div>
                  <div className="font-bold text-emerald-800 text-sm">{formatCurrency(selectedPurchase.paid_amount)}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-sans text-[10px]">PAYMENT STATUS</div>
                  <Badge className="mt-0.5 bg-emerald-100 text-emerald-800">{selectedPurchase.payment_status}</Badge>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">Purchased Items & Received Batches</h4>
                <div className="border border-slate-200 rounded divide-y divide-slate-100">
                  <div className="grid grid-cols-12 p-2 font-bold text-slate-500 bg-slate-50 text-[11px]">
                    <span className="col-span-5">PRODUCT</span>
                    <span className="col-span-2 text-center">QTY</span>
                    <span className="col-span-2 text-right">UNIT COST</span>
                    <span className="col-span-3 text-right">TOTAL</span>
                  </div>
                  {selectedPurchase.items?.map((item: any) => (
                    <div key={item.id} className="grid grid-cols-12 p-2 items-center font-mono text-[11px]">
                      <span className="col-span-5 font-sans font-bold text-slate-900">{item.product_name}</span>
                      <span className="col-span-2 text-center font-bold">{item.quantity}</span>
                      <span className="col-span-2 text-right">{formatCurrency(item.unit_cost)}</span>
                      <span className="col-span-3 text-right font-bold text-slate-900">{formatCurrency(item.total_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
