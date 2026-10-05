'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Package, CreditCard } from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteSaleRepository, SQLiteProductRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { SaleEntity } from '@/domain/entities/Sale';
import { ProductEntity } from '@/domain/entities/Product';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function ReportsPage() {
  return (
    <PermissionGuard permission={['reports.view', 'reports.financial', 'reports.export']} moduleName="Business Analytics & Reports">
      <ReportsContent />
    </PermissionGuard>
  );
}

function ReportsContent() {
  const [sales, setSales] = useState<SaleEntity[]>([]);
  const [products, setProducts] = useState<ProductEntity[]>([]);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    try {
      await getLocalDb();
      const saleRepo = new SQLiteSaleRepository();
      const productRepo = new SQLiteProductRepository();

      const [sList, pList] = await Promise.all([
        saleRepo.getRecentSales(100),
        productRepo.getAll(),
      ]);

      setSales(sList);
      setProducts(pList);
    } catch (err) {
      console.error(err);
    }
  };

  const totalGrossSales = sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalTax = sales.reduce((acc, s) => acc + s.taxAmount, 0);
  const totalDiscounts = sales.reduce((acc, s) => acc + s.discountAmount, 0);
  const netSales = Math.max(0, totalGrossSales - totalTax);

  const lowStockCount = products.filter((p) => p.stockQuantity <= p.minStockLevel).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-600" /> Operational & Financial Reports
        </h2>
        <p className="text-xs text-slate-500">Offline analytical metrics computed directly from local SQLite database</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Gross Revenue</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-2">{formatCurrency(totalGrossSales)}</div>
          <div className="text-[11px] text-slate-500 mt-1">{sales.length} Receipts Processed</div>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Net Sales</span>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-2">{formatCurrency(netSales)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Tax collected: {formatCurrency(totalTax)}</div>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Discounts</span>
            <CreditCard className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-700 font-mono mt-2">{formatCurrency(totalDiscounts)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total discounts given</div>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase">
            <span>Low Stock Items</span>
            <Package className="h-4 w-4 text-red-600" />
          </div>
          <div className="text-2xl font-extrabold text-red-600 font-mono mt-2">{lowStockCount} Products</div>
          <div className="text-[11px] text-slate-500 mt-1">Below minimum stock</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Sales Log History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {sales.map((s) => (
              <div key={s.id} className="p-3 bg-white flex items-center justify-between text-xs hover:bg-slate-50">
                <div>
                  <div className="font-bold font-mono text-slate-900">{s.invoiceNumber}</div>
                  <div className="text-[10px] text-slate-500">{new Date(s.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-600">{formatCurrency(s.totalAmount)}</div>
                  <div className="text-[10px] text-slate-500">{s.items.length} items</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
