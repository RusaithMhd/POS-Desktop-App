'use client';

import React, { useState, useEffect } from 'react';
import { Layers, ShieldCheck, Search, Boxes, Calendar, DollarSign, AlertCircle, RefreshCw, SlidersHorizontal, Plus, Minus, FileText } from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteInventoryRepository, SQLiteProductRepository, SQLiteInventoryBatchRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { InventoryMovementEntity } from '@/domain/entities/InventoryMovement';
import { InventoryBatchEntity } from '@/domain/entities/InventoryBatch';
import { ProductEntity } from '@/domain/entities/Product';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { formatCurrency } from '@/lib/utils';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function InventoryPage() {
  return (
    <PermissionGuard permission={['inventory.view', 'inventory.adjust']} moduleName="Batch-Wise Inventory & Stock Ledger">
      <InventoryContent />
    </PermissionGuard>
  );
}

function InventoryContent() {
  const [activeTab, setActiveTab] = useState<'batches' | 'ledger' | 'price_history'>('batches');
  
  // Data states
  const [batches, setBatches] = useState<InventoryBatchEntity[]>([]);
  const [movements, setMovements] = useState<InventoryMovementEntity[]>([]);
  const [products, setProducts] = useState<ProductEntity[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, string>>(new Map());
  const [valuation, setValuation] = useState<{ totalItems: number; totalQuantity: number; totalValue: number }>({
    totalItems: 0,
    totalQuantity: 0,
    totalValue: 0,
  });

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [priceHistory, setPriceHistory] = useState<any[]>([]);

  // Adjustment Modal state
  const [adjustBatch, setAdjustBatch] = useState<InventoryBatchEntity | null>(null);
  const [adjustQtyChange, setAdjustQtyChange] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('DAMAGED');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const batchRepo = new SQLiteInventoryBatchRepository();
  const invRepo = new SQLiteInventoryRepository();
  const prodRepo = new SQLiteProductRepository();

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      await getLocalDb();
      const [allBatches, recentMovs, prodList, valStats] = await Promise.all([
        batchRepo.getAllActiveBatches(),
        invRepo.getRecentMovements(1000),
        prodRepo.getAll(),
        batchRepo.getInventoryValuation(),
      ]);

      const map = new Map<string, string>();
      prodList.forEach((p) => map.set(p.id, p.name));

      setBatches(allBatches);
      setMovements(recentMovs);
      setProducts(prodList);
      setProductsMap(map);
      setValuation(valStats);

      if (prodList.length > 0 && !selectedProductId) {
        setSelectedProductId(prodList[0].id);
        fetchPriceHistory(prodList[0].id);
      }
    } catch (err) {
      console.error('Failed to load inventory batch data:', err);
    }
  };

  const fetchPriceHistory = async (pId: string) => {
    try {
      const hist = await batchRepo.getProductPriceHistory(pId);
      setPriceHistory(hist);
    } catch (err) {
      console.error('Failed to fetch price history:', err);
    }
  };

  const handleProductSelectForPriceHistory = (pId: string) => {
    setSelectedProductId(pId);
    fetchPriceHistory(pId);
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustBatch) return;

    const qtyChange = parseFloat(adjustQtyChange);
    if (isNaN(qtyChange) || qtyChange === 0) {
      alert('Please enter a valid non-zero quantity change (+ or -).');
      return;
    }

    try {
      setIsSubmittingAdjust(true);
      await batchRepo.adjustBatchStock({
        batchId: adjustBatch.id,
        quantityChange: qtyChange,
        reason: `${adjustReason}: ${adjustNotes}`.trim(),
        userId: 'usr-admin',
      });

      setAdjustBatch(null);
      setAdjustQtyChange('');
      setAdjustNotes('');
      await loadAllData();
    } catch (err: any) {
      alert(`Stock Adjustment Error: ${err.message}`);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Filtered batches
  const filteredBatches = batches.filter((b) => {
    const pName = (b.productName || productsMap.get(b.productId) || '').toLowerCase();
    const bNum = b.batchNumber.toLowerCase();
    const supBatch = (b.supplierBatchNumber || '').toLowerCase();
    const sName = (b.supplierName || '').toLowerCase();
    const q = search.toLowerCase();
    return pName.includes(q) || bNum.includes(q) || supBatch.includes(q) || sName.includes(q);
  });

  // Filtered movements
  const filteredMovements = movements.filter((m) => {
    const prodName = (productsMap.get(m.productId) || m.productId).toLowerCase();
    const type = m.movementType.toLowerCase();
    const q = search.toLowerCase();
    return prodName.includes(q) || type.includes(q) || (m.reason && m.reason.toLowerCase().includes(q));
  });

  const totalPagesBatches = Math.ceil(filteredBatches.length / pageSize) || 1;
  const paginatedBatches = filteredBatches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalPagesLedger = Math.ceil(filteredMovements.length / pageSize) || 1;
  const paginatedMovements = filteredMovements.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-emerald-600" /> Batch-Wise Inventory Management
          </h2>
          <p className="text-xs text-slate-500">Track purchase costs per lot, FIFO stock allocation, batch expiry, and true inventory valuation</p>
        </div>
        <Button variant="outline" onClick={loadAllData} className="gap-2 text-xs font-bold border-slate-300">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Batches
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase">Total Batch Valuation</p>
              <h3 className="text-lg font-bold text-emerald-700 font-mono mt-0.5">{formatCurrency(valuation.totalValue)}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Sum of (Remaining Batch Qty × Cost)</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <DollarSign className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase">Total Stock Units</p>
              <h3 className="text-lg font-bold text-slate-900 font-mono mt-0.5">{valuation.totalQuantity.toLocaleString()} Units</h3>
              <p className="text-[10px] text-slate-400 mt-1">Across all active batches</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <Boxes className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase">Active Batches</p>
              <h3 className="text-lg font-bold text-slate-900 font-mono mt-0.5">{valuation.totalItems} Lots</h3>
              <p className="text-[10px] text-slate-400 mt-1">Available FIFO lots</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <Layers className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase">Low Stock Products</p>
              <h3 className="text-lg font-bold text-amber-600 font-mono mt-0.5">
                {products.filter((p) => p.stockQuantity <= p.minStockLevel).length} Items
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">At or below reorder level</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
              <AlertCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-bold">
        <button
          onClick={() => { setActiveTab('batches'); setCurrentPage(1); }}
          className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'batches' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Boxes className="h-4 w-4" /> Batch-Wise Stock ({filteredBatches.length})
        </button>

        <button
          onClick={() => { setActiveTab('price_history'); }}
          className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'price_history' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="h-4 w-4" /> Purchase Price History
        </button>

        <button
          onClick={() => { setActiveTab('ledger'); setCurrentPage(1); }}
          className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'ledger' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="h-4 w-4" /> Stock Movement Audit Trail ({filteredMovements.length})
        </button>
      </div>

      {/* SEARCH BAR (For Batches & Ledger) */}
      {activeTab !== 'price_history' && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder={activeTab === 'batches' ? "Search batch #, supplier, or product name..." : "Search stock movements by product or type..."}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9 bg-white border-slate-200"
          />
        </div>
      )}

      {/* TAB 1: BATCH-WISE STOCK LIST */}
      {activeTab === 'batches' && (
        <Card className="overflow-hidden border-slate-200 shadow-xs">
          <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Boxes className="h-4 w-4 text-emerald-600" /> Active Inventory Lots (FIFO Sorted)
            </CardTitle>
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
              FIFO Valuation Active
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-12 p-3 text-[11px] font-bold text-slate-500 bg-slate-50">
                <span className="col-span-3">PRODUCT / SKUs</span>
                <span className="col-span-2">BATCH # / SUPPLIER</span>
                <span className="col-span-2 text-right">UNIT COST</span>
                <span className="col-span-1 text-center">REC / REM</span>
                <span className="col-span-2 text-right">BATCH VALUE</span>
                <span className="col-span-2 text-right pr-2">ACTIONS</span>
              </div>
              {paginatedBatches.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-medium">
                  No active inventory batches found. Receive stock via Purchases to build batch lots.
                </div>
              ) : (
                paginatedBatches.map((b) => {
                  const bVal = b.quantityRemaining * b.unitCost;
                  return (
                    <div key={b.id} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors">
                      <div className="col-span-3 font-bold flex flex-col">
                        <span>{b.productName || productsMap.get(b.productId) || b.productId}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{b.productSku || 'SKU N/A'}</span>
                      </div>
                      <div className="col-span-2 font-mono text-[11px]">
                        <div className="font-bold text-slate-800">{b.batchNumber}</div>
                        {b.supplierBatchNumber && <div className="text-[10px] text-slate-400">Ext: {b.supplierBatchNumber}</div>}
                        <div className="text-[10px] text-emerald-700 font-sans font-medium">{b.supplierName || 'Opening Stock'}</div>
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-slate-700">
                        {formatCurrency(b.unitCost)}
                      </div>
                      <div className="col-span-1 text-center font-mono text-xs">
                        <span className="text-slate-400">{b.quantityReceived}</span> / <span className="font-bold text-emerald-700">{b.quantityRemaining}</span>
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-700">
                        {formatCurrency(bVal)}
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAdjustBatch(b);
                            setAdjustQtyChange('');
                            setAdjustNotes('');
                          }}
                          className="h-7 px-2 text-[11px] font-bold border-amber-300 text-amber-700 hover:bg-amber-50 cursor-pointer gap-1"
                        >
                          <SlidersHorizontal className="h-3 w-3" /> Adjust Stock
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPagesBatches}
              totalItems={filteredBatches.length}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            />
          </CardContent>
        </Card>
      )}

      {/* TAB 2: PURCHASE PRICE HISTORY PER PRODUCT */}
      {activeTab === 'price_history' && (
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 px-5 flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" /> Historical Purchase Price Variance by Supplier
            </CardTitle>
            <div className="w-72">
              <select
                value={selectedProductId}
                onChange={(e) => handleProductSelectForPriceHistory(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {priceHistory.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No historical purchase prices recorded for this product.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50">
                  <span className="col-span-3">PURCHASE DATE</span>
                  <span className="col-span-4">SUPPLIER</span>
                  <span className="col-span-3">BATCH NUMBER</span>
                  <span className="col-span-2 text-right">UNIT COST</span>
                </div>
                {priceHistory.map((ph, idx) => (
                  <div key={idx} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50">
                    <div className="col-span-3 font-mono text-[11px] text-slate-600">
                      {new Date(ph.receivedDate).toLocaleDateString()} {new Date(ph.receivedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="col-span-4 font-bold text-slate-800">{ph.supplierName}</div>
                    <div className="col-span-3 font-mono text-slate-500 text-[11px]">{ph.batchNumber}</div>
                    <div className="col-span-2 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(ph.unitCost)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: IMMUTABLE AUDIT LEDGER */}
      {activeTab === 'ledger' && (
        <Card className="overflow-hidden border-slate-200 shadow-xs">
          <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 px-5">
            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Stock Ledger Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50">
                <span className="col-span-4">PRODUCT ITEM</span>
                <span className="col-span-2">MOVEMENT TYPE</span>
                <span className="col-span-2 text-right">QTY CHANGE</span>
                <span className="col-span-2 text-right">NEW BALANCE</span>
                <span className="col-span-2 text-right">TIMESTAMP</span>
              </div>
              {paginatedMovements.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-medium">No inventory movements recorded.</div>
              ) : (
                paginatedMovements.map((m) => (
                  <div key={m.id} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50">
                    <div className="col-span-4 font-bold truncate">
                      {productsMap.get(m.productId) || m.productId}
                      {m.reason && <div className="text-[10px] text-slate-500 font-normal">{m.reason}</div>}
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold border-slate-300">
                        {m.movementType}
                      </Badge>
                    </div>
                    <div className={`col-span-2 text-right font-mono font-bold ${m.quantityChange > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </div>
                    <div className="col-span-2 text-right font-mono font-bold text-slate-900">{m.newQuantity}</div>
                    <div className="col-span-2 text-right text-[10px] text-slate-500">
                      {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPagesLedger}
              totalItems={filteredMovements.length}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            />
          </CardContent>
        </Card>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {adjustBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <Card className="max-w-md w-full border-amber-300 shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-amber-600 text-white py-3 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Batch Stock Adjustment
              </CardTitle>
              <button type="button" onClick={() => setAdjustBatch(null)} className="text-white/80 hover:text-white">
                ✕
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 font-medium text-slate-800">
                <div className="font-bold text-sm text-slate-900">
                  {adjustBatch.productName || productsMap.get(adjustBatch.productId)}
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Batch Number:</span>
                  <span className="font-mono text-slate-900">{adjustBatch.batchNumber}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Current Batch Qty:</span>
                  <span className="font-mono font-bold text-slate-900">{adjustBatch.quantityRemaining} Units</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Unit Purchase Cost:</span>
                  <span className="font-mono font-bold text-emerald-700">{formatCurrency(adjustBatch.unitCost)}</span>
                </div>
              </div>

              <form onSubmit={handleExecuteAdjustment} className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700">Quantity Adjustment (+ / -) *</label>
                  <Input
                    type="number"
                    step="1"
                    value={adjustQtyChange}
                    onChange={(e) => setAdjustQtyChange(e.target.value)}
                    required
                    placeholder="e.g. -3 for damage, or +5 for stock recount"
                    className="mt-1 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Use negative values to reduce stock (e.g. -2) or positive values to increase stock (e.g. 5).</p>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Adjustment Reason *</label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="DAMAGED">DAMAGED - Broken or damaged goods</option>
                    <option value="EXPIRED">EXPIRED - Expired batch lot</option>
                    <option value="LOST">LOST - Missing or stolen stock</option>
                    <option value="COUNTING_ERROR">COUNTING_ERROR - Physical stock count variance</option>
                    <option value="OTHER">OTHER - Other reason</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Detailed Notes / Audit Explanation</label>
                  <Input
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="Enter audit notes or physical inspection details..."
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button type="button" variant="outline" onClick={() => setAdjustBatch(null)} className="text-xs font-semibold">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmittingAdjust} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 cursor-pointer">
                    {isSubmittingAdjust ? 'Processing...' : 'Confirm Stock Adjustment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

