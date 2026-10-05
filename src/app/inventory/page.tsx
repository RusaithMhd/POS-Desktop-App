'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Boxes,
  Layers,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  Plus,
  Minus,
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Calendar,
  ShieldCheck,
  Clock,
  ArrowRight,
  X,
  AlertCircle,
  Eye,
  Truck,
  Info,
  Check,
  RotateCcw,
} from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import {
  SQLiteInventoryRepository,
  SQLiteProductRepository,
  SQLiteInventoryBatchRepository,
  SQLiteSupplierRepository,
} from '@/infrastructure/repositories/SQLiteRepositories';
import { InventoryMovementEntity } from '@/domain/entities/InventoryMovement';
import { InventoryBatchEntity } from '@/domain/entities/InventoryBatch';
import { ProductEntity } from '@/domain/entities/Product';
import { SupplierEntity } from '@/domain/entities/Supplier';
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Repositories
  const batchRepo = new SQLiteInventoryBatchRepository();
  const invRepo = new SQLiteInventoryRepository();
  const prodRepo = new SQLiteProductRepository();
  const supplierRepo = new SQLiteSupplierRepository();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<'batches' | 'ledger' | 'price_history'>('batches');

  // Core Data States
  const [batches, setBatches] = useState<InventoryBatchEntity[]>([]);
  const [movements, setMovements] = useState<InventoryMovementEntity[]>([]);
  const [products, setProducts] = useState<ProductEntity[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierEntity[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, ProductEntity>>(new Map());
  const [valuation, setValuation] = useState<{ totalItems: number; totalQuantity: number; totalValue: number }>({
    totalItems: 0,
    totalQuantity: 0,
    totalValue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [batchTypeFilter, setBatchTypeFilter] = useState('');

  // Row Expansion State
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // Price History Tab State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [priceHistory, setPriceHistory] = useState<any[]>([]);

  // Adjustment Modal State
  const [adjustBatch, setAdjustBatch] = useState<InventoryBatchEntity | null>(null);
  const [adjustQtyInput, setAdjustQtyInput] = useState<number>(1);
  const [adjustDirection, setAdjustDirection] = useState<'REDUCE' | 'ADD'>('REDUCE');
  const [adjustReason, setAdjustReason] = useState<string>('Damaged Stock');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Audit Feedback Modal State
  const [auditFeedback, setAuditFeedback] = useState<{
    productName: string;
    batchNumber: string;
    previousQty: number;
    newQty: number;
    delta: number;
    reason: string;
    notes?: string;
    timestamp: string;
  } | null>(null);

  // Three-dot Dropdown State per row
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadAllData();

    // Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setAdjustBatch(null);
        setAuditFeedback(null);
        setOpenMenuId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const [allBatches, recentMovs, prodList, supList, valStats] = await Promise.all([
        batchRepo.getAllActiveBatches(),
        invRepo.getRecentMovements(1000),
        prodRepo.getAll(),
        supplierRepo.getAll(),
        batchRepo.getInventoryValuation(),
      ]);

      const map = new Map<string, ProductEntity>();
      prodList.forEach((p) => map.set(p.id, p));

      setBatches(allBatches);
      setMovements(recentMovs);
      setProducts(prodList);
      setSuppliers(supList);
      setProductsMap(map);
      setValuation(valStats);

      if (prodList.length > 0 && !selectedProductId) {
        setSelectedProductId(prodList[0].id);
        fetchPriceHistory(prodList[0].id);
      }
    } catch (err) {
      console.error('Failed to load inventory batch data:', err);
    } finally {
      setIsLoading(false);
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

  // Open Controlled Adjustment Modal
  const openStockAdjustmentModal = (batch: InventoryBatchEntity) => {
    setAdjustBatch(batch);
    setAdjustQtyInput(1);
    setAdjustDirection('REDUCE');
    setAdjustReason('Damaged Stock');
    setAdjustNotes('');
    setOpenMenuId(null);
  };

  // Execute Stock Adjustment with Full Audit Trail
  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustBatch) return;

    const deltaQuantity = adjustDirection === 'REDUCE' ? -Math.abs(adjustQtyInput) : Math.abs(adjustQtyInput);
    if (isNaN(deltaQuantity) || deltaQuantity === 0) {
      alert('Please enter a valid non-zero adjustment quantity.');
      return;
    }

    // Validation: Check against current stock for reduction
    if (deltaQuantity < 0 && Math.abs(deltaQuantity) > adjustBatch.quantityRemaining) {
      alert(`Insufficient Stock! Available batch stock is ${adjustBatch.quantityRemaining} units.`);
      return;
    }

    const prevQty = adjustBatch.quantityRemaining;
    const newQty = prevQty + deltaQuantity;

    try {
      setIsSubmittingAdjust(true);
      await batchRepo.adjustBatchStockDetailed({
        batchId: adjustBatch.id,
        productId: adjustBatch.productId,
        adjustmentType:
          adjustReason === 'Damaged Stock'
            ? 'DAMAGE'
            : adjustReason === 'Expired Lot'
            ? 'EXPIRED'
            : adjustReason === 'Missing Stock'
            ? 'MISSING'
            : adjustReason === 'Stock Count Correction'
            ? 'CORRECTION'
            : deltaQuantity > 0
            ? 'INCREASE'
            : 'DECREASE',
        quantity: Math.abs(deltaQuantity),
        reason: `${adjustReason}${adjustNotes ? ` - ${adjustNotes}` : ''}`,
        notes: adjustNotes || undefined,
        userId: 'usr-admin',
      });

      // Set audit success feedback modal
      const prodName = adjustBatch.productName || productsMap.get(adjustBatch.productId)?.name || adjustBatch.productId;
      setAuditFeedback({
        productName: prodName,
        batchNumber: adjustBatch.batchNumber,
        previousQty: prevQty,
        newQty,
        delta: deltaQuantity,
        reason: adjustReason,
        notes: adjustNotes || undefined,
        timestamp: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
      });

      setAdjustBatch(null);
      await loadAllData();
    } catch (err: any) {
      alert(`Stock Adjustment Error: ${err.message}`);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setQuickFilter('ALL');
    setCategoryFilter('');
    setSupplierFilter('');
    setStockStatusFilter('');
    setExpiryFilter('');
    setBatchTypeFilter('');
    setCurrentPage(1);
  };

  // Compute FIFO order and priority labels
  const batchesWithFifoPriority = [...batches].sort(
    (a, b) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime()
  );
  const oldestBatch = batchesWithFifoPriority.find((b) => b.quantityRemaining > 0);

  // Compute Attention Required metrics
  const now = new Date();
  const lowStockCount = products.filter((p) => p.stockQuantity <= p.minStockLevel).length;
  const expiredBatchesCount = batches.filter((b) => b.expiryDate && new Date(b.expiryDate) < now).length;
  const nearExpiryCount = batches.filter((b) => {
    if (!b.expiryDate) return false;
    const exp = new Date(b.expiryDate);
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length;

  const totalAttentionCount = lowStockCount + expiredBatchesCount + nearExpiryCount;

  // Filtered Batches
  const filteredBatches = batchesWithFifoPriority.filter((b) => {
    const prodObj = productsMap.get(b.productId);
    const pName = (b.productName || prodObj?.name || '').toLowerCase();
    const pSku = (b.sku || prodObj?.sku || '').toLowerCase();
    const bNum = b.batchNumber.toLowerCase();
    const supBatch = (b.supplierBatchNumber || '').toLowerCase();
    const sName = (b.supplierName || '').toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch = pName.includes(q) || pSku.includes(q) || bNum.includes(q) || supBatch.includes(q) || sName.includes(q);

    // Quick Filter Pills
    let matchesQuick = true;
    if (quickFilter === 'LOW_STOCK') matchesQuick = prodObj ? prodObj.stockQuantity <= prodObj.minStockLevel : false;
    else if (quickFilter === 'EXPIRING_SOON') {
      if (!b.expiryDate) matchesQuick = false;
      else {
        const diff = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 3600 * 24));
        matchesQuick = diff >= 0 && diff <= 30;
      }
    } else if (quickFilter === 'EXPIRED') {
      matchesQuick = b.expiryDate ? new Date(b.expiryDate) < now : false;
    } else if (quickFilter === 'OUT_OF_STOCK') matchesQuick = b.quantityRemaining <= 0;
    else if (quickFilter === 'OPENING_STOCK') matchesQuick = b.batchNumber.startsWith('OPENING');
    else if (quickFilter === 'ACTIVE') matchesQuick = b.status === 'ACTIVE' && b.quantityRemaining > 0;
    else if (quickFilter === 'ATTENTION') {
      const isExp = b.expiryDate ? new Date(b.expiryDate) < now : false;
      const isNear = b.expiryDate
        ? Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 3600 * 24)) <= 30
        : false;
      const isLow = prodObj ? prodObj.stockQuantity <= prodObj.minStockLevel : false;
      matchesQuick = isExp || isNear || isLow;
    }

    // Dropdown filters
    const matchesCategory = !categoryFilter || prodObj?.categoryId === categoryFilter;
    const matchesSupplier = !supplierFilter || b.supplierId === supplierFilter;

    let matchesStockStatus = true;
    if (stockStatusFilter === 'LOW_STOCK') matchesStockStatus = prodObj ? prodObj.stockQuantity <= prodObj.minStockLevel : false;
    else if (stockStatusFilter === 'OUT_OF_STOCK') matchesStockStatus = b.quantityRemaining <= 0;
    else if (stockStatusFilter === 'ACTIVE') matchesStockStatus = b.quantityRemaining > 0;

    let matchesExpiryDropdown = true;
    if (expiryFilter === 'EXPIRED') matchesExpiryDropdown = b.expiryDate ? new Date(b.expiryDate) < now : false;
    else if (expiryFilter === 'NEAR_EXPIRY') {
      if (!b.expiryDate) matchesExpiryDropdown = false;
      else {
        const diff = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 3600 * 24));
        matchesExpiryDropdown = diff >= 0 && diff <= 30;
      }
    }

    let matchesBatchType = true;
    if (batchTypeFilter === 'OPENING') matchesBatchType = b.batchNumber.startsWith('OPENING');
    else if (batchTypeFilter === 'PURCHASE') matchesBatchType = !b.batchNumber.startsWith('OPENING');

    return (
      matchesSearch &&
      matchesQuick &&
      matchesCategory &&
      matchesSupplier &&
      matchesStockStatus &&
      matchesExpiryDropdown &&
      matchesBatchType
    );
  });

  // Filtered Movements
  const filteredMovements = movements.filter((m) => {
    const prodObj = productsMap.get(m.productId);
    const prodName = (prodObj?.name || m.productId).toLowerCase();
    const type = m.movementType.toLowerCase();
    const q = search.toLowerCase();
    return prodName.includes(q) || type.includes(q) || (m.reason && m.reason.toLowerCase().includes(q));
  });

  const totalPagesBatches = Math.ceil(filteredBatches.length / pageSize) || 1;
  const paginatedBatches = filteredBatches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalPagesLedger = Math.ceil(filteredMovements.length / pageSize) || 1;
  const paginatedMovements = filteredMovements.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Helper: Format FIFO priority rank
  const getFifoPriorityBadge = (batch: InventoryBatchEntity) => {
    const idx = batchesWithFifoPriority.findIndex((b) => b.id === batch.id);
    if (idx === 0) return { label: '① Oldest', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold' };
    if (idx === 1) return { label: '② Next', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
    if (idx === 2) return { label: '③ Next', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    return { label: `④ Lot #${idx + 1}`, bg: 'bg-slate-50 text-slate-500 border-slate-200' };
  };

  // Helper: Format Batch Status
  const getBatchStatusBadge = (batch: InventoryBatchEntity) => {
    const expDate = batch.expiryDate ? new Date(batch.expiryDate) : null;
    const isExpired = expDate && expDate < now;
    const isNearExpiry = expDate && Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24)) <= 30;

    if (batch.quantityRemaining <= 0) return { label: '● Depleted', color: 'text-slate-500 bg-slate-100 border-slate-200' };
    if (isExpired) return { label: '● Expired', color: 'text-red-700 bg-red-50 border-red-200 font-bold' };
    if (isNearExpiry) return { label: '● Expiring Soon', color: 'text-amber-800 bg-amber-50 border-amber-300 font-bold' };
    return { label: '● Active', color: 'text-emerald-700 bg-emerald-50 border-emerald-200 font-medium' };
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 font-sans bg-slate-50 min-h-screen text-slate-900">
      {/* 2. COMPACT PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-emerald-600" /> Batch-Wise Inventory Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track purchase costs per lot, FIFO stock allocation, batch expiry, and true inventory valuation.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadAllData}
          disabled={isLoading}
          className="gap-2 text-xs font-bold border-slate-300 bg-white hover:bg-slate-50 text-slate-700 h-8 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-emerald-600 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Batches
        </Button>
      </div>

      {/* 3. CLICKABLE ACTIONABLE SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* CARD 1: INVENTORY VALUE */}
        <div
          onClick={handleResetFilters}
          className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">INVENTORY VALUE</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg font-bold text-slate-900 font-mono">{formatCurrency(valuation.totalValue)}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Remaining stock value</p>
          </div>
        </div>

        {/* CARD 2: STOCK ON HAND */}
        <div
          onClick={() => { setQuickFilter('ACTIVE'); setCurrentPage(1); }}
          className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">STOCK ON HAND</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg font-bold text-slate-900 font-mono">{valuation.totalQuantity.toLocaleString()} Units</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Across {valuation.totalItems} active lots</p>
          </div>
        </div>

        {/* CARD 3: ACTIVE FIFO LOTS */}
        <div
          onClick={() => { setQuickFilter('ALL'); setCurrentPage(1); }}
          className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs hover:border-indigo-400 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ACTIVE FIFO LOTS</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg font-bold text-slate-900 font-mono">{valuation.totalItems} Lots</h3>
            <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
              Next consumption: <strong className="text-emerald-700">{oldestBatch ? oldestBatch.batchNumber : 'None'}</strong>
            </p>
          </div>
        </div>

        {/* CARD 4: ATTENTION REQUIRED */}
        <div
          onClick={() => {
            if (totalAttentionCount > 0) {
              setQuickFilter('ATTENTION');
              setCurrentPage(1);
            }
          }}
          className={`p-4 rounded-lg border shadow-2xs transition-all flex flex-col justify-between ${
            totalAttentionCount > 0
              ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400 cursor-pointer'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ATTENTION REQUIRED</span>
            <div className={`p-1.5 rounded-md ${totalAttentionCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-600'}`}>
              {totalAttentionCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </div>
          </div>
          <div className="mt-2">
            {totalAttentionCount > 0 ? (
              <>
                <h3 className="text-lg font-bold text-amber-900 font-mono">{totalAttentionCount} Items</h3>
                <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                  {lowStockCount > 0 && `${lowStockCount} low stock `}
                  {expiredBatchesCount > 0 && `${expiredBatchesCount} expired `}
                  {nearExpiryCount > 0 && `${nearExpiryCount} near expiry`}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xs font-bold text-emerald-800 flex items-center gap-1 mt-1">
                  <Check className="h-4 w-4 text-emerald-600" /> Healthy Inventory
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">All active inventory currently healthy</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. INVENTORY SECTION NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 pt-2 rounded-t-lg text-xs font-bold">
        <button
          onClick={() => { setActiveTab('batches'); setCurrentPage(1); }}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'batches' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-md' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Boxes className="h-4 w-4 text-emerald-600" /> Batch Stock
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700">
            {filteredBatches.length}
          </Badge>
        </button>

        <button
          onClick={() => { setActiveTab('price_history'); }}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'price_history' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-md' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="h-4 w-4 text-blue-600" /> Purchase Price History
        </button>

        <button
          onClick={() => { setActiveTab('ledger'); setCurrentPage(1); }}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'ledger' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-md' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-indigo-600" /> Stock Movement Audit
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700">
            {filteredMovements.length}
          </Badge>
        </button>
      </div>

      {/* TAB 1: BATCH-WISE STOCK WORKSPACE */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {/* 5. FIFO QUEUE "NEXT BATCH TO CONSUME" STATUS BANNER */}
          {oldestBatch && (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-md font-extrabold text-xs shrink-0">
                  FIFO QUEUE
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {oldestBatch.productName || productsMap.get(oldestBatch.productId)?.name || oldestBatch.productId}
                    </span>
                    <Badge variant="outline" className="border-emerald-400 text-emerald-800 bg-emerald-100 text-[10px] font-mono">
                      ① Oldest Batch
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono mt-0.5 flex items-center gap-3">
                    <span>Batch Number: <strong className="text-slate-900">{oldestBatch.batchNumber}</strong></span>
                    <span>• Supplier: <strong>{oldestBatch.supplierName || 'Opening Stock'}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Usable Quantity</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">{oldestBatch.quantityRemaining} Units</span>
                </div>
                <div className="border-l border-emerald-200 pl-4">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Unit Cost</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{formatCurrency(oldestBatch.unitCost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 6 & 7. SEARCH & QUICK FILTERS TOOLBAR */}
          <Card className="border-slate-200 shadow-2xs bg-white">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[280px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search product name, SKU, batch number, or supplier... (Press '/' to focus)"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="pl-9 bg-white border-slate-200 text-xs"
                  />
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Showing <strong className="text-slate-900">{filteredBatches.length}</strong> batches
                </div>
              </div>

              {/* Quick Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Quick Filters:</span>
                {[
                  { id: 'ALL', label: 'ALL' },
                  { id: 'ACTIVE', label: 'ACTIVE LOTS' },
                  { id: 'LOW_STOCK', label: 'LOW STOCK' },
                  { id: 'EXPIRING_SOON', label: 'EXPIRING SOON' },
                  { id: 'EXPIRED', label: 'EXPIRED' },
                  { id: 'OUT_OF_STOCK', label: 'OUT OF STOCK' },
                  { id: 'OPENING_STOCK', label: 'OPENING STOCK' },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => { setQuickFilter(pill.id); setCurrentPage(1); }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                      quickFilter === pill.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Dropdown Filters Row */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                  className="h-8 px-2 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700"
                >
                  <option value="">Category: All</option>
                  {Array.from(new Set(products.map((p) => p.categoryId).filter((id): id is string => Boolean(id)))).map((catId) => (
                    <option key={catId} value={catId}>
                      Category #{catId}
                    </option>
                  ))}
                </select>

                <select
                  value={supplierFilter}
                  onChange={(e) => { setSupplierFilter(e.target.value); setCurrentPage(1); }}
                  className="h-8 px-2 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700"
                >
                  <option value="">Supplier: All</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>

                <select
                  value={stockStatusFilter}
                  onChange={(e) => { setStockStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="h-8 px-2 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700"
                >
                  <option value="">Stock Status: All</option>
                  <option value="ACTIVE font-bold">Active Stock</option>
                  <option value="LOW_STOCK">Low Stock Warning</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>

                <select
                  value={expiryFilter}
                  onChange={(e) => { setExpiryFilter(e.target.value); setCurrentPage(1); }}
                  className="h-8 px-2 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700"
                >
                  <option value="">Expiry: All</option>
                  <option value="NEAR_EXPIRY">Expiring Soon (&lt; 30 Days)</option>
                  <option value="EXPIRED">Expired Batches</option>
                </select>

                <select
                  value={batchTypeFilter}
                  onChange={(e) => { setBatchTypeFilter(e.target.value); setCurrentPage(1); }}
                  className="h-8 px-2 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700"
                >
                  <option value="">Batch Type: All</option>
                  <option value="PURCHASE">PO Purchase Batches</option>
                  <option value="OPENING">Opening Stock Lots</option>
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-8 text-[11px] font-bold text-slate-600 border-slate-200 hover:bg-slate-100 gap-1 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 8. DESKTOP INVENTORY TABLE */}
          <Card className="overflow-hidden border-slate-200 shadow-2xs bg-white hidden md:block">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-12 p-3 text-[11px] font-bold text-slate-500 bg-slate-100/80 border-b border-slate-200">
                  <span className="col-span-1">FIFO</span>
                  <span className="col-span-3">PRODUCT</span>
                  <span className="col-span-2">BATCH / SUPPLIER</span>
                  <span className="col-span-1 text-center">RECEIVED</span>
                  <span className="col-span-1 text-center font-bold text-slate-900">REMAINING</span>
                  <span className="col-span-1 text-right">UNIT COST</span>
                  <span className="col-span-1 text-right">BATCH VALUE</span>
                  <span className="col-span-1 text-center">STATUS</span>
                  <span className="col-span-1 text-right pr-2">ACTIONS</span>
                </div>

                {isLoading ? (
                  <div className="p-8 space-y-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="h-10 bg-slate-100 animate-pulse rounded-md" />
                    ))}
                  </div>
                ) : paginatedBatches.length === 0 ? (
                  /* 17. MEANINGFUL EMPTY STATE */
                  <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                    <Boxes className="h-10 w-10 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-800 text-sm">No inventory batches match your filters</p>
                    <p className="text-slate-400">Receive stock via Purchases or reset active filter options.</p>
                    <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2 text-xs">
                      Reset Search & Filters
                    </Button>
                  </div>
                ) : (
                  paginatedBatches.map((b) => {
                    const prodObj = productsMap.get(b.productId);
                    const prodName = b.productName || prodObj?.name || b.productId;
                    const prodSku = b.sku || prodObj?.sku || 'SKU N/A';
                    const fifoBadge = getFifoPriorityBadge(b);
                    const statusBadge = getBatchStatusBadge(b);
                    const bVal = b.quantityRemaining * b.unitCost;
                    const isExpanded = expandedBatchId === b.id;

                    return (
                      <React.Fragment key={b.id}>
                        {/* Main Batch Table Row */}
                        <div
                          className={`grid grid-cols-12 p-3 items-center text-xs transition-colors hover:bg-slate-50/80 cursor-pointer ${
                            isExpanded ? 'bg-slate-50/90 font-medium' : ''
                          }`}
                          onClick={() => setExpandedBatchId(isExpanded ? null : b.id)}
                        >
                          <div className="col-span-1">
                            <Badge variant="outline" className={`text-[9px] px-1 py-0.5 ${fifoBadge.bg}`}>
                              {fifoBadge.label}
                            </Badge>
                          </div>

                          <div className="col-span-3 font-bold flex flex-col pr-2">
                            <span className="text-slate-900 truncate">{prodName}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">{prodSku}</span>
                          </div>

                          <div className="col-span-2 font-mono text-[11px]">
                            <div className="font-bold text-slate-900">{b.batchNumber}</div>
                            <div className="text-[10px] text-slate-500 font-sans truncate">{b.supplierName || 'Opening Stock'}</div>
                          </div>

                          <div className="col-span-1 text-center font-mono text-slate-500">
                            <div>{b.quantityReceived}</div>
                            <div className="text-[9px] text-slate-400">{new Date(b.receivedDate).toLocaleDateString()}</div>
                          </div>

                          {/* 8. STRONG VISUAL HIERARCHY FOR REMAINING */}
                          <div className="col-span-1 text-center font-mono font-extrabold text-sm text-emerald-700 bg-emerald-50/60 py-1 rounded-md border border-emerald-200">
                            {b.quantityRemaining}
                          </div>

                          <div className="col-span-1 text-right font-mono text-slate-700 font-medium">
                            {formatCurrency(b.unitCost)}
                          </div>

                          <div className="col-span-1 text-right font-mono font-bold text-emerald-800">
                            {formatCurrency(bVal)}
                          </div>

                          <div className="col-span-1 text-center">
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0.5 ${statusBadge.color}`}>
                              {statusBadge.label}
                            </Badge>
                          </div>

                          {/* 12. ACTIONS */}
                          <div className="col-span-1 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => openStockAdjustmentModal(b)}
                              className="h-7 px-2 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-2xs"
                            >
                              Adjust Stock
                            </Button>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenMenuId(openMenuId === b.id ? null : b.id)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {openMenuId === b.id && (
                                <div className="absolute right-0 top-7 w-44 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-30 text-xs text-slate-700 font-medium animate-in fade-in duration-100">
                                  <button
                                    onClick={() => { setExpandedBatchId(b.id); setOpenMenuId(null); }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-slate-500" /> Expand Details
                                  </button>
                                  <button
                                    onClick={() => { openStockAdjustmentModal(b); }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-amber-700"
                                  >
                                    <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust Stock
                                  </button>
                                  <button
                                    onClick={() => { setActiveTab('ledger'); setSearch(b.batchNumber); setOpenMenuId(null); }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2"
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> Movement History
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 11. IN-PLACE ROW EXPANSION PANEL */}
                        {isExpanded && (
                          <div className="bg-slate-100/90 p-4 border-y border-slate-200 grid grid-cols-3 gap-4 text-xs">
                            <div className="space-y-1.5 bg-white p-3 rounded-md border border-slate-200">
                              <span className="font-bold text-slate-900 text-xs block border-b pb-1">Master Product</span>
                              <div className="flex justify-between"><span className="text-slate-500">Name:</span> <span className="font-bold">{prodName}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">SKU:</span> <span className="font-mono">{prodSku}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Barcode:</span> <span className="font-mono">{prodObj?.barcode || 'N/A'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Reorder Level:</span> <span className="font-mono">{prodObj?.minStockLevel || 5} Units</span></div>
                            </div>

                            <div className="space-y-1.5 bg-white p-3 rounded-md border border-slate-200">
                              <span className="font-bold text-slate-900 text-xs block border-b pb-1">Batch Lot Details</span>
                              <div className="flex justify-between"><span className="text-slate-500">Batch Number:</span> <span className="font-mono font-bold">{b.batchNumber}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Supplier:</span> <span className="font-bold text-slate-800">{b.supplierName || 'Opening Stock'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Received Date:</span> <span>{new Date(b.receivedDate).toLocaleDateString()}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Expiry Date:</span> <span className="font-mono">{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : 'N/A'}</span></div>
                            </div>

                            <div className="space-y-1.5 bg-white p-3 rounded-md border border-slate-200">
                              <span className="font-bold text-slate-900 text-xs block border-b pb-1">Quantities & Valuation</span>
                              <div className="flex justify-between"><span className="text-slate-500">Original Qty Received:</span> <span className="font-mono">{b.quantityReceived}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Current Qty Remaining:</span> <span className="font-mono font-bold text-emerald-700">{b.quantityRemaining}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Purchase Unit Cost:</span> <span className="font-mono">{formatCurrency(b.unitCost)}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Total Lot Valuation:</span> <span className="font-mono font-bold text-purple-700">{formatCurrency(bVal)}</span></div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
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

          {/* 20. MOBILE STACKED INVENTORY CARDS LAYOUT */}
          <div className="space-y-3 md:hidden">
            {filteredBatches.map((b) => {
              const prodObj = productsMap.get(b.productId);
              const prodName = b.productName || prodObj?.name || b.productId;
              const statusBadge = getBatchStatusBadge(b);

              return (
                <Card key={b.id} className="border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{prodName}</h4>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">Batch: {b.batchNumber}</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${statusBadge.color}`}>
                      {statusBadge.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-md text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Remaining Stock</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">{b.quantityRemaining} Units</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Unit Cost</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{formatCurrency(b.unitCost)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-xs font-mono text-slate-500">Supplier: {b.supplierName || 'Opening'}</span>
                    <Button
                      size="sm"
                      onClick={() => openStockAdjustmentModal(b)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-8"
                    >
                      Adjust Stock
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASE PRICE HISTORY */}
      {activeTab === 'price_history' && (
        <Card className="border-slate-200 shadow-2xs bg-white">
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

      {/* TAB 3: STOCK MOVEMENT AUDIT TRAIL */}
      {activeTab === 'ledger' && (
        <Card className="overflow-hidden border-slate-200 shadow-2xs bg-white">
          <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 px-5">
            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Stock Movement Audit Trail
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
                      {productsMap.get(m.productId)?.name || m.productId}
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
                    <div className="col-span-2 text-right text-[10px] text-slate-500 font-mono">
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

      {/* 13 & 14. CONTROLLED STOCK ADJUSTMENT MODAL WITH VALIDATION */}
      {adjustBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <Card className="max-w-md w-full border-amber-300 shadow-2xl bg-white overflow-hidden font-sans">
            <CardHeader className="bg-slate-900 text-white py-3 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-amber-400" /> ADJUST STOCK
              </CardTitle>
              <button type="button" onClick={() => setAdjustBatch(null)} className="text-white/80 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-slate-800">
                <div className="font-bold text-sm text-slate-900">
                  {adjustBatch.productName || productsMap.get(adjustBatch.productId)?.name}
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Batch Lot Number:</span>
                  <span className="font-mono font-bold text-slate-900">{adjustBatch.batchNumber}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Current Available Stock:</span>
                  <span className="font-mono font-bold text-emerald-700">{adjustBatch.quantityRemaining} Units</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Unit Cost:</span>
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(adjustBatch.unitCost)}</span>
                </div>
              </div>

              <form onSubmit={handleExecuteAdjustment} className="space-y-4">
                {/* Direction Switch */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Adjustment Action *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustDirection('REDUCE')}
                      className={`py-2 px-3 rounded-md text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        adjustDirection === 'REDUCE'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Minus className="h-4 w-4" /> Reduce Stock (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustDirection('ADD')}
                      className={`py-2 px-3 rounded-md text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        adjustDirection === 'ADD'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Plus className="h-4 w-4" /> Increase Stock (+)
                    </button>
                  </div>
                </div>

                {/* Quantity Control Buttons */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Adjustment Quantity *</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAdjustQtyInput(Math.max(1, adjustQtyInput - 1))}
                      className="h-9 w-9 text-base font-bold bg-slate-100 hover:bg-slate-200"
                    >
                      −
                    </Button>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={adjustQtyInput}
                      onChange={(e) => setAdjustQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                      required
                      className="text-center font-mono font-bold text-sm h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAdjustQtyInput(adjustQtyInput + 1)}
                      className="h-9 w-9 text-base font-bold bg-slate-100 hover:bg-slate-200"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Live Calculated New Stock */}
                <div className="p-3 bg-slate-100/90 rounded-md border border-slate-200 flex justify-between items-center font-mono text-xs">
                  <span className="text-slate-600 font-sans font-bold">New Stock Level:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {adjustBatch.quantityRemaining} →{' '}
                    <strong className="text-emerald-700">
                      {adjustDirection === 'REDUCE'
                        ? adjustBatch.quantityRemaining - adjustQtyInput
                        : adjustBatch.quantityRemaining + adjustQtyInput}
                    </strong>{' '}
                    Units
                  </span>
                </div>

                {/* 14. VALIDATION WARNING FOR OVER-REDUCTION */}
                {adjustDirection === 'REDUCE' && adjustQtyInput > adjustBatch.quantityRemaining && (
                  <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 space-y-1">
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" /> Insufficient Stock
                    </div>
                    <p className="text-[11px] text-red-700">
                      Current available batch stock is <strong>{adjustBatch.quantityRemaining} units</strong>. Requested reduction of {adjustQtyInput} units exceeds stock.
                    </p>
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700">Adjustment Reason *</label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Damaged Stock">Damaged Stock</option>
                    <option value="Stock Count Correction">Stock Count Correction</option>
                    <option value="Missing Stock">Missing Stock / Theft</option>
                    <option value="Returned Stock">Returned Stock</option>
                    <option value="Manual Correction">Manual Correction</option>
                    <option value="Expired Lot">Expired Lot</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Audit Notes / Explanation</label>
                  <Input
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="Enter inspection details..."
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button type="button" variant="outline" onClick={() => setAdjustBatch(null)} className="text-xs font-semibold">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingAdjust || (adjustDirection === 'REDUCE' && adjustQtyInput > adjustBatch.quantityRemaining)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 cursor-pointer"
                  >
                    {isSubmittingAdjust ? 'Committing...' : 'Confirm Stock Adjustment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 15. AUDIT SUCCESS FEEDBACK DIALOG */}
      {auditFeedback && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <Card className="max-w-md w-full border-emerald-300 shadow-2xl bg-white overflow-hidden font-sans">
            <CardHeader className="bg-emerald-600 text-white py-3.5 px-5 flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-100" /> Stock Adjusted Successfully
              </CardTitle>
              <button type="button" onClick={() => setAuditFeedback(null)} className="text-white/80 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-50/70 p-3.5 rounded-lg border border-emerald-200 space-y-2 text-slate-800">
                <div className="font-bold text-sm text-emerald-950">{auditFeedback.productName}</div>
                <div className="flex justify-between text-slate-600">
                  <span>Batch Lot Number:</span>
                  <span className="font-mono font-bold text-slate-900">{auditFeedback.batchNumber}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Stock Level Change:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {auditFeedback.previousQty} → {auditFeedback.newQty} units ({auditFeedback.delta > 0 ? `+${auditFeedback.delta}` : auditFeedback.delta})
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Adjustment Reason:</span>
                  <span className="font-bold text-slate-900">{auditFeedback.reason}</span>
                </div>
                {auditFeedback.notes && (
                  <div className="flex justify-between text-slate-600">
                    <span>Audit Notes:</span>
                    <span>{auditFeedback.notes}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 pt-1 border-t border-emerald-200 text-[11px]">
                  <span>Adjusted By: <strong>Admin</strong></span>
                  <span>{auditFeedback.timestamp}</span>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  onClick={() => setAuditFeedback(null)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 cursor-pointer"
                >
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
