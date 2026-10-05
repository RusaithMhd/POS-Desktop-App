'use client';

import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search } from 'lucide-react';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function SuppliersPage() {
  return (
    <PermissionGuard permission={['suppliers.manage', 'suppliers.view']} moduleName="Supplier Directory & Vendors">
      <SuppliersContent />
    </PermissionGuard>
  );
}

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadSuppliersData();
  }, []);

  const loadSuppliersData = async () => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const stmt = raw.prepare('SELECT * FROM suppliers ORDER BY name ASC');
      const list: any[] = [];
      while (stmt.step()) {
        list.push(stmt.getAsObject());
      }
      stmt.free();
      setSuppliers(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const now = new Date().toISOString();
      const id = `sup-${Date.now()}`;

      raw.run(
        `INSERT INTO suppliers (id, business_id, name, contact_person, phone, email, address, tax_id, created_at, updated_at)
         VALUES (?, 'biz-001', ?, ?, ?, ?, '', '', ?, ?)`,
        [id, name, contactPerson, phone, email || null, now, now]
      );

      setIsFormOpen(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      await loadSuppliersData();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone && s.phone.includes(search))
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedSuppliers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-emerald-600" /> Supplier Directory
          </h2>
          <p className="text-xs text-slate-500">Manage vendors, wholesale suppliers, and contact details</p>
        </div>
        <Button onClick={() => setIsFormOpen(!isFormOpen)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
          <Plus className="h-4 w-4" /> {isFormOpen ? 'Close Form' : 'Add New Supplier'}
        </Button>
      </div>

      {isFormOpen && (
        <Card className="border-emerald-200">
          <CardHeader><CardTitle className="text-sm font-bold">Register Supplier</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSupplier} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700">Company Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Global Beverage Distributors" className="mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Contact Person</label>
                <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} required placeholder="Robert Chen" className="mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Phone Number</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+94 11 234 5678" className="mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Email Address</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@globalbev.com" className="mt-1" />
              </div>
              <div className="sm:col-span-4 flex justify-end">
                <Button type="submit" className="bg-emerald-600 text-white font-bold px-6">Save Supplier</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search supplier by company or phone number..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 bg-white border-slate-200"
        />
      </div>

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
              <span className="col-span-4">COMPANY NAME</span>
              <span className="col-span-4">CONTACT PERSON</span>
              <span className="col-span-4">PHONE / EMAIL</span>
            </div>
            {paginatedSuppliers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                No suppliers found.
              </div>
            ) : (
              paginatedSuppliers.map((s) => (
                <div key={s.id} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors">
                  <span className="col-span-4 font-bold">{s.name}</span>
                  <span className="col-span-4 text-slate-700">{s.contact_person || 'N/A'}</span>
                  <span className="col-span-4 font-mono text-slate-600">{s.phone} {s.email ? `(${s.email})` : ''}</span>
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
