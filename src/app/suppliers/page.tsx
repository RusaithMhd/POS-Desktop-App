'use client';

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  DollarSign, 
  FileText, 
  CreditCard, 
  Eye, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  History,
  Tag
} from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteSupplierRepository, SQLiteInventoryBatchRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { SupplierEntity } from '@/domain/entities/Supplier';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { formatCurrency } from '@/lib/utils';

export default function SuppliersPage() {
  return (
    <PermissionGuard permission={['suppliers.manage', 'suppliers.view']} moduleName="Supplier Directory & Vendor Accounts">
      <SuppliersContent />
    </PermissionGuard>
  );
}

function SuppliersContent() {
  const supplierRepo = new SQLiteSupplierRepository();
  const batchRepo = new SQLiteInventoryBatchRepository();

  const [suppliers, setSuppliers] = useState<SupplierEntity[]>([]);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierEntity | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 Days');
  const [creditLimit, setCreditLimit] = useState('100000');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [notes, setNotes] = useState('');

  // Payment Form State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');

  // Supplier Statement & Profile State
  const [activeTab, setActiveTab] = useState<'profile' | 'purchases' | 'statement' | 'payments'>('profile');
  const [statementRows, setStatementRows] = useState<any[]>([]);
  const [purchasesList, setPurchasesList] = useState<any[]>([]);

  // Notifications
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      await getLocalDb();
      const list = await supplierRepo.getAll();
      setSuppliers(list);
    } catch (err: any) {
      console.error('Failed to load suppliers:', err);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supplierRepo.save({
        code: code.trim() || undefined,
        name: name.trim(),
        companyName: companyName.trim() || null,
        contactPerson: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        taxNumber: taxNumber.trim() || null,
        paymentTerms,
        creditLimit: parseFloat(creditLimit) || 0,
        openingBalance: parseFloat(openingBalance) || 0,
        currentOutstanding: parseFloat(openingBalance) || 0,
        notes: notes.trim() || null,
        status: 'ACTIVE',
      });

      setMessage('Supplier account created successfully.');
      setTimeout(() => setMessage(''), 4000);

      setIsFormOpen(false);
      resetForm();
      await loadSuppliers();
    } catch (err: any) {
      setError(`Failed to create supplier: ${err.message}`);
      setTimeout(() => setError(''), 4000);
    }
  };

  const resetForm = () => {
    setCode('');
    setName('');
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setTaxNumber('');
    setPaymentTerms('30 Days');
    setCreditLimit('100000');
    setOpeningBalance('0');
    setNotes('');
  };

  const openSupplierProfile = async (supplier: SupplierEntity) => {
    setSelectedSupplier(supplier);
    setActiveTab('profile');
    try {
      const stmt = await supplierRepo.getSupplierStatement(supplier.id);
      setStatementRows(stmt);
      const purch = await supplierRepo.getSupplierPurchases(supplier.id);
      setPurchasesList(purch);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    try {
      await supplierRepo.recordPayment({
        supplierId: selectedSupplier.id,
        amount: amt,
        paymentMethod,
        referenceNumber: paymentRef || undefined,
        userId: 'Admin',
      });

      setMessage(`Recorded payment of ${formatCurrency(amt)} to ${selectedSupplier.name}`);
      setTimeout(() => setMessage(''), 4000);

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentRef('');

      // Reload profile
      const updated = await supplierRepo.getById(selectedSupplier.id);
      if (updated) setSelectedSupplier(updated);
      await loadSuppliers();
      if (selectedSupplier) {
        setStatementRows(await supplierRepo.getSupplierStatement(selectedSupplier.id));
      }
    } catch (err: any) {
      setError(`Payment processing failed: ${err.message}`);
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.companyName && s.companyName.toLowerCase().includes(search.toLowerCase())) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
      (s.phone && s.phone.includes(search))
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedSuppliers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalOutstandingAll = suppliers.reduce((sum, s) => sum + (s.currentOutstanding || 0), 0);
  const totalActiveSuppliers = suppliers.filter((s) => s.status === 'ACTIVE').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-emerald-600" /> Supplier Directory & Vendor Management
          </h2>
          <p className="text-xs text-slate-500">
            Manage vendor profiles, purchase batch histories, payment statements, and accounts payable
          </p>
        </div>
        <Button
          onClick={() => { setIsFormOpen(!isFormOpen); resetForm(); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> {isFormOpen ? 'Close Registration Form' : 'Register New Supplier'}
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Total Suppliers</div>
              <div className="text-xl font-black text-slate-900">{suppliers.length} ({totalActiveSuppliers} Active)</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Total Accounts Payable</div>
              <div className="text-xl font-black text-amber-700">{formatCurrency(totalOutstandingAll)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Payment Terms</div>
              <div className="text-sm font-bold text-slate-900">Standard 30 Days Net</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Supplier Form */}
      {isFormOpen && (
        <Card className="border-emerald-200 shadow-md">
          <CardHeader><CardTitle className="text-sm font-bold">Register New Supplier / Vendor Account</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-700">Supplier Code (Auto if empty)</label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SUP-0010" className="mt-1 font-mono" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Supplier Name *</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. ABC Distributors Ltd." className="mt-1" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Company Name / Trade Name</label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ABC Group Holdings" className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="font-bold text-slate-700">Contact Person</label>
                  <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Mohamed Rusaith" className="mt-1" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Phone Number *</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+94 11 234 5678" className="mt-1" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Email Address</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="sales@abcdistributors.com" className="mt-1" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Tax / VAT Registration No.</label>
                  <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} placeholder="TAX-998822" className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-700">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                  >
                    <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                    <option value="7 Days">Net 7 Days</option>
                    <option value="14 Days">Net 14 Days</option>
                    <option value="30 Days">Net 30 Days</option>
                    <option value="60 Days">Net 60 Days</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Credit Limit</label>
                  <Input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} type="number" className="mt-1 font-mono" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Opening Outstanding Balance</label>
                  <Input value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} type="number" className="mt-1 font-mono" />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Physical Business Address</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="100 Commercial Street, Colombo 03" className="mt-1" />
              </div>

              <div>
                <label className="font-bold text-slate-700">Supplier Notes</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Primary beverage & confectionery supplier" className="mt-1" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6">Save Supplier Account</Button>
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
          placeholder="Search supplier by code, company name, contact person or phone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="pl-9 bg-white border-slate-200"
        />
      </div>

      {/* Supplier List Table */}
      <Card className="overflow-hidden border-slate-200">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 p-3 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200">
              <span className="col-span-2">CODE</span>
              <span className="col-span-3">SUPPLIER NAME</span>
              <span className="col-span-3">CONTACT / PHONE</span>
              <span className="col-span-2 text-right">OUTSTANDING</span>
              <span className="col-span-2 text-right">ACTION</span>
            </div>
            {paginatedSuppliers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                No suppliers match your search filter.
              </div>
            ) : (
              paginatedSuppliers.map((s) => (
                <div key={s.id} className="grid grid-cols-12 p-3 items-center text-xs text-slate-900 hover:bg-slate-50 transition-colors">
                  <span className="col-span-2 font-mono font-bold text-slate-700">{s.code}</span>
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{s.name}</div>
                    {s.companyName && <div className="text-[10px] text-slate-500">{s.companyName}</div>}
                  </div>
                  <div className="col-span-3 text-slate-700">
                    <div>{s.contactPerson || 'N/A'}</div>
                    <div className="font-mono text-[10.5px] text-slate-500">{s.phone}</div>
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-amber-800">
                    {formatCurrency(s.currentOutstanding || 0)}
                  </div>
                  <div className="col-span-2 text-right">
                    <Button onClick={() => openSupplierProfile(s)} variant="outline" size="sm" className="h-7 text-xs font-bold gap-1 cursor-pointer">
                      <Eye className="h-3.5 w-3.5 text-emerald-600" /> View Profile
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

      {/* SUPPLIER PROFILE & DASHBOARD MODAL */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-md text-emerald-800 font-bold font-mono text-sm">
                  {selectedSupplier.code}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">{selectedSupplier.name}</h3>
                  <div className="text-xs text-slate-500">{selectedSupplier.companyName || 'Supplier Account Profile'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setIsPaymentModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 cursor-pointer">
                  <CreditCard className="h-3.5 w-3.5" /> Record Payment
                </Button>
                <Button onClick={() => setSelectedSupplier(null)} variant="outline" size="sm">Close</Button>
              </div>
            </div>

            {/* Profile Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 gap-4">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${activeTab === 'profile' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'}`}
              >
                Overview & Details
              </button>
              <button
                onClick={() => setActiveTab('purchases')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${activeTab === 'purchases' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'}`}
              >
                Purchase Orders ({purchasesList.length})
              </button>
              <button
                onClick={() => setActiveTab('statement')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${activeTab === 'statement' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'}`}
              >
                Supplier Statement ({statementRows.length})
              </button>
            </div>

            {/* Body Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {activeTab === 'profile' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <Card className="sm:col-span-2 border-slate-200">
                    <CardHeader><CardTitle className="text-xs font-bold">Contact & Billing Information</CardTitle></CardHeader>
                    <CardContent className="space-y-2 font-mono text-slate-800">
                      <div className="flex justify-between border-b border-slate-100 pb-1">
                        <span className="text-slate-500 font-sans">Contact Person:</span>
                        <span className="font-bold">{selectedSupplier.contactPerson || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1">
                        <span className="text-slate-500 font-sans">Phone:</span>
                        <span className="font-bold">{selectedSupplier.phone || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1">
                        <span className="text-slate-500 font-sans">Email:</span>
                        <span className="font-bold">{selectedSupplier.email || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1">
                        <span className="text-slate-500 font-sans">VAT/Tax No:</span>
                        <span className="font-bold">{selectedSupplier.taxNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-slate-500 font-sans">Address:</span>
                        <span className="font-bold">{selectedSupplier.address || 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 bg-slate-50">
                    <CardHeader><CardTitle className="text-xs font-bold">Financial Summary</CardTitle></CardHeader>
                    <CardContent className="space-y-3 font-mono text-slate-800">
                      <div className="p-3 bg-amber-100/60 border border-amber-200 rounded text-center">
                        <div className="text-[10px] text-amber-800 font-sans font-bold">CURRENT OUTSTANDING</div>
                        <div className="text-lg font-black text-amber-900">{formatCurrency(selectedSupplier.currentOutstanding)}</div>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="font-sans">Payment Terms:</span>
                        <span className="font-bold">{selectedSupplier.paymentTerms}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="font-sans">Credit Limit:</span>
                        <span className="font-bold">{formatCurrency(selectedSupplier.creditLimit)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'purchases' && (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-12 font-bold text-slate-500 p-2 bg-slate-50 border-b border-slate-200">
                    <span className="col-span-3">INVOICE NO</span>
                    <span className="col-span-3">DATE</span>
                    <span className="col-span-3 text-right">TOTAL AMOUNT</span>
                    <span className="col-span-3 text-right">STATUS</span>
                  </div>
                  {purchasesList.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">No purchases recorded for this supplier.</div>
                  ) : (
                    purchasesList.map((p) => (
                      <div key={p.id} className="grid grid-cols-12 p-2 items-center border-b border-slate-100 font-mono">
                        <span className="col-span-3 font-bold text-slate-900">{p.invoice_number}</span>
                        <span className="col-span-3 text-slate-600">{new Date(p.created_at).toLocaleDateString()}</span>
                        <span className="col-span-3 text-right font-bold">{formatCurrency(p.total_amount)}</span>
                        <span className="col-span-3 text-right">
                          <Badge className={p.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                            {p.payment_status}
                          </Badge>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'statement' && (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-12 font-bold text-slate-500 p-2 bg-slate-50 border-b border-slate-200">
                    <span className="col-span-3">DATE</span>
                    <span className="col-span-4">DESCRIPTION</span>
                    <span className="col-span-2 text-right">DEBIT</span>
                    <span className="col-span-3 text-right">BALANCE</span>
                  </div>
                  {statementRows.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">No statement transactions found.</div>
                  ) : (
                    statementRows.map((r, i) => (
                      <div key={i} className="grid grid-cols-12 p-2 items-center border-b border-slate-100 font-mono">
                        <span className="col-span-3 text-slate-600">{new Date(r.date).toLocaleDateString()}</span>
                        <span className="col-span-4 font-sans text-slate-800">{r.description}</span>
                        <span className="col-span-2 text-right">{r.debit > 0 ? formatCurrency(r.debit) : '-'}</span>
                        <span className="col-span-3 text-right font-bold text-slate-900">{formatCurrency(r.balance)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECORD SUPPLIER PAYMENT MODAL */}
      {isPaymentModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" /> Record Supplier Payment
              </h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                <div className="text-slate-600 font-semibold">Payable to: <span className="font-bold text-slate-900">{selectedSupplier.name}</span></div>
                <div className="text-slate-600 font-semibold">Current Outstanding: <span className="font-mono font-bold text-amber-800">{formatCurrency(selectedSupplier.currentOutstanding)}</span></div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Payment Amount *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  placeholder="e.g. 50000"
                  className="mt-1 font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                >
                  <option value="CASH">Cash Drawer</option>
                  <option value="BANK_TRANSFER">Bank Direct Transfer</option>
                  <option value="CHEQUE">Cheque Payment</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Reference / Cheque Number</label>
                <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="e.g. CHQ-99012" className="mt-1 font-mono" />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer">
                  Confirm Payment
                </Button>
                <Button type="button" onClick={() => setIsPaymentModalOpen(false)} variant="outline" className="flex-1 cursor-pointer">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
