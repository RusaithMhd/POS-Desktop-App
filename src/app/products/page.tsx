'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Filter,
  Layers,
  Boxes,
  Calendar,
  DollarSign,
  TrendingUp,
  History,
  ShoppingCart,
  Truck,
  SlidersHorizontal,
  FileText,
  Clock,
  Eye,
  RefreshCw,
  Info,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import {
  SQLiteProductRepository,
  SQLiteInventoryBatchRepository,
  SQLiteSupplierRepository,
} from '@/infrastructure/repositories/SQLiteRepositories';
import { ProductEntity, CategoryEntity, UnitEntity } from '@/domain/entities/Product';
import { InventoryBatchEntity } from '@/domain/entities/InventoryBatch';
import { SupplierEntity } from '@/domain/entities/Supplier';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { CategoryModal } from '@/components/pos/CategoryModal';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function ProductsPage() {
  return (
    <PermissionGuard
      permission={['products.view', 'products.create', 'products.edit', 'products.delete']}
      moduleName="Product Master & Batch Inventory Management"
    >
      <ProductsContent />
    </PermissionGuard>
  );
}

function ProductsContent() {
  // Repositories
  const productRepo = new SQLiteProductRepository();
  const batchRepo = new SQLiteInventoryBatchRepository();
  const supplierRepo = new SQLiteSupplierRepository();

  // Core Data
  const [products, setProducts] = useState<ProductEntity[]>([]);
  const [categories, setCategories] = useState<CategoryEntity[]>([]);
  const [units, setUnits] = useState<UnitEntity[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierEntity[]>([]);
  const [allBatches, setAllBatches] = useState<InventoryBatchEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Global KPI Summary
  const [valuationStats, setValuationStats] = useState({ totalItems: 0, totalQuantity: 0, totalValue: 0 });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals & Drawers State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Product Form Inputs
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [brand, setBrand] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [minStockLevel, setMinStockLevel] = useState('5');
  const [reorderLevel, setReorderLevel] = useState('10');
  const [taxRate, setTaxRate] = useState('0');
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [description, setDescription] = useState('');

  // Confirmation Modals State
  const [pendingSaveData, setPendingSaveData] = useState<Partial<ProductEntity> | null>(null);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductEntity | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // PRODUCT DETAIL DRAWER / FULL MODAL
  const [selectedProduct, setSelectedProduct] = useState<ProductEntity | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'batches' | 'movements' | 'purchases' | 'sales' | 'adjustments' | 'suppliers' | 'profit' | 'expiry'
  >('overview');

  // Detail Drawer Data
  const [productBatches, setProductBatches] = useState<InventoryBatchEntity[]>([]);
  const [productMovements, setProductMovements] = useState<any[]>([]);
  const [productPurchases, setProductPurchases] = useState<any[]>([]);
  const [productSales, setProductSales] = useState<any[]>([]);
  const [productSuppliers, setProductSuppliers] = useState<any[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // BATCH DETAIL SUB-MODAL
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatchEntity | null>(null);
  const [batchTransactions, setBatchTransactions] = useState<any[]>([]);
  const [isLoadingBatchDetail, setIsLoadingBatchDetail] = useState(false);

  // CONTROLLED STOCK ADJUSTMENT MODAL
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjProductId, setAdjProductId] = useState<string>('');
  const [adjBatchId, setAdjBatchId] = useState<string>('');
  const [adjType, setAdjType] = useState<'INCREASE' | 'DECREASE' | 'DAMAGE' | 'EXPIRED' | 'MISSING' | 'FOUND' | 'CORRECTION'>('DAMAGE');
  const [adjQuantity, setAdjQuantity] = useState<string>('1');
  const [adjReason, setAdjReason] = useState<string>('');
  const [adjNotes, setAdjNotes] = useState<string>('');
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const [prodList, catList, unitList, supList, batchesList, valStats] = await Promise.all([
        productRepo.getAll(),
        productRepo.getCategories(),
        productRepo.getUnits(),
        supplierRepo.getAll(),
        batchRepo.getAllActiveBatches(),
        batchRepo.getInventoryValuation(),
      ]);

      setProducts(prodList);
      setCategories(catList);
      setUnits(unitList);
      setSuppliers(supList);
      setAllBatches(batchesList);
      setValuationStats(valStats);
    } catch (err) {
      console.error('Failed to load catalog data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load deep detail data for selected product
  const loadProductDetail = async (prod: ProductEntity, tab = activeTab) => {
    setSelectedProduct(prod);
    setActiveTab(tab);
    setIsLoadingDetail(true);

    try {
      const [batches, movements, purchases, sales, supHist] = await Promise.all([
        batchRepo.getBatchesByProductId(prod.id),
        batchRepo.getProductStockMovements(prod.id),
        batchRepo.getProductPurchaseHistory(prod.id),
        batchRepo.getProductSalesHistory(prod.id),
        batchRepo.getProductSupplierHistory(prod.id),
      ]);

      setProductBatches(batches);
      setProductMovements(movements);
      setProductPurchases(purchases);
      setProductSales(sales);
      setProductSuppliers(supHist);
    } catch (err) {
      console.error('Failed to load product detail stats:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Load detailed transactions for a specific batch
  const openBatchDetailModal = async (batch: InventoryBatchEntity) => {
    setSelectedBatch(batch);
    setIsLoadingBatchDetail(true);
    try {
      const txs = await batchRepo.getBatchTransactions(batch.id);
      setBatchTransactions(txs);
    } catch (err) {
      console.error('Failed to load batch transactions:', err);
    } finally {
      setIsLoadingBatchDetail(false);
    }
  };

  const resetForm = () => {
    setEditingProductId(null);
    setName('');
    setSku('');
    setBarcode('');
    setCategoryId('');
    setUnitId('');
    setBrand('');
    setCostPrice('');
    setSellingPrice('');
    setStockQuantity('0');
    setMinStockLevel('5');
    setReorderLevel('10');
    setTaxRate('0');
    setTrackExpiry(false);
    setDescription('');
    setIsFormOpen(false);
  };

  const handleEditClick = (product: ProductEntity) => {
    setEditingProductId(product.id);
    setName(product.name);
    setSku(product.sku);
    setBarcode(product.barcode || '');
    setCategoryId(product.categoryId || '');
    setUnitId(product.unitId || '');
    setBrand(product.brand || '');
    setCostPrice(product.costPrice.toString());
    setSellingPrice(product.sellingPrice.toString());
    setStockQuantity(product.stockQuantity.toString());
    setMinStockLevel(product.minStockLevel.toString());
    setReorderLevel(product.reorderLevel.toString());
    setTaxRate(product.taxRate ? product.taxRate.toString() : '0');
    setTrackExpiry(Boolean(product.trackExpiry));
    setDescription(product.description || '');
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<ProductEntity> = {
      id: editingProductId || undefined,
      name: name.trim(),
      sku: sku.trim(),
      barcode: barcode.trim() || null,
      categoryId: categoryId || null,
      unitId: unitId || null,
      brand: brand.trim() || null,
      costPrice: parseFloat(costPrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      stockQuantity: parseFloat(stockQuantity) || 0,
      minStockLevel: parseFloat(minStockLevel) || 5,
      reorderLevel: parseFloat(reorderLevel) || 10,
      taxRate: parseFloat(taxRate) || 0,
      trackInventory: true,
      trackExpiry,
      description: description.trim() || null,
      isActive: true,
    };
    setPendingSaveData(payload);
    setIsConfirmSaveOpen(true);
  };

  const executeSaveProduct = async () => {
    if (!pendingSaveData) return;
    try {
      await productRepo.save(pendingSaveData);
      setIsConfirmSaveOpen(false);
      setPendingSaveData(null);
      resetForm();
      await loadInitialData();
    } catch (err) {
      console.error('Failed to save product:', err);
    }
  };

  const executeDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await productRepo.delete(productToDelete.id);
      setProductToDelete(null);
      if (selectedProduct?.id === productToDelete.id) {
        setSelectedProduct(null);
      }
      await loadInitialData();
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  // Open Controlled Adjustment Modal
  const openAdjustmentModal = (productId: string, batchId?: string) => {
    setAdjProductId(productId);
    setAdjBatchId(batchId || '');
    setAdjType('DAMAGE');
    setAdjQuantity('1');
    setAdjReason('');
    setAdjNotes('');
    setIsAdjustmentModalOpen(true);
  };

  const executeStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjBatchId) {
      alert('Please select a specific inventory batch to adjust.');
      return;
    }
    const qty = parseFloat(adjQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid positive adjustment quantity.');
      return;
    }
    if (!adjReason.trim()) {
      alert('Adjustment reason is mandatory for audit trail compliance.');
      return;
    }

    setIsSubmittingAdj(true);
    try {
      await batchRepo.adjustBatchStockDetailed({
        batchId: adjBatchId,
        productId: adjProductId,
        adjustmentType: adjType,
        quantity: qty,
        reason: adjReason.trim(),
        notes: adjNotes.trim() || undefined,
        userId: 'usr-admin',
      });

      setIsAdjustmentModalOpen(false);
      await loadInitialData();
      if (selectedProduct) {
        await loadProductDetail(selectedProduct, activeTab);
      }
    } catch (err: any) {
      alert(`Stock adjustment failed: ${err.message || err}`);
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  const executeToggleBatchStatus = async (batchId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    try {
      await batchRepo.toggleBatchStatus(batchId, newStatus as any);
      if (selectedProduct) {
        await loadProductDetail(selectedProduct, activeTab);
      }
      await loadInitialData();
    } catch (err) {
      console.error('Failed to toggle batch status:', err);
    }
  };

  // Calculate Product Stock Status
  const getProductStockStatus = (prod: ProductEntity) => {
    if (prod.stockQuantity <= 0) return { label: 'OUT OF STOCK', variant: 'destructive' as const };
    if (prod.stockQuantity <= prod.minStockLevel) return { label: 'LOW STOCK', variant: 'destructive' as const };
    return { label: 'IN STOCK', variant: 'secondary' as const };
  };

  // Unique Brands List for Filter
  const uniqueBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))) as string[];

  // Filter Logic
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search));

    const matchesCategory = !categoryFilter || p.categoryId === categoryFilter;
    const matchesBrand = !brandFilter || p.brand === brandFilter;

    let matchesStockStatus = true;
    if (stockStatusFilter === 'IN_STOCK') matchesStockStatus = p.stockQuantity > p.minStockLevel;
    else if (stockStatusFilter === 'LOW_STOCK') matchesStockStatus = p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel;
    else if (stockStatusFilter === 'OUT_OF_STOCK') matchesStockStatus = p.stockQuantity <= 0;

    let matchesExpiry = true;
    if (expiryFilter !== 'ALL') {
      const prodBatches = allBatches.filter((b) => b.productId === p.id);
      const now = new Date();
      if (expiryFilter === 'EXPIRED') {
        matchesExpiry = prodBatches.some((b) => b.expiryDate && new Date(b.expiryDate) < now);
      } else if (expiryFilter === 'NEAR_EXPIRY') {
        matchesExpiry = prodBatches.some((b) => {
          if (!b.expiryDate) return false;
          const exp = new Date(b.expiryDate);
          const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
          return diffDays >= 0 && diffDays <= 30;
        });
      }
    }

    let matchesSupplier = true;
    if (supplierFilter) {
      const prodBatches = allBatches.filter((b) => b.productId === p.id);
      matchesSupplier = prodBatches.some((b) => b.supplierId === supplierFilter);
    }

    return matchesSearch && matchesCategory && matchesBrand && matchesStockStatus && matchesExpiry && matchesSupplier;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // KPI Calculations
  const lowStockCount = products.filter((p) => p.stockQuantity <= p.minStockLevel).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Package className="h-7 w-7 text-emerald-600" /> Product Master & Batch Inventory System
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage single master products with independent multi-supplier cost batches, lot-wise FIFO/FEFO tracking & COGS audit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsCategoryModalOpen(true)}
            className="border-slate-300 font-bold gap-2 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            <Layers className="h-4 w-4 text-emerald-600" /> Categories
          </Button>

          <Button
            onClick={() => openAdjustmentModal(products[0]?.id || '')}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold gap-2 cursor-pointer shadow-sm text-xs"
          >
            <SlidersHorizontal className="h-4 w-4 text-amber-400" /> Adjust Stock
          </Button>

          <Button
            onClick={() => {
              if (isFormOpen) resetForm();
              else {
                resetForm();
                setIsFormOpen(true);
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 cursor-pointer shadow-sm text-xs"
          >
            {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isFormOpen ? 'Close Form' : 'Add New Product'}
          </Button>
        </div>
      </div>

      {/* Global Top Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Catalog Products</p>
              <h3 className="text-lg font-bold text-slate-900">{products.length} Items</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Total Stock Units</p>
              <h3 className="text-lg font-bold text-slate-900">{valuationStats.totalQuantity.toLocaleString()} Units</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Active Stock Lots</p>
              <h3 className="text-lg font-bold text-slate-900">{allBatches.length} Batches</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Low Stock Alerts</p>
              <h3 className="text-lg font-bold text-amber-600">{lowStockCount} Products</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white col-span-2 md:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Inventory Valuation</p>
              <h3 className="text-base font-bold text-purple-700 font-mono">{formatCurrency(valuationStats.totalValue)}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Form Container */}
      {isFormOpen && (
        <Card className="border-emerald-300 shadow-md bg-white">
          <CardHeader className="bg-emerald-50/60 border-b border-emerald-100 py-3 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              {editingProductId ? <Edit className="h-4 w-4 text-emerald-600" /> : <Plus className="h-4 w-4 text-emerald-600" />}
              {editingProductId ? 'Edit Product Master Definition' : 'Register New Master Product'}
            </CardTitle>
            <span className="text-xs text-slate-500 font-medium">Fields with * are required</span>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handlePreSaveSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700">Product Name *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Coca-Cola 500ml Pet Bottle"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">SKU Code *</label>
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                    placeholder="BEV-COKE-500"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Barcode (EAN / UPC)</label>
                  <Input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="5449000000996"
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Brand</label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Coca-Cola Company"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Unit of Measure</label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Unit...</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.shortName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Tax Configuration (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Cost Price (LKR) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    required
                    placeholder="120.00"
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Current Selling Price (LKR) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    required
                    placeholder="160.00"
                    className="mt-1 font-mono text-emerald-700 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Initial Stock Quantity</label>
                  <Input
                    type="number"
                    step="1"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    placeholder="0"
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Minimum Stock Warning</label>
                  <Input
                    type="number"
                    step="1"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(e.target.value)}
                    placeholder="5"
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Reorder Level Threshold</label>
                  <Input
                    type="number"
                    step="1"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    placeholder="10"
                    className="mt-1 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="trackExpiry"
                    checked={trackExpiry}
                    onChange={(e) => setTrackExpiry(e.target.checked)}
                    className="h-4 w-4 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="trackExpiry" className="font-bold text-slate-800 cursor-pointer">
                    Expiry Controlled Product (Enable FEFO)
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700">Product Description / Notes</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional master specification notes"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={resetForm} className="text-xs font-semibold">
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 cursor-pointer text-xs">
                  {editingProductId ? 'Update Master Record' : 'Save & Register Product'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter and Search Toolbar */}
      <Card className="border-slate-200 shadow-2xs bg-white">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search product name, SKU, or barcode..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 bg-white border-slate-200 text-xs"
              />
            </div>

            <div>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={stockStatusFilter}
                onChange={(e) => {
                  setStockStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="ALL">All Stock Statuses</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock Warning</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
            <div>
              <select
                value={brandFilter}
                onChange={(e) => {
                  setBrandFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 px-3 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700"
              >
                <option value="">All Brands</option>
                {uniqueBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={supplierFilter}
                onChange={(e) => {
                  setSupplierFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 px-3 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={expiryFilter}
                onChange={(e) => {
                  setExpiryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 px-3 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700"
              >
                <option value="ALL">All Expiry Statuses</option>
                <option value="NEAR_EXPIRY">Near Expiry (&lt; 30 Days)</option>
                <option value="EXPIRED">Expired Batches</option>
              </select>
            </div>

            <div className="flex items-center justify-end text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900 mx-1">{filteredProducts.length}</strong> catalog items
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Catalog Table */}
      <Card className="overflow-hidden border-slate-200 shadow-2xs bg-white">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-[11px] font-bold text-slate-500 bg-slate-100/70 border-b border-slate-200">
              <span className="col-span-3">PRODUCT DEFINITION</span>
              <span className="col-span-2">SKU / BARCODE</span>
              <span className="col-span-1 text-center">TOTAL STOCK</span>
              <span className="col-span-2 text-right">AVG COST</span>
              <span className="col-span-2 text-right">SELLING PRICE</span>
              <span className="col-span-2 text-right pr-2">ACTIONS</span>
            </div>

            {paginatedProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                No products match the selected catalog and batch filters.
              </div>
            ) : (
              paginatedProducts.map((p) => {
                const categoryObj = categories.find((c) => c.id === p.categoryId);
                const statusInfo = getProductStockStatus(p);
                const prodBatches = allBatches.filter((b) => b.productId === p.id);

                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <div className="col-span-3 font-bold flex flex-col">
                      <span className="text-slate-900 font-bold">{p.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {categoryObj && <span className="text-[10px] text-slate-500 font-normal">{categoryObj.name}</span>}
                        {p.brand && <span className="text-[10px] text-slate-400 font-normal">• {p.brand}</span>}
                        {p.trackExpiry && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-300 text-amber-700 bg-amber-50">
                            FEFO Expiry
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="col-span-2 font-mono text-[11px] text-slate-600">
                      <div className="font-bold">{p.sku}</div>
                      {p.barcode && <div className="text-[10px] text-slate-400">{p.barcode}</div>}
                    </div>

                    <div className="col-span-1 text-center font-mono font-bold">
                      <div className="flex flex-col items-center">
                        <Badge variant={statusInfo.variant} className="text-[10px] px-1.5 py-0">
                          {p.stockQuantity}
                        </Badge>
                        <span className="text-[9px] text-slate-400 font-normal mt-0.5">{prodBatches.length} Lots</span>
                      </div>
                    </div>

                    <div className="col-span-2 text-right font-mono text-slate-600">
                      {formatCurrency(p.costPrice)}
                    </div>

                    <div className="col-span-2 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(p.sellingPrice)}
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => loadProductDetail(p, 'overview')}
                        className="h-8 px-2 text-slate-700 border-slate-300 hover:bg-slate-100 cursor-pointer text-xs"
                        title="View Full Product Detail & Stock Ledger"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Detail
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(p)}
                        className="h-8 px-2 text-blue-700 border-blue-200 hover:bg-blue-50 cursor-pointer"
                        title="Edit Master"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setProductToDelete(p)}
                        className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* 9-TAB PRODUCT DETAIL DRAWER / MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <Card className="max-w-6xl w-full border-slate-300 shadow-2xl bg-white overflow-hidden my-6">
            {/* Modal Header */}
            <CardHeader className="bg-slate-900 text-white py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-400" /> {selectedProduct.name}
                  </h2>
                  <Badge variant="outline" className="border-emerald-500 text-emerald-300 text-xs px-2 py-0.5">
                    SKU: {selectedProduct.sku}
                  </Badge>
                  {selectedProduct.barcode && (
                    <span className="text-xs text-slate-400 font-mono">Barcode: {selectedProduct.barcode}</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Master Product Detail • Multi-Batch Inventory Lot Tracking & Ledger Audit
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => openAdjustmentModal(selectedProduct.id)}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust Stock
                </Button>

                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </CardHeader>

            {/* Top Stat Bar */}
            <div className="bg-slate-100/80 px-6 py-3 border-b border-slate-200 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Total Stock</span>
                <div className="font-bold text-slate-900 text-sm font-mono">{selectedProduct.stockQuantity} Units</div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Active Batches</span>
                <div className="font-bold text-indigo-700 text-sm font-mono">{productBatches.length} Lots</div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Average Cost</span>
                <div className="font-bold text-slate-700 text-sm font-mono">{formatCurrency(selectedProduct.costPrice)}</div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Selling Price</span>
                <div className="font-bold text-emerald-700 text-sm font-mono">{formatCurrency(selectedProduct.sellingPrice)}</div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Stock Value</span>
                <div className="font-bold text-purple-700 text-sm font-mono">
                  {formatCurrency(selectedProduct.stockQuantity * selectedProduct.costPrice)}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Stock Status</span>
                <div>
                  <Badge variant={getProductStockStatus(selectedProduct).variant} className="text-[10px] px-2">
                    {getProductStockStatus(selectedProduct).label}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 overflow-x-auto text-xs font-bold text-slate-600 gap-1 pt-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2.5 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'overview'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-md font-extrabold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Info className="h-3.5 w-3.5" /> Overview
              </button>

              <button
                onClick={() => setActiveTab('batches')}
                className={`px-4 py-2.5 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'batches'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-md font-extrabold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> Batches ({productBatches.length})
              </button>

              <button
                onClick={() => setActiveTab('movements')}
                className={`px-4 py-2.5 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'movements'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-md font-extrabold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <History className="h-3.5 w-3.5" /> Movement Ledger ({productMovements.length})
              </button>

              <button
                onClick={() => setActiveTab('purchases')}
                className={`px-4 py-2.5 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'purchases'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-md font-extrabold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Truck className="h-3.5 w-3.5" /> Purchase History
              </button>

              <button
                onClick={() => setActiveTab('sales')}
                className={`px-4 py-2.5 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'sales'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-md font-extrabold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <ShoppingCart className="h-3.5 w-3.5" /> Sales History
              </button>

              <button
                onClick={() => setActiveTab('adjustments')}
                className={`px-4 py-2.5 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'adjustments'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-md font-extrabold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Adjustments
              </button>

              <button
                onClick={() => setActiveTab('suppliers')}
                className={`px-4 py-2.5 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'suppliers'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-md font-extrabold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Layers className="h-3.5 w-3.5" /> Supplier History
              </button>

              <button
                onClick={() => setActiveTab('profit')}
                className={`px-4 py-2.5 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'profit'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-md font-extrabold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" /> Profit Analysis
              </button>

              {selectedProduct.trackExpiry && (
                <button
                  onClick={() => setActiveTab('expiry')}
                  className={`px-4 py-2.5 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                    activeTab === 'expiry'
                      ? 'border-amber-600 text-amber-700 bg-white rounded-t-md font-extrabold'
                      : 'border-transparent hover:text-slate-900 text-amber-700'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" /> Expiry Tracking
                </button>
              )}
            </div>

            {/* Tab Body Content */}
            <CardContent className="p-6 max-h-[60vh] overflow-y-auto text-xs">
              {isLoadingDetail ? (
                <div className="py-12 text-center text-slate-500 font-medium">Loading inventory batch detail records...</div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5">
                          <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1.5">
                            Master Definitions
                          </h4>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Category:</span>
                            <span className="font-semibold">
                              {categories.find((c) => c.id === selectedProduct.categoryId)?.name || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Brand:</span>
                            <span className="font-semibold">{selectedProduct.brand || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Unit of Measure:</span>
                            <span className="font-semibold">
                              {units.find((u) => u.id === selectedProduct.unitId)?.shortName || 'pcs'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Tax Rate:</span>
                            <span className="font-semibold">{selectedProduct.taxRate}%</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5">
                          <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1.5">
                            Inventory Controls & Thresholds
                          </h4>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Minimum Stock Warning:</span>
                            <span className="font-mono font-bold text-amber-700">{selectedProduct.minStockLevel} Units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Reorder Level Threshold:</span>
                            <span className="font-mono font-bold text-blue-700">{selectedProduct.reorderLevel} Units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Expiry Control:</span>
                            <span className="font-semibold">
                              {selectedProduct.trackExpiry ? 'Enabled (FEFO Priority)' : 'Disabled (FIFO Default)'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Catalog Status:</span>
                            <Badge variant={selectedProduct.isActive ? 'secondary' : 'destructive'} className="text-[10px]">
                              {selectedProduct.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5">
                          <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1.5">
                            Stock Valuation Summary
                          </h4>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Active Batches:</span>
                            <span className="font-mono font-bold text-indigo-700">{productBatches.length} Lots</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Total Valuation:</span>
                            <span className="font-mono font-bold text-purple-700">
                              {formatCurrency(selectedProduct.stockQuantity * selectedProduct.costPrice)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Potential Retail Revenue:</span>
                            <span className="font-mono font-bold text-emerald-700">
                              {formatCurrency(selectedProduct.stockQuantity * selectedProduct.sellingPrice)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Est. Potential Gross Margin:</span>
                            <span className="font-mono font-bold text-emerald-800">
                              {formatCurrency(
                                selectedProduct.stockQuantity * (selectedProduct.sellingPrice - selectedProduct.costPrice)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {selectedProduct.description && (
                        <div className="bg-blue-50/50 p-3 rounded-md border border-blue-100 text-slate-700">
                          <strong className="text-slate-900 font-bold block mb-1">Product Description / Notes:</strong>
                          {selectedProduct.description}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: BATCH MANAGEMENT TABLE */}
                  {activeTab === 'batches' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900">Independent Inventory Batches / Stock Lots</h4>
                        <span className="text-slate-500 text-[11px]">
                          Each purchase receipt creates a separate stock batch with its own unit cost & history.
                        </span>
                      </div>

                      <div className="border rounded-md overflow-hidden border-slate-200">
                        <div className="grid grid-cols-12 p-2.5 bg-slate-100 font-bold text-[11px] text-slate-600 border-b">
                          <span className="col-span-2">BATCH #</span>
                          <span className="col-span-2">SUPPLIER</span>
                          <span className="col-span-2">PURCHASE DATE</span>
                          <span className="col-span-1 text-center">ORIG. QTY</span>
                          <span className="col-span-1 text-center">AVAIL. QTY</span>
                          <span className="col-span-1 text-right">UNIT COST</span>
                          <span className="col-span-1 text-right">EXPIRY</span>
                          <span className="col-span-1 text-center">STATUS</span>
                          <span className="col-span-1 text-right">ACTIONS</span>
                        </div>

                        {productBatches.length === 0 ? (
                          <div className="p-6 text-center text-slate-500">No inventory batches registered for this product.</div>
                        ) : (
                          productBatches.map((b) => {
                            const isExpired = b.expiryDate && new Date(b.expiryDate) < new Date();
                            return (
                              <div
                                key={b.id}
                                className="grid grid-cols-12 p-2.5 items-center border-b border-slate-100 hover:bg-slate-50 transition-colors"
                              >
                                <span className="col-span-2 font-mono font-bold text-slate-900">{b.batchNumber}</span>
                                <span className="col-span-2 text-slate-700 truncate">{b.supplierName || 'Opening Stock'}</span>
                                <span className="col-span-2 text-slate-500">{new Date(b.receivedDate).toLocaleDateString()}</span>
                                <span className="col-span-1 text-center font-mono text-slate-500">{b.quantityReceived}</span>
                                <span className="col-span-1 text-center font-mono font-bold text-emerald-700">
                                  {b.quantityRemaining}
                                </span>
                                <span className="col-span-1 text-right font-mono">{formatCurrency(b.unitCost)}</span>
                                <span className="col-span-1 text-right font-mono">
                                  {b.expiryDate ? (
                                    <span className={isExpired ? 'text-red-600 font-bold' : 'text-slate-600'}>
                                      {new Date(b.expiryDate).toLocaleDateString()}
                                    </span>
                                  ) : (
                                    'N/A'
                                  )}
                                </span>
                                <span className="col-span-1 text-center">
                                  <Badge
                                    variant={b.status === 'ACTIVE' ? 'secondary' : 'destructive'}
                                    className="text-[9px] px-1.5 py-0"
                                  >
                                    {b.status}
                                  </Badge>
                                </span>
                                <div className="col-span-1 flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openBatchDetailModal(b)}
                                    className="h-7 px-1.5 text-slate-700 border-slate-300 hover:bg-slate-100 cursor-pointer"
                                    title="View Detailed Batch Audit"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openAdjustmentModal(selectedProduct.id, b.id)}
                                    className="h-7 px-1.5 text-amber-700 border-amber-200 hover:bg-amber-50 cursor-pointer"
                                    title="Adjust Stock for this Batch"
                                  >
                                    <SlidersHorizontal className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: STOCK MOVEMENT LEDGER */}
                  {activeTab === 'movements' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900">Immutable Inventory Movement Audit Ledger</h4>
                        <span className="text-slate-500 text-[11px]">
                          All purchases, sales, adjustments, and returns are permanently recorded with audit trail.
                        </span>
                      </div>

                      <div className="border rounded-md overflow-hidden border-slate-200">
                        <div className="grid grid-cols-12 p-2.5 bg-slate-100 font-bold text-[11px] text-slate-600 border-b">
                          <span className="col-span-3">DATE / TIME</span>
                          <span className="col-span-2">MOVEMENT TYPE</span>
                          <span className="col-span-2 text-center">QTY CHANGE</span>
                          <span className="col-span-2 text-center">PREV &rarr; NEW</span>
                          <span className="col-span-2">USER</span>
                          <span className="col-span-1 text-right">REASON</span>
                        </div>

                        {productMovements.length === 0 ? (
                          <div className="p-6 text-center text-slate-500">No stock movements recorded yet.</div>
                        ) : (
                          productMovements.map((m) => (
                            <div
                              key={m.id}
                              className="grid grid-cols-12 p-2.5 items-center border-b border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                              <span className="col-span-3 font-mono text-slate-500">
                                {new Date(m.createdAt).toLocaleString()}
                              </span>
                              <span className="col-span-2 font-bold">
                                <Badge
                                  variant={m.quantityChange >= 0 ? 'secondary' : 'destructive'}
                                  className="text-[9px] px-1.5"
                                >
                                  {m.movementType}
                                </Badge>
                              </span>
                              <span
                                className={`col-span-2 text-center font-mono font-bold ${
                                  m.quantityChange >= 0 ? 'text-emerald-700' : 'text-red-600'
                                }`}
                              >
                                {m.quantityChange >= 0 ? `+${m.quantityChange}` : m.quantityChange}
                              </span>
                              <span className="col-span-2 text-center font-mono text-slate-600">
                                {m.previousQuantity} &rarr; <strong>{m.newQuantity}</strong>
                              </span>
                              <span className="col-span-2 text-slate-700 truncate">{m.userName || 'System'}</span>
                              <span className="col-span-1 text-right text-slate-500 truncate">{m.reason || 'N/A'}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: PURCHASE HISTORY */}
                  {activeTab === 'purchases' && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900">Historical Purchase Orders & Receipts</h4>

                      <div className="border rounded-md overflow-hidden border-slate-200">
                        <div className="grid grid-cols-12 p-2.5 bg-slate-100 font-bold text-[11px] text-slate-600 border-b">
                          <span className="col-span-3">INVOICE #</span>
                          <span className="col-span-3">PURCHASE DATE</span>
                          <span className="col-span-3">SUPPLIER</span>
                          <span className="col-span-1 text-right">UNIT COST</span>
                          <span className="col-span-1 text-center">QTY</span>
                          <span className="col-span-1 text-right">TOTAL</span>
                        </div>

                        {productPurchases.length === 0 ? (
                          <div className="p-6 text-center text-slate-500">No purchase receipts recorded for this product.</div>
                        ) : (
                          productPurchases.map((p) => (
                            <div
                              key={p.id}
                              className="grid grid-cols-12 p-2.5 items-center border-b border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                              <span className="col-span-3 font-mono font-bold text-slate-900">{p.invoiceNumber}</span>
                              <span className="col-span-3 text-slate-600">{new Date(p.purchaseDate).toLocaleString()}</span>
                              <span className="col-span-3 font-medium text-slate-800">{p.supplierName}</span>
                              <span className="col-span-1 text-right font-mono">{formatCurrency(p.unitCost)}</span>
                              <span className="col-span-1 text-center font-mono font-bold">{p.quantity}</span>
                              <span className="col-span-1 text-right font-mono font-bold text-emerald-700">
                                {formatCurrency(p.totalCost)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: SALES HISTORY */}
                  {activeTab === 'sales' && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900">Point of Sale Customer Transactions</h4>

                      <div className="border rounded-md overflow-hidden border-slate-200">
                        <div className="grid grid-cols-12 p-2.5 bg-slate-100 font-bold text-[11px] text-slate-600 border-b">
                          <span className="col-span-3">INVOICE #</span>
                          <span className="col-span-3">SALE DATE</span>
                          <span className="col-span-1 text-center">QTY</span>
                          <span className="col-span-2 text-right">PRICE</span>
                          <span className="col-span-2 text-right">ACTUAL COGS</span>
                          <span className="col-span-1 text-right">GROSS MARGIN</span>
                        </div>

                        {productSales.length === 0 ? (
                          <div className="p-6 text-center text-slate-500">No customer sales recorded for this product.</div>
                        ) : (
                          productSales.map((s) => (
                            <div
                              key={s.id}
                              className="grid grid-cols-12 p-2.5 items-center border-b border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                              <span className="col-span-3 font-mono font-bold text-slate-900">{s.invoiceNumber}</span>
                              <span className="col-span-3 text-slate-600">{new Date(s.saleDate).toLocaleString()}</span>
                              <span className="col-span-1 text-center font-mono font-bold">{s.quantity}</span>
                              <span className="col-span-2 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(s.totalAmount)}
                              </span>
                              <span className="col-span-2 text-right font-mono text-slate-600">
                                {formatCurrency(s.actualCogs)}
                              </span>
                              <span
                                className={`col-span-1 text-right font-mono font-bold ${
                                  s.marginAmount >= 0 ? 'text-emerald-700' : 'text-red-600'
                                }`}
                              >
                                {formatCurrency(s.marginAmount)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 6: ADJUSTMENTS */}
                  {activeTab === 'adjustments' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900">Stock Adjustment Audit Log</h4>
                        <Button
                          onClick={() => openAdjustmentModal(selectedProduct.id)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" /> New Stock Adjustment
                        </Button>
                      </div>

                      <div className="border rounded-md overflow-hidden border-slate-200">
                        <div className="grid grid-cols-12 p-2.5 bg-slate-100 font-bold text-[11px] text-slate-600 border-b">
                          <span className="col-span-3">DATE</span>
                          <span className="col-span-2">ADJUSTMENT TYPE</span>
                          <span className="col-span-2 text-center">QTY CHANGE</span>
                          <span className="col-span-2">USER</span>
                          <span className="col-span-3">REASON / NOTES</span>
                        </div>

                        {productMovements.filter((m) => m.referenceType === 'adjustment').length === 0 ? (
                          <div className="p-6 text-center text-slate-500">No manual stock adjustments logged yet.</div>
                        ) : (
                          productMovements
                            .filter((m) => m.referenceType === 'adjustment')
                            .map((m) => (
                              <div
                                key={m.id}
                                className="grid grid-cols-12 p-2.5 items-center border-b border-slate-100 hover:bg-slate-50 transition-colors"
                              >
                                <span className="col-span-3 font-mono text-slate-500">
                                  {new Date(m.createdAt).toLocaleString()}
                                </span>
                                <span className="col-span-2 font-bold">
                                  <Badge variant="destructive" className="text-[9px]">
                                    {m.movementType}
                                  </Badge>
                                </span>
                                <span
                                  className={`col-span-2 text-center font-mono font-bold ${
                                    m.quantityChange >= 0 ? 'text-emerald-700' : 'text-red-600'
                                  }`}
                                >
                                  {m.quantityChange >= 0 ? `+${m.quantityChange}` : m.quantityChange}
                                </span>
                                <span className="col-span-2 text-slate-700">{m.userName || 'System'}</span>
                                <span className="col-span-3 text-slate-600 truncate">{m.reason || 'N/A'}</span>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 7: SUPPLIER HISTORY */}
                  {activeTab === 'suppliers' && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900">Multi-Supplier Purchase Breakdown</h4>

                      <div className="border rounded-md overflow-hidden border-slate-200">
                        <div className="grid grid-cols-12 p-2.5 bg-slate-100 font-bold text-[11px] text-slate-600 border-b">
                          <span className="col-span-3">SUPPLIER</span>
                          <span className="col-span-2 text-center">PURCHASES</span>
                          <span className="col-span-2 text-center">TOTAL QTY</span>
                          <span className="col-span-2 text-right">LAST COST</span>
                          <span className="col-span-2 text-right">AVG COST</span>
                          <span className="col-span-1 text-right">LAST DATE</span>
                        </div>

                        {productSuppliers.length === 0 ? (
                          <div className="p-6 text-center text-slate-500">No multi-supplier history logged.</div>
                        ) : (
                          productSuppliers.map((sup) => (
                            <div
                              key={sup.supplierId}
                              className="grid grid-cols-12 p-2.5 items-center border-b border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                              <div className="col-span-3 font-bold text-slate-900">
                                {sup.supplierName}
                                <div className="text-[10px] text-slate-400 font-normal">{sup.supplierCode}</div>
                              </div>
                              <span className="col-span-2 text-center font-mono font-bold text-indigo-700">
                                {sup.purchasesCount} Orders
                              </span>
                              <span className="col-span-2 text-center font-mono text-slate-700">
                                {sup.totalQtyPurchased} Units
                              </span>
                              <span className="col-span-2 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(sup.lastPurchaseCost)}
                              </span>
                              <span className="col-span-2 text-right font-mono text-slate-600">
                                {formatCurrency(sup.avgPurchaseCost)}
                              </span>
                              <span className="col-span-1 text-right text-slate-500 font-mono text-[10px]">
                                {new Date(sup.lastPurchaseDate).toLocaleDateString()}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 8: PROFIT ANALYSIS */}
                  {activeTab === 'profit' && (
                    <div className="space-y-6">
                      <h4 className="font-bold text-slate-900">Batch-Level Cost of Goods Sold & Profitability</h4>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                          <span className="text-slate-500 text-[10px] font-bold uppercase">Total Retail Revenue</span>
                          <h3 className="text-lg font-bold text-slate-900 font-mono mt-1">
                            {formatCurrency(productSales.reduce((acc, s) => acc + s.totalAmount, 0))}
                          </h3>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                          <span className="text-slate-500 text-[10px] font-bold uppercase">Actual Batch COGS</span>
                          <h3 className="text-lg font-bold text-slate-700 font-mono mt-1">
                            {formatCurrency(productSales.reduce((acc, s) => acc + s.actualCogs, 0))}
                          </h3>
                        </div>

                        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                          <span className="text-emerald-700 text-[10px] font-bold uppercase">Total Gross Profit</span>
                          <h3 className="text-lg font-bold text-emerald-800 font-mono mt-1">
                            {formatCurrency(productSales.reduce((acc, s) => acc + s.marginAmount, 0))}
                          </h3>
                        </div>

                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                          <span className="text-purple-700 text-[10px] font-bold uppercase">Gross Margin %</span>
                          <h3 className="text-lg font-bold text-purple-800 font-mono mt-1">
                            {(() => {
                              const rev = productSales.reduce((acc, s) => acc + s.totalAmount, 0);
                              const prof = productSales.reduce((acc, s) => acc + s.marginAmount, 0);
                              return rev > 0 ? `${((prof / rev) * 100).toFixed(1)}%` : '0.0%';
                            })()}
                          </h3>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 9: EXPIRY TRACKING */}
                  {activeTab === 'expiry' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900">First Expiry First Out (FEFO) Expiry Tracking</h4>
                        <span className="text-amber-700 text-[11px] font-bold bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                          FEFO Expiry Allocation Priority Active
                        </span>
                      </div>

                      <div className="border rounded-md overflow-hidden border-slate-200">
                        <div className="grid grid-cols-12 p-2.5 bg-slate-100 font-bold text-[11px] text-slate-600 border-b">
                          <span className="col-span-2">BATCH #</span>
                          <span className="col-span-2">EXPIRY DATE</span>
                          <span className="col-span-2 text-center">DAYS REMAINING</span>
                          <span className="col-span-2 text-center">REMAINING QTY</span>
                          <span className="col-span-2 text-right">UNIT COST</span>
                          <span className="col-span-2 text-right">EXPIRY STATUS</span>
                        </div>

                        {productBatches.filter((b) => b.expiryDate).length === 0 ? (
                          <div className="p-6 text-center text-slate-500">No expiry-controlled batches recorded.</div>
                        ) : (
                          productBatches
                            .filter((b) => b.expiryDate)
                            .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime())
                            .map((b) => {
                              const expDate = new Date(b.expiryDate!);
                              const now = new Date();
                              const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
                              const isExpired = diffDays < 0;
                              const isNearExpiry = diffDays >= 0 && diffDays <= 30;

                              return (
                                <div
                                  key={b.id}
                                  className={`grid grid-cols-12 p-2.5 items-center border-b border-slate-100 ${
                                    isExpired ? 'bg-red-50/70' : isNearExpiry ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <span className="col-span-2 font-mono font-bold text-slate-900">{b.batchNumber}</span>
                                  <span className="col-span-2 font-mono font-bold text-slate-800">
                                    {expDate.toLocaleDateString()}
                                  </span>
                                  <span
                                    className={`col-span-2 text-center font-mono font-bold ${
                                      isExpired ? 'text-red-600' : isNearExpiry ? 'text-amber-700' : 'text-slate-700'
                                    }`}
                                  >
                                    {isExpired ? `EXPIRED (${Math.abs(diffDays)}d ago)` : `${diffDays} Days`}
                                  </span>
                                  <span className="col-span-2 text-center font-mono font-bold text-slate-900">
                                    {b.quantityRemaining}
                                  </span>
                                  <span className="col-span-2 text-right font-mono">{formatCurrency(b.unitCost)}</span>
                                  <span className="col-span-2 text-right">
                                    {isExpired ? (
                                      <Badge variant="destructive" className="text-[9px]">
                                        EXPIRED
                                      </Badge>
                                    ) : isNearExpiry ? (
                                      <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-800 bg-amber-100">
                                        NEAR EXPIRY
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[9px]">
                                        VALID
                                      </Badge>
                                    )}
                                  </span>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* BATCH DETAIL SUB-MODAL */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <Card className="max-w-2xl w-full border-slate-300 shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-indigo-900 text-white py-3 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-400" /> Batch Lot Details — {selectedBatch.batchNumber}
              </CardTitle>
              <button type="button" onClick={() => setSelectedBatch(null)} className="text-white/80 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-md border border-slate-200 font-medium text-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier:</span>
                  <span className="font-bold">{selectedBatch.supplierName || 'Opening Stock'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Purchase Date:</span>
                  <span>{new Date(selectedBatch.receivedDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Original Qty Received:</span>
                  <span className="font-mono font-bold">{selectedBatch.quantityReceived}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Available Qty Remaining:</span>
                  <span className="font-mono font-bold text-emerald-700">{selectedBatch.quantityRemaining}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Purchase Unit Cost:</span>
                  <span className="font-mono font-bold">{formatCurrency(selectedBatch.unitCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Expiry Date:</span>
                  <span className="font-mono">
                    {selectedBatch.expiryDate ? new Date(selectedBatch.expiryDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2">Batch Lot Transaction History</h4>
                <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-12 p-2 bg-slate-100 font-bold text-[10px] text-slate-600 border-b">
                    <span className="col-span-3">DATE</span>
                    <span className="col-span-3">TYPE</span>
                    <span className="col-span-3 text-center">+ IN / - OUT</span>
                    <span className="col-span-3 text-right">BALANCE</span>
                  </div>
                  {isLoadingBatchDetail ? (
                    <div className="p-4 text-center text-slate-500">Loading batch audit log...</div>
                  ) : batchTransactions.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">No transaction records logged.</div>
                  ) : (
                    batchTransactions.map((tx) => (
                      <div key={tx.id} className="grid grid-cols-12 p-2 text-[11px] border-b border-slate-100">
                        <span className="col-span-3 text-slate-500 font-mono">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </span>
                        <span className="col-span-3 font-bold text-slate-800">{tx.transactionType}</span>
                        <span
                          className={`col-span-3 text-center font-mono font-bold ${
                            tx.quantityIn > 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {tx.quantityIn > 0 ? `+${tx.quantityIn}` : `-${tx.quantityOut}`}
                        </span>
                        <span className="col-span-3 text-right font-mono font-bold">{tx.balanceQuantity}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedBatch(null)} className="text-xs font-bold px-4">
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CONTROLLED STOCK ADJUSTMENT MODAL */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <Card className="max-w-lg w-full border-amber-300 shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white py-3.5 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-amber-400" /> Perform Controlled Stock Adjustment
              </CardTitle>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={executeStockAdjustment} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700">Target Product *</label>
                  <select
                    value={adjProductId}
                    onChange={(e) => {
                      setAdjProductId(e.target.value);
                      setAdjBatchId('');
                    }}
                    required
                    className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Target Product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (SKU: {p.sku}) — Stock: {p.stockQuantity}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Target Inventory Batch *</label>
                  <select
                    value={adjBatchId}
                    onChange={(e) => setAdjBatchId(e.target.value)}
                    required
                    className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Batch Lot...</option>
                    {allBatches
                      .filter((b) => b.productId === adjProductId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batchNumber} (Avail: {b.quantityRemaining}, Cost: {formatCurrency(b.unitCost)}) —{' '}
                          {b.supplierName || 'Opening'}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700">Adjustment Type *</label>
                    <select
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value as any)}
                      className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
                    >
                      <option value="DAMAGE">Damage / Broken (-)</option>
                      <option value="EXPIRED">Expired Lot (-)</option>
                      <option value="MISSING">Missing / Theft (-)</option>
                      <option value="FOUND">Stock Found (+)</option>
                      <option value="INCREASE">Manual Increase (+)</option>
                      <option value="DECREASE">Manual Decrease (-)</option>
                      <option value="CORRECTION">Audit Correction</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">Adjustment Quantity *</label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={adjQuantity}
                      onChange={(e) => setAdjQuantity(e.target.value)}
                      required
                      className="mt-1 font-mono text-emerald-700 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Mandatory Audit Reason *</label>
                  <Input
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    required
                    placeholder="e.g. Damaged during warehouse transport"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Additional Notes</label>
                  <Input
                    value={adjNotes}
                    onChange={(e) => setAdjNotes(e.target.value)}
                    placeholder="Optional supervisor reference"
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAdjustmentModalOpen(false)}
                    className="text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingAdj}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 cursor-pointer"
                  >
                    {isSubmittingAdj ? 'Committing Audit...' : 'Confirm & Commit Stock Adjustment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CONFIRM SAVE MODAL */}
      {isConfirmSaveOpen && pendingSaveData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <Card className="max-w-md w-full border-emerald-300 shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-emerald-600 text-white py-3 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Check className="h-4 w-4" /> Confirm Product Details
              </CardTitle>
              <button type="button" onClick={() => setIsConfirmSaveOpen(false)} className="text-white/80 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">Review product details before updating catalog master database:</p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 font-medium text-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-bold">{pendingSaveData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SKU Code:</span>
                  <span className="font-mono">{pendingSaveData.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cost Price:</span>
                  <span className="font-mono">{formatCurrency(pendingSaveData.costPrice || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Selling Price:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatCurrency(pendingSaveData.sellingPrice || 0)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmSaveOpen(false)}
                  className="text-xs font-semibold"
                >
                  Back & Edit
                </Button>
                <Button
                  type="button"
                  onClick={executeSaveProduct}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 cursor-pointer"
                >
                  Confirm & Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <Card className="max-w-md w-full border-red-300 shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-red-600 text-white py-3 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Confirm Product Deletion
              </CardTitle>
              <button type="button" onClick={() => setProductToDelete(null)} className="text-white/80 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-red-100 text-red-600 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-800 font-bold">Delete master product record?</p>
                  <p className="text-slate-500 text-xs">
                    Removing <strong className="text-slate-900">{productToDelete.name}</strong> (SKU:{' '}
                    <span className="font-mono">{productToDelete.sku}</span>) will archive it from catalog list.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProductToDelete(null)}
                  className="text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={executeDeleteProduct}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 cursor-pointer"
                >
                  Delete Product
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Management Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesUpdated={loadInitialData}
      />
    </div>
  );
}
