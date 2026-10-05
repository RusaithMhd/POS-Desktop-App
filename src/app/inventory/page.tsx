'use client';

import React, { useState, useEffect } from 'react';
import { Layers, ShieldCheck, Search } from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteInventoryRepository, SQLiteProductRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { InventoryMovementEntity } from '@/domain/entities/InventoryMovement';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function InventoryPage() {
  return (
    <PermissionGuard permission={['inventory.view', 'inventory.adjust']} moduleName="Inventory Ledger & Stock Audit">
      <InventoryContent />
    </PermissionGuard>
  );
}

function InventoryContent() {
  const [movements, setMovements] = useState<InventoryMovementEntity[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadLedgerData();
  }, []);

  const loadLedgerData = async () => {
    try {
      await getLocalDb();
      const invRepo = new SQLiteInventoryRepository();
      const prodRepo = new SQLiteProductRepository();

      const [movs, prods] = await Promise.all([
        invRepo.getRecentMovements(1000),
        prodRepo.getAll(),
      ]);

      const map = new Map<string, string>();
      prods.forEach((p) => map.set(p.id, p.name));

      setMovements(movs);
      setProductsMap(map);
    } catch (err) {
      console.error('Failed to load ledger:', err);
    }
  };

  const filtered = movements.filter((m) => {
    const prodName = (productsMap.get(m.productId) || m.productId).toLowerCase();
    const type = m.movementType.toLowerCase();
    const q = search.toLowerCase();
    return prodName.includes(q) || type.includes(q) || (m.reason && m.reason.toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedMovements = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Layers className="h-5 w-5 text-emerald-600" /> Inventory Movement Ledger
        </h2>
        <p className="text-xs text-slate-500">Traceable audit movements for every stock change across purchases, sales, and adjustments</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search stock movement ledger by product, movement type, or reason..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 bg-white border-slate-200"
        />
      </div>

      <Card className="overflow-hidden border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span>Stock Ledger Audit Trail ({filtered.length} Entries)</span>
            <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Immutable Audit Trail
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50">
              <span className="col-span-4">PRODUCT ITEM</span>
              <span className="col-span-2">TYPE</span>
              <span className="col-span-2 text-right">CHANGE</span>
              <span className="col-span-2 text-right">NEW BALANCE</span>
              <span className="col-span-2 text-right">TIME</span>
            </div>
            {paginatedMovements.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                No inventory movements recorded.
              </div>
            ) : (
              paginatedMovements.map((m) => (
                <div key={m.id} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors">
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
                  <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                    {m.newQuantity}
                  </div>
                  <div className="col-span-2 text-right text-[10px] text-slate-500">
                    {new Date(m.createdAt).toLocaleTimeString()}
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
