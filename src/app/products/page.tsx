'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit, Trash2, AlertTriangle, Check, X, Filter, Layers } from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteProductRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { ProductEntity, CategoryEntity, UnitEntity } from '@/domain/entities/Product';
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
    <PermissionGuard permission={['products.view', 'products.create', 'products.edit', 'products.delete']} moduleName="Product Catalog Management">
      <ProductsContent />
    </PermissionGuard>
  );
}

function ProductsContent() {
  const [products, setProducts] = useState<ProductEntity[]>([]);
  const [categories, setCategories] = useState<CategoryEntity[]>([]);
  const [units, setUnits] = useState<UnitEntity[]>([]);
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form inputs
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('5');
  const [taxRate, setTaxRate] = useState('0');
  const [description, setDescription] = useState('');

  // Confirmation Modals State
  const [pendingSaveData, setPendingSaveData] = useState<Partial<ProductEntity> | null>(null);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductEntity | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const productRepo = new SQLiteProductRepository();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      await getLocalDb();
      const [prodList, catList, unitList] = await Promise.all([
        productRepo.getAll(),
        productRepo.getCategories(),
        productRepo.getUnits(),
      ]);
      setProducts(prodList);
      setCategories(catList);
      setUnits(unitList);
    } catch (err) {
      console.error('Failed to load products data:', err);
    }
  };

  const resetForm = () => {
    setEditingProductId(null);
    setName('');
    setSku('');
    setBarcode('');
    setCategoryId('');
    setUnitId('');
    setCostPrice('');
    setSellingPrice('');
    setStockQuantity('');
    setMinStockLevel('5');
    setTaxRate('0');
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
    setCostPrice(product.costPrice.toString());
    setSellingPrice(product.sellingPrice.toString());
    setStockQuantity(product.stockQuantity.toString());
    setMinStockLevel(product.minStockLevel.toString());
    setTaxRate(product.taxRate ? product.taxRate.toString() : '0');
    setDescription(product.description || '');
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Trigger Save Confirmation step
  const handlePreSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<ProductEntity> = {
      id: editingProductId || undefined,
      name: name.trim(),
      sku: sku.trim(),
      barcode: barcode.trim() || null,
      categoryId: categoryId || null,
      unitId: unitId || null,
      costPrice: parseFloat(costPrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      stockQuantity: parseFloat(stockQuantity) || 0,
      minStockLevel: parseFloat(minStockLevel) || 5,
      taxRate: parseFloat(taxRate) || 0,
      description: description.trim() || null,
      isActive: true,
    };
    setPendingSaveData(payload);
    setIsConfirmSaveOpen(true);
  };

  // Commit Save after User Confirmation
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

  // Execute Delete after User Confirmation
  const executeDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await productRepo.delete(productToDelete.id);
      setProductToDelete(null);
      await loadInitialData();
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search));
    const matchesCategory = !categoryFilter || p.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedProducts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-emerald-600" /> Products Catalog Management
          </h2>
          <p className="text-xs text-slate-500">Manage catalog products, pricing rules, inventory thresholds, and barcodes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsCategoryModalOpen(true)}
            className="border-slate-300 font-bold gap-2 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            <Layers className="h-4 w-4 text-emerald-600" /> Manage Categories
          </Button>

          <Button
            onClick={() => {
              if (isFormOpen) {
                resetForm();
              } else {
                resetForm();
                setIsFormOpen(true);
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 cursor-pointer shadow-sm"
          >
            {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isFormOpen ? 'Close Form' : 'Add New Product'}
          </Button>
        </div>
      </div>

      {/* Add / Edit Product Form Container */}
      {isFormOpen && (
        <Card className="border-emerald-300 shadow-md bg-white">
          <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 py-3 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              {editingProductId ? <Edit className="h-4 w-4 text-emerald-600" /> : <Plus className="h-4 w-4 text-emerald-600" />}
              {editingProductId ? 'Edit Product Details' : 'Add New Product to Catalog'}
            </CardTitle>
            <span className="text-xs text-slate-500 font-medium">All fields with * are required</span>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handlePreSaveSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-700">Product Name *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Organic Almond Milk 1L"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">SKU Code *</label>
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                    placeholder="SKU-BEV-09"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Barcode (EAN / UPC)</label>
                  <Input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="890100010099"
                    className="mt-1"
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
                  <label className="font-bold text-slate-700">Tax Rate (%)</label>
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
                    placeholder="180.00"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Selling Price (LKR) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    required
                    placeholder="450.00"
                    className="mt-1 font-mono text-emerald-700 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Stock Quantity *</label>
                  <Input
                    type="number"
                    step="1"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    required
                    placeholder="100"
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Minimum Stock Warning Level</label>
                  <Input
                    type="number"
                    step="1"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(e.target.value)}
                    placeholder="5"
                    className="mt-1 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700">Description / Notes</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional product notes or specification"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={resetForm} className="text-xs font-semibold">
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 cursor-pointer">
                  {editingProductId ? 'Update Product' : 'Save Product'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search product name, SKU, or barcode..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-white border-slate-200"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-200 bg-white text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      <Card className="overflow-hidden border-slate-200 shadow-xs">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200">
              <span className="col-span-3">PRODUCT DETAILS</span>
              <span className="col-span-2">SKU / BARCODE</span>
              <span className="col-span-2 text-right">COST PRICE</span>
              <span className="col-span-2 text-right">SELLING PRICE</span>
              <span className="col-span-1 text-center">STOCK</span>
              <span className="col-span-2 text-right pr-2">ACTIONS</span>
            </div>
            {paginatedProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                No products found in catalog.
              </div>
            ) : (
              paginatedProducts.map((p) => {
                const categoryObj = categories.find((c) => c.id === p.categoryId);
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <div className="col-span-3 font-bold flex flex-col">
                      <span>{p.name}</span>
                      {categoryObj && <span className="text-[10px] text-slate-400 font-normal">{categoryObj.name}</span>}
                    </div>
                    <div className="col-span-2 font-mono text-[11px] text-slate-500">
                      <div>{p.sku}</div>
                      {p.barcode && <div className="text-[10px] text-slate-400">{p.barcode}</div>}
                    </div>
                    <div className="col-span-2 text-right font-mono text-slate-600">{formatCurrency(p.costPrice)}</div>
                    <div className="col-span-2 text-right font-mono font-bold text-emerald-700">{formatCurrency(p.sellingPrice)}</div>
                    <div className="col-span-1 text-center font-mono font-bold">
                      <Badge variant={p.stockQuantity <= p.minStockLevel ? 'destructive' : 'secondary'}>
                        {p.stockQuantity}
                      </Badge>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(p)}
                        className="h-8 px-2 text-blue-700 border-blue-200 hover:bg-blue-50 cursor-pointer"
                        title="Edit product"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setProductToDelete(p)}
                        className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
                        title="Delete product"
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
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* CONFIRM SAVE / UPDATE MODAL */}
      {isConfirmSaveOpen && pendingSaveData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <Card className="max-w-md w-full border-emerald-300 shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-emerald-600 text-white py-3 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Check className="h-4 w-4" /> Confirm Product Details
              </CardTitle>
              <button
                type="button"
                onClick={() => setIsConfirmSaveOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Please review the product details before {editingProductId ? 'updating' : 'saving to'} the catalog:
              </p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 font-medium text-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-bold">{pendingSaveData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SKU Code:</span>
                  <span className="font-mono">{pendingSaveData.sku}</span>
                </div>
                {pendingSaveData.barcode && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Barcode:</span>
                    <span className="font-mono">{pendingSaveData.barcode}</span>
                  </div>
                )}
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
                <div className="flex justify-between">
                  <span className="text-slate-500">Stock Quantity:</span>
                  <span className="font-mono font-bold">{pendingSaveData.stockQuantity}</span>
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
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-red-100 text-red-600 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-800 font-bold">
                    Are you sure you want to delete this product?
                  </p>
                  <p className="text-slate-500 text-xs">
                    This action will remove <strong className="text-slate-900">{productToDelete.name}</strong> (SKU:{' '}
                    <span className="font-mono">{productToDelete.sku}</span>) from the active catalog database.
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

