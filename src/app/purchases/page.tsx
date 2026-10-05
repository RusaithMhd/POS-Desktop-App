'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search } from 'lucide-react';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { AuthService } from '@/features/auth/AuthService';
import { AccountingService } from '@/services/accounting/AccountingService';
import { SQLiteInventoryRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function PurchasesPage() {
  return (
    <PermissionGuard permission={['purchasing.view', 'purchasing.create', 'purchasing.receive', 'purchases.manage']} moduleName="Purchase Orders & Receiving">
      <PurchasesContent />
    </PermissionGuard>
  );
}

function PurchasesContent() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('50');
  const [unitCost, setUnitCost] = useState('100.00');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadPurchasesData();
  }, []);

  const loadPurchasesData = async () => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();

      const pStmt = raw.prepare('SELECT p.*, s.name as supplier_name FROM purchases p JOIN suppliers s ON p.supplier_id = s.id ORDER BY p.created_at DESC');
      const pList: any[] = [];
      while (pStmt.step()) {
        pList.push(pStmt.getAsObject());
      }
      pStmt.free();

      const sStmt = raw.prepare('SELECT * FROM suppliers ORDER BY name ASC');
      const sList: any[] = [];
      while (sStmt.step()) {
        sList.push(sStmt.getAsObject());
      }
      sStmt.free();

      const prodStmt = raw.prepare('SELECT * FROM products ORDER BY name ASC');
      const prodList: any[] = [];
      while (prodStmt.step()) {
        prodList.push(prodStmt.getAsObject());
      }
      prodStmt.free();

      setPurchases(pList);
      setSuppliers(sList);
      setProducts(prodList);
      if (sList.length > 0) setSupplierId(sList[0].id);
      if (prodList.length > 0) setProductId(prodList[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReceiveStockPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const user = AuthService.getActiveSession();
      if (!user) return;

      const qty = parseFloat(quantity) || 0;
      const cost = parseFloat(unitCost) || 0;
      const totalCost = qty * cost;
      const now = new Date().toISOString();

      const purchaseId = `pur-${Date.now()}`;
      const invoiceNumber = `PO-${Date.now().toString().slice(-6)}`;

      raw.run('BEGIN TRANSACTION;');
      try {
        // 1. Create Purchase
        raw.run(
          `INSERT INTO purchases (id, business_id, branch_id, supplier_id, invoice_number, total_amount, paid_amount, payment_status, notes, created_at, updated_at)
           VALUES (?, 'biz-001', 'branch-001', ?, ?, ?, ?, 'PAID', 'Stock Order Received', ?, ?)`,
          [purchaseId, supplierId, invoiceNumber, totalCost, totalCost, now, now]
        );

        // 2. Fetch current stock
        const prodStmt = raw.prepare('SELECT stock_quantity FROM products WHERE id = :id');
        prodStmt.bind({ ':id': productId });
        let currentStock = 0;
        if (prodStmt.step()) {
          currentStock = (prodStmt.getAsObject().stock_quantity as number) || 0;
        }
        prodStmt.free();

        const newStock = currentStock + qty;

        // 3. Update stock quantity
        raw.run('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, productId]);
        raw.run('UPDATE inventory SET quantity = ? WHERE product_id = ?', [newStock, productId]);

        // 4. Record Traceable Inventory Movement Ledger Entry
        const invRepo = new SQLiteInventoryRepository();
        await invRepo.recordMovement({
          branchId: 'branch-001',
          productId,
          movementType: 'PURCHASE',
          referenceType: 'purchase',
          referenceId: purchaseId,
          quantityChange: qty,
          previousQuantity: currentStock,
          newQuantity: newStock,
          userId: user.id,
          reason: `Purchase Receiving Invoice #${invoiceNumber}`,
        });

        // 5. Record Double-Entry Accounting Journal
        AccountingService.recordPurchase(raw, {
          purchaseId,
          invoiceNumber,
          supplierId,
          userId: user.id,
          totalAmount: totalCost,
          paidAmount: totalCost,
          paymentMethod: 'CASH',
        });

        raw.run('COMMIT;');
      } catch (err) {
        raw.run('ROLLBACK;');
        throw err;
      }

      setIsFormOpen(false);
      await loadPurchasesData();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = purchases.filter((p) => p.invoice_number.toLowerCase().includes(search.toLowerCase()));

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedPurchases = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-600" /> Stock Purchase Orders & Receiving
          </h2>
          <p className="text-xs text-slate-500">Record stock purchase receiving from suppliers and update inventory ledgers in LKR</p>
        </div>
        <Button onClick={() => setIsFormOpen(!isFormOpen)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
          <Plus className="h-4 w-4" /> {isFormOpen ? 'Close Form' : 'Receive New Purchase'}
        </Button>
      </div>

      {isFormOpen && (
        <Card className="border-emerald-200">
          <CardHeader><CardTitle className="text-sm font-bold">Receive Supplier Stock Purchase</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleReceiveStockPurchase} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700">Supplier Vendor</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700">Product Item</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700">Quantity Received (+)</label>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required placeholder="50" className="mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Unit Cost Price (LKR)</label>
                <Input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required placeholder="100.00" className="mt-1" />
              </div>
              <div className="sm:col-span-4 flex justify-end">
                <Button type="submit" className="bg-emerald-600 text-white font-bold px-6">Receive Stock & Create Movement</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search by purchase invoice number..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 bg-white border-slate-200"
        />
      </div>

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
              <span className="col-span-4">INVOICE NUMBER</span>
              <span className="col-span-4">SUPPLIER</span>
              <span className="col-span-2">STATUS</span>
              <span className="col-span-2 text-right">TOTAL AMOUNT (LKR)</span>
            </div>
            {paginatedPurchases.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                No purchase orders found.
              </div>
            ) : (
              paginatedPurchases.map((p) => (
                <div key={p.id} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors">
                  <span className="col-span-4 font-mono font-bold">{p.invoice_number}</span>
                  <span className="col-span-4 font-semibold text-slate-700">{p.supplier_name}</span>
                  <span className="col-span-2">
                    <Badge variant="default" className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {p.payment_status}
                    </Badge>
                  </span>
                  <span className="col-span-2 text-right font-mono font-bold text-slate-900">{formatCurrency(p.total_amount)}</span>
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
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
