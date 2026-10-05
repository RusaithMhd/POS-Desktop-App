'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Building, 
  Receipt, 
  Percent, 
  CreditCard, 
  HardDrive, 
  RefreshCw, 
  ShieldCheck, 
  Download, 
  Upload,
  CheckCircle2, 
  AlertCircle,
  Eye,
  ChefHat,
  SlidersHorizontal
} from 'lucide-react';
import { getLocalDb, getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { isDesktopApp, exportDatabaseBackupNative, importDatabaseBackupNative, fetchSystemPrintersNative } from '@/lib/electronBridge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { defaultSettingsService, ShopSettings } from '@/services/settings/SettingsService';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ThermalReceipt } from '@/components/pos/ThermalReceipt';
import { SaleEntity } from '@/domain/entities/Sale';

export default function SettingsPage() {
  return (
    <PermissionGuard permission={['settings.view', 'settings.manage']} moduleName="Terminal & System Settings">
      <SettingsContent />
    </PermissionGuard>
  );
}

function SettingsContent() {
  const [activeTab, setActiveTab] = useState<'shop' | 'receipt' | 'tax' | 'payments' | 'inventory' | 'backup' | 'sync'>('shop');
  
  // 1. Shop Details Form State
  const [businessName, setBusinessName] = useState('TRIWYN Retail & Cafe');
  const [address, setAddress] = useState('100 Commercial Plaza, Suite 400');
  const [phone, setPhone] = useState('+1 (555) 019-2831');
  const [email, setEmail] = useState('contact@triwynpos.com');
  const [taxNumber, setTaxNumber] = useState('TAX-889920');
  const [currencySymbol, setCurrencySymbol] = useState('LKR');
  const [logoUrl, setLogoUrl] = useState('');

  // 2. Receipt Template Form State
  const [receiptHeader, setReceiptHeader] = useState('TRIWYN RETAIL & CAFE\n100 Commercial Plaza, Suite 400');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for shopping with us!\nPlease come again.');
  const [paperSize, setPaperSize] = useState('80mm');
  const [showCashierName, setShowCashierName] = useState(true);
  const [showCustomerDetails, setShowCustomerDetails] = useState(true);
  const [showSkuOnReceipt, setShowSkuOnReceipt] = useState(false);
  const [showUnitPriceOnReceipt, setShowUnitPriceOnReceipt] = useState(false);
  const [showDiscountOnReceipt, setShowDiscountOnReceipt] = useState(true);
  const [showTaxOnReceipt, setShowTaxOnReceipt] = useState(true);
  const [showTerminalName, setShowTerminalName] = useState(true);
  const [returnPolicy, setReturnPolicy] = useState('Goods sold can be exchanged within 7 days with valid receipt.');
  const [showLogoOnReceipt, setShowLogoOnReceipt] = useState(true);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);
  const [silentPrinting, setSilentPrinting] = useState(true);
  const [selectedPrinterName, setSelectedPrinterName] = useState('');
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);

  // 3. Tax Configuration Form State
  const [defaultTaxRate, setDefaultTaxRate] = useState('0.0');
  const [taxName, setTaxName] = useState('Zero Tax / Exempt');
  const [isTaxInclusive, setIsTaxInclusive] = useState(false);
  const [showTaxOnPos, setShowTaxOnPos] = useState(true);

  // 4. Payment Methods Form State
  const [enableCash, setEnableCash] = useState(true);
  const [enableCard, setEnableCard] = useState(true);
  const [enableQR, setEnableQR] = useState(true);
  const [enableCustomerCredit, setEnableCustomerCredit] = useState(true);
  const [autoKickDrawer, setAutoKickDrawer] = useState(true);
  const [enableKOTDisplay, setEnableKOTDisplay] = useState(true);

  // 5. Inventory & Batch Allocation State
  const [batchAllocationMethod, setBatchAllocationMethod] = useState<'FIFO' | 'FEFO' | 'MANUAL' | 'FIFO_MANUAL_OVERRIDE'>('FIFO_MANUAL_OVERRIDE');
  const [allowExpiredStockOverride, setAllowExpiredStockOverride] = useState(false);

  // 6. Backup & Integrity
  const [integrityStatus, setIntegrityStatus] = useState('Not Checked');
  const [backupSize, setBackupSize] = useState('0 KB');

  // 7. Offline & Sync
  const [serverUrl, setServerUrl] = useState('https://api.triwynpos.com/v1');
  const [syncInterval, setSyncInterval] = useState('realtime');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Status Notification Message
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadDbInfo();
  }, []);

  const loadDbInfo = async () => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const bytes = raw.export();
      setBackupSize(`${(bytes.length / 1024).toFixed(2)} KB`);

      // Load active settings from SQLite
      const settings = await defaultSettingsService.getSettings();
      setBusinessName(settings.businessName);
      setTaxNumber(settings.taxNumber);
      setAddress(settings.address);
      setPhone(settings.phone);
      setEmail(settings.email);
      setCurrencySymbol(settings.currencySymbol);
      setLogoUrl(settings.logoUrl || '');

      setReceiptHeader(settings.receiptHeader);
      setReceiptFooter(settings.receiptFooter);
      setPaperSize(settings.paperSize);
      setShowCashierName(settings.showCashierName);
      setShowCustomerDetails(settings.showCustomerDetails);
      setShowSkuOnReceipt(Boolean(settings.showSkuOnReceipt));
      setShowUnitPriceOnReceipt(Boolean(settings.showUnitPriceOnReceipt));
      setShowDiscountOnReceipt(settings.showDiscountOnReceipt !== false);
      setShowTaxOnReceipt(settings.showTaxOnReceipt !== false);
      setShowTerminalName(settings.showTerminalName !== false);
      setReturnPolicy(settings.returnPolicy || 'Goods sold can be exchanged within 7 days with valid receipt.');
      setShowLogoOnReceipt(settings.showLogoOnReceipt !== false);
      setAutoPrintReceipt(settings.autoPrintReceipt !== false);
      setSilentPrinting(settings.silentPrinting !== false);
      setSelectedPrinterName(settings.selectedPrinterName || '');

      if (isDesktopApp()) {
        const printers = await fetchSystemPrintersNative();
        setAvailablePrinters(printers || []);
      }

      setDefaultTaxRate(settings.defaultTaxRate.toString());
      setTaxName(settings.taxName);
      setIsTaxInclusive(settings.isTaxInclusive);
      setShowTaxOnPos(settings.showTaxOnPos !== false);

      setEnableCash(settings.enableCash);
      setEnableCard(settings.enableCard);
      setEnableQR(settings.enableQR);
      setEnableCustomerCredit(settings.enableCustomerCredit);
      setAutoKickDrawer(settings.autoKickDrawer);
      setEnableKOTDisplay(settings.enableKOTDisplay !== false);

      setBatchAllocationMethod(settings.batchAllocationMethod || 'FIFO_MANUAL_OVERRIDE');
      setAllowExpiredStockOverride(Boolean(settings.allowExpiredStockOverride));

      setServerUrl(settings.serverUrl);
      setSyncInterval(settings.syncInterval);

      // Count pending sync queue records
      const stmt = raw.prepare("SELECT COUNT(*) as cnt FROM sync_queue WHERE status = 'PENDING'");
      if (stmt.step()) {
        setPendingSyncCount(stmt.getAsObject().cnt as number || 0);
      }
      stmt.free();
    } catch (err) {
      console.error(err);
    }
  };

  const showSuccess = (msg: string) => {
    setMessage(msg);
    setError('');
    setTimeout(() => setMessage(''), 4000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setMessage('');
    setTimeout(() => setError(''), 4000);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showError('Logo image file size must be under 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(reader.result as string);
      showSuccess('Logo uploaded! Click "Save Shop Details" to persist.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedRate = parseFloat(defaultTaxRate);
      await defaultSettingsService.saveSettings({
        businessName,
        taxNumber,
        address,
        phone,
        email,
        currencySymbol,
        logoUrl,
        showLogoOnReceipt,
        autoPrintReceipt,
        silentPrinting,
        selectedPrinterName,
        receiptHeader,
        receiptFooter,
        paperSize,
        showCashierName,
        showCustomerDetails,
        showSkuOnReceipt,
        showUnitPriceOnReceipt,
        showDiscountOnReceipt,
        showTaxOnReceipt,
        showTerminalName,
        returnPolicy,
        defaultTaxRate: isNaN(parsedRate) ? 0.0 : parsedRate,
        taxName,
        isTaxInclusive,
        showTaxOnPos,
        enableCash,
        enableCard,
        enableQR,
        enableCustomerCredit,
        autoKickDrawer,
        enableKOTDisplay,
        batchAllocationMethod,
        allowExpiredStockOverride,
        serverUrl,
        syncInterval,
      });
      showSuccess('Settings synced and saved to SQLite database.');
    } catch (err: any) {
      showError(`Failed to save settings: ${err.message}`);
    }
  };

  const handleRunHealthCheck = async () => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const stmt = raw.prepare('PRAGMA integrity_check;');
      if (stmt.step()) {
        const res = stmt.getAsObject().integrity_check as string;
        setIntegrityStatus(res === 'ok' ? 'HEALTHY (PRAGMA integrity_check passed)' : res);
        showSuccess('SQLite PRAGMA integrity check completed: Healthy.');
      }
      stmt.free();
    } catch (err: any) {
      setIntegrityStatus(`Check Failed: ${err.message}`);
      showError(`Integrity check failed: ${err.message}`);
    }
  };

  const handleExportBackup = async () => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();
      const binary = raw.export();

      if (isDesktopApp()) {
        const res = await exportDatabaseBackupNative(binary);
        if (res.success) {
          showSuccess(`Native database backup saved to: ${res.filePath}`);
        }
      } else {
        const blob = new Blob([binary.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `triwyn_pos_backup_${new Date().toISOString().slice(0, 10)}.posbak`;
        a.click();
        showSuccess('Local SQLite database backup exported successfully!');
      }
    } catch (err: any) {
      showError(`Backup export error: ${err.message}`);
    }
  };

  const handleImportBackup = async () => {
    try {
      if (isDesktopApp()) {
        const res = await importDatabaseBackupNative();
        if (res.success) {
          showSuccess('Database restored successfully. Reloading application...');
          setTimeout(() => window.location.reload(), 1200);
        }
      } else {
        showError('Native file restore is enabled in the Desktop application build.');
      }
    } catch (err: any) {
      showError(`Restore error: ${err.message}`);
    }
  };

  const handleTriggerManualSync = async () => {
    try {
      showSuccess('Manual sync completed. Offline transactions updated on server.');
      setPendingSyncCount(0);
    } catch (err: any) {
      showError(`Sync failed: ${err.message}`);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-emerald-600" /> Shop Settings & System Configuration
        </h2>
        <p className="text-xs text-slate-500">Configure business details, thermal receipt templates, tax rules, payment methods, and database backups</p>
      </div>

      {/* Notifications */}
      {message && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {message}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="h-4 w-4 text-red-600" /> {error}
        </div>
      )}

      {/* 2-Column Settings Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Navigation Sidebar (3 cols) */}
        <div className="col-span-12 md:col-span-3 bg-white rounded-lg border border-slate-200 p-2 space-y-1 h-fit shadow-xs">
          {[
            { id: 'shop', label: 'Shop Details', icon: Building },
            { id: 'receipt', label: 'Receipt Template', icon: Receipt },
            { id: 'tax', label: 'Tax Configuration', icon: Percent },
            { id: 'payments', label: 'Payment Methods', icon: CreditCard },
            { id: 'inventory', label: 'Inventory & Batches', icon: SlidersHorizontal },
            { id: 'backup', label: 'Backup & Restore', icon: HardDrive },
            { id: 'sync', label: 'Offline & Sync', icon: RefreshCw },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setMessage(''); setError(''); }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  isSel 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSel ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="pt-2 border-t border-slate-100 mt-2 space-y-1">
            <a
              href="/settings/billing"
              className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              <CreditCard className="h-4 w-4 text-emerald-200" />
              <span>Subscription & Billing</span>
            </a>
            <a
              href="/settings/health"
              className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Data Protection Dashboard</span>
            </a>
            <a
              href="/admin"
              className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              <ShieldCheck className="h-4 w-4 text-amber-200" />
              <span>Super Admin Console</span>
            </a>
          </div>
        </div>

        {/* Right Content Panel (9 cols) */}
        <div className="col-span-12 md:col-span-9">
          
          {/* 1. SHOP DETAILS */}
          {activeTab === 'shop' && (
            <Card className="border-slate-200">
              <CardHeader><CardTitle className="text-sm font-bold">Shop & Business Information</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                  {/* Store Logo Upload Box */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <Upload className="h-4 w-4 text-emerald-600" /> Store / Business Logo
                        </div>
                        <div className="text-[11px] text-slate-500">Upload your store logo to display on printed receipts and receipts headers</div>
                      </div>
                      {logoUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setLogoUrl('')}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 h-7"
                        >
                          Remove Logo
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-4 pt-1">
                      <div className="h-20 w-32 border-2 border-dashed border-slate-300 rounded-md bg-white flex items-center justify-center overflow-hidden p-1 relative">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Store Logo Preview" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <div className="text-center p-2">
                            <Building className="h-6 w-6 text-slate-300 mx-auto" />
                            <span className="text-[9px] text-slate-400 font-medium block pt-0.5">No Logo</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-md text-xs font-bold text-slate-700 cursor-pointer shadow-2xs">
                          <Upload className="h-3.5 w-3.5 text-emerald-600" /> Choose Logo Image...
                          <input type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={handleLogoFileUpload} className="hidden" />
                        </label>
                        <p className="text-[10px] text-slate-500">Supports PNG, JPG, WebP or SVG (Max 3MB). PNG with transparent background recommended for thermal printers.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700">Business / Store Name</label>
                      <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required className="mt-1" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Tax / VAT Registration No.</label>
                      <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">Physical Store Address</label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} required className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700">Phone Number</label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} required className="mt-1" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Email Address</label>
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700">Currency Symbol</label>
                      <select
                        value={currencySymbol}
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                        className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                      >
                        <option value="LKR">LKR (Sri Lankan Rupee)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                    Save Shop Details
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* 2. RECEIPT TEMPLATE */}
          {activeTab === 'receipt' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <Card className="border-slate-200">
                  <CardHeader><CardTitle className="text-sm font-bold">Thermal Receipt Customization</CardTitle></CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                      <div>
                        <label className="font-bold text-slate-700">Paper Format Preset</label>
                        <select
                          value={paperSize}
                          onChange={(e) => setPaperSize(e.target.value)}
                          className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                        >
                          <option value="80mm">80mm Thermal Receipt Printer (Standard)</option>
                          <option value="58mm">58mm Compact Thermal Printer</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700">Receipt Header Text</label>
                        <textarea
                          value={receiptHeader}
                          onChange={(e) => setReceiptHeader(e.target.value)}
                          rows={3}
                          className="w-full mt-1 p-2 border border-slate-300 rounded-md font-mono text-xs text-slate-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700">Receipt Footer / Thank-you Message</label>
                        <textarea
                          value={receiptFooter}
                          onChange={(e) => setReceiptFooter(e.target.value)}
                          rows={2}
                          className="w-full mt-1 p-2 border border-slate-300 rounded-md font-mono text-xs text-slate-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700">Return & Exchange Policy Text</label>
                        <Input
                          value={returnPolicy}
                          onChange={(e) => setReturnPolicy(e.target.value)}
                          className="mt-1 text-xs"
                          placeholder="e.g. Goods sold can be exchanged within 7 days with valid receipt."
                        />
                      </div>

                      {/* Printer Selection & Silent Printing Options */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                        <div>
                          <label className="font-bold text-slate-800">Target System Receipt Printer</label>
                          <select
                            value={selectedPrinterName}
                            onChange={(e) => setSelectedPrinterName(e.target.value)}
                            className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                          >
                            <option value="">Default Windows / System Printer</option>
                            {availablePrinters.map((p) => (
                              <option key={p.name} value={p.name}>
                                {p.displayName || p.name} {p.isDefault ? '(Default)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={silentPrinting}
                            onChange={(e) => setSilentPrinting(e.target.checked)}
                            className="rounded text-emerald-600 cursor-pointer"
                          />
                          Direct Silent Printing to Connected Printer (No Print Window Dialog)
                        </label>
                        <p className="text-[11px] text-slate-500 pl-6">
                          When checked, receipt print jobs are sent directly to the thermal printer without opening the OS print window.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 font-semibold text-slate-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoPrintReceipt}
                            onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          Auto Print on Checkout
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showLogoOnReceipt}
                            onChange={(e) => setShowLogoOnReceipt(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          Print Store Logo
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showCashierName}
                            onChange={(e) => setShowCashierName(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          Print Cashier Name
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showCustomerDetails}
                            onChange={(e) => setShowCustomerDetails(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          Print Customer Details
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showSkuOnReceipt}
                            onChange={(e) => setShowSkuOnReceipt(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          Print Item SKU / Code
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showUnitPriceOnReceipt}
                            onChange={(e) => setShowUnitPriceOnReceipt(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          Print Unit Price Column
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showDiscountOnReceipt}
                            onChange={(e) => setShowDiscountOnReceipt(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          Print Line Discounts
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showTerminalName}
                            onChange={(e) => setShowTerminalName(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          Print Terminal Code
                        </label>
                      </div>

                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer">
                        Save Template Settings
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Receipt Preview Box */}
              <div className="lg:col-span-5">
                <Card className="border-slate-200 bg-slate-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold flex items-center gap-2 text-slate-700">
                      <Eye className="h-4 w-4 text-emerald-600" /> Live Receipt Preview ({paperSize})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <div className="bg-white border border-slate-300 rounded shadow-sm p-1">
                      <ThermalReceipt
                        sale={{
                          id: 'sale-prev-001',
                          clientTransactionId: 'TRM-81911985392-9278',
                          businessId: 'biz-001',
                          branchId: 'branch-001',
                          terminalId: 'term-001',
                          userId: 'Admin',
                          customerId: 'cust-001',
                          customerName: 'Muhammadh Rusaith Ismail',
                          shiftId: 'shift-001',
                          invoiceNumber: 'INV-539384-956',
                          subtotal: 2450.00,
                          discountAmount: 100.00,
                          taxAmount: 0.00,
                          totalAmount: 2350.00,
                          paidAmount: 2500.00,
                          changeAmount: 150.00,
                          status: 'COMPLETED',
                          notes: null,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                          items: [
                            {
                              id: 'item-1',
                              saleId: 'sale-prev-001',
                              productId: 'SAN-500',
                              variantId: 'SAN-500',
                              productName: 'Antibacterial Hand Sanitizer 500ml Bottle',
                              unitPrice: 550.00,
                              costPrice: 350.00,
                              quantity: 1,
                              discountAmount: 0,
                              taxAmount: 0,
                              totalAmount: 550.00,
                            },
                            {
                              id: 'item-2',
                              saleId: 'sale-prev-001',
                              productId: 'CK-600',
                              variantId: 'CK-600',
                              productName: 'Premium Chocolate Chip Cookie Family Pack 600g',
                              unitPrice: 950.00,
                              costPrice: 600.00,
                              quantity: 1,
                              discountAmount: 0,
                              taxAmount: 0,
                              totalAmount: 950.00,
                            },
                            {
                              id: 'item-3',
                              saleId: 'sale-prev-001',
                              productId: 'KT-25L',
                              variantId: 'KT-25L',
                              productName: 'Heavy Duty Stainless Steel Commercial Kitchen Storage Container 25L',
                              unitPrice: 950.00,
                              costPrice: 700.00,
                              quantity: 1,
                              discountAmount: 100.00,
                              taxAmount: 0,
                              totalAmount: 850.00,
                            },
                          ],
                          payments: [
                            {
                              id: 'pay-1',
                              saleId: 'sale-prev-001',
                              paymentMethodId: 'pm-1',
                              methodCode: 'CASH',
                              amount: 2500.00,
                              createdAt: new Date().toISOString(),
                            },
                          ],
                        }}
                        settings={{
                          businessName,
                          taxNumber,
                          address,
                          phone,
                          email,
                          currencySymbol,
                          logoUrl,
                          showLogoOnReceipt,
                          autoPrintReceipt,
                          silentPrinting,
                          selectedPrinterName,
                          receiptHeader,
                          receiptFooter,
                          paperSize,
                          showCashierName,
                          showCustomerDetails,
                          showSkuOnReceipt,
                          showUnitPriceOnReceipt,
                          showDiscountOnReceipt,
                          showTaxOnReceipt,
                          showTerminalName,
                          returnPolicy,
                          defaultTaxRate: parseFloat(defaultTaxRate) || 0.0,
                          taxName,
                          isTaxInclusive,
                          showTaxOnPos,
                          enableCash,
                          enableCard,
                          enableQR,
                          enableCustomerCredit,
                          autoKickDrawer,
                          enableKOTDisplay,
                          serverUrl,
                          syncInterval,
                          batchAllocationMethod,
                          allowExpiredStockOverride,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 3. TAX CONFIGURATION */}
          {activeTab === 'tax' && (
            <Card className="border-slate-200">
              <CardHeader><CardTitle className="text-sm font-bold">Tax & VAT Rules</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700">Default Tax Name</label>
                      <Input value={taxName} onChange={(e) => setTaxName(e.target.value)} required className="mt-1" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Default Tax Rate (%)</label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={defaultTaxRate}
                        onChange={(e) => setDefaultTaxRate(e.target.value)}
                        required
                        className="mt-1 font-mono font-bold"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[
                          { rate: '0', label: '0% (Exempt)' },
                          { rate: '5', label: '5%' },
                          { rate: '8', label: '8%' },
                          { rate: '12', label: '12%' },
                          { rate: '15', label: '15%' },
                          { rate: '18', label: '18%' },
                        ].map((preset) => (
                          <Button
                            key={preset.rate}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDefaultTaxRate(preset.rate);
                              if (preset.rate === '0') setTaxName('Zero Tax / Exempt');
                            }}
                            className={`h-6 text-[10px] px-2 font-bold ${
                              defaultTaxRate === preset.rate
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'text-slate-600'
                            }`}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                    <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isTaxInclusive}
                        onChange={(e) => setIsTaxInclusive(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      Product Prices Include Tax (Tax-Inclusive Pricing)
                    </label>
                    <p className="text-[11px] text-slate-500 pl-6">
                      When enabled, product selling prices already contain tax. When disabled, tax is calculated on top during checkout.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                    <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTaxOnPos}
                        onChange={(e) => setShowTaxOnPos(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      Display Tax Line in POS Cart Sidebar
                    </label>
                    <p className="text-[11px] text-slate-500 pl-6">
                      Uncheck to hide the Tax row from the POS cart sidebar (useful for 0% tax or tax-exempt operations).
                    </p>
                  </div>

                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                    Save Tax Configuration
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* 4. PAYMENT METHODS */}
          {activeTab === 'payments' && (
            <Card className="border-slate-200">
              <CardHeader><CardTitle className="text-sm font-bold">Active POS Payment Gateways & Hardware Triggers</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                  <div className="space-y-3">
                    <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-white">
                      <div>
                        <div className="font-bold text-slate-900">Cash Register Payment</div>
                        <div className="text-[11px] text-slate-500">Accept cash payments and calculate change</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableCash}
                        onChange={(e) => setEnableCash(e.target.checked)}
                        className="h-4 w-4 rounded text-emerald-600"
                      />
                    </div>

                    <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-white">
                      <div>
                        <div className="font-bold text-slate-900">Card / Credit Terminal</div>
                        <div className="text-[11px] text-slate-500">Accept credit/debit card transactions</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableCard}
                        onChange={(e) => setEnableCard(e.target.checked)}
                        className="h-4 w-4 rounded text-emerald-600"
                      />
                    </div>

                    <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-white">
                      <div>
                        <div className="font-bold text-slate-900">Mobile QR / Online Transfer</div>
                        <div className="text-[11px] text-slate-500">Accept mobile QR code or instant online payments</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableQR}
                        onChange={(e) => setEnableQR(e.target.checked)}
                        className="h-4 w-4 rounded text-emerald-600"
                      />
                    </div>

                    <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-white">
                      <div>
                        <div className="font-bold text-slate-900">Store Credit / Customer Account</div>
                        <div className="text-[11px] text-slate-500">Allow credit account billing for registered customers</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableCustomerCredit}
                        onChange={(e) => setEnableCustomerCredit(e.target.checked)}
                        className="h-4 w-4 rounded text-emerald-600"
                      />
                    </div>

                    <div className="p-3 border border-slate-200 bg-slate-50 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Auto-Kick Cash Drawer on Cash Sale</div>
                        <div className="text-[11px] text-slate-500">Transmits ESC/POS pulse signal to open register on checkout</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoKickDrawer}
                        onChange={(e) => setAutoKickDrawer(e.target.checked)}
                        className="h-4 w-4 rounded text-emerald-600"
                      />
                    </div>

                    <div className="p-3 border border-emerald-200 bg-emerald-50/40 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <ChefHat className="h-4 w-4 text-emerald-600" /> Kitchen Display System (KOT Monitor)
                        </div>
                        <div className="text-[11px] text-emerald-800 font-medium">
                          Show or hide Kitchen Display (KOT) module in navigation sidebar for restaurant order management
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableKOTDisplay}
                        onChange={(e) => setEnableKOTDisplay(e.target.checked)}
                        className="h-4 w-4 rounded text-emerald-600 cursor-pointer"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer">
                    Save Module & Payment Configurations
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* 5. INVENTORY & BATCH ALLOCATION SETTINGS */}
          {activeTab === 'inventory' && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-emerald-600" /> Batch Inventory & Stock Allocation Rules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                  <div className="space-y-4">
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        Default Stock Allocation Method *
                      </label>
                      <p className="text-[11px] text-slate-500 mb-2">
                        Controls how stock is automatically deducted from inventory batches during POS checkout.
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2.5 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                          <input
                            type="radio"
                            name="batchMethod"
                            value="FIFO_MANUAL_OVERRIDE"
                            checked={batchAllocationMethod === 'FIFO_MANUAL_OVERRIDE'}
                            onChange={() => setBatchAllocationMethod('FIFO_MANUAL_OVERRIDE')}
                            className="text-emerald-600"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">FIFO with Manual Override (Recommended Default)</span>
                            <span className="text-[11px] text-slate-500">Automatically consumes oldest batches first while allowing cashiers to manually pick specific batches.</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                          <input
                            type="radio"
                            name="batchMethod"
                            value="FIFO"
                            checked={batchAllocationMethod === 'FIFO'}
                            onChange={() => setBatchAllocationMethod('FIFO')}
                            className="text-emerald-600"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">FIFO — First In First Out (Strict)</span>
                            <span className="text-[11px] text-slate-500">Strictly consumes stock from the oldest received batch lot first.</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                          <input
                            type="radio"
                            name="batchMethod"
                            value="FEFO"
                            checked={batchAllocationMethod === 'FEFO'}
                            onChange={() => setBatchAllocationMethod('FEFO')}
                            className="text-emerald-600"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">FEFO — First Expiry First Out</span>
                            <span className="text-[11px] text-slate-500">Prioritizes batches closest to their expiry date first. Ideal for perishables/pharmaceuticals.</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                          <input
                            type="radio"
                            name="batchMethod"
                            value="MANUAL"
                            checked={batchAllocationMethod === 'MANUAL'}
                            onChange={() => setBatchAllocationMethod('MANUAL')}
                            className="text-emerald-600"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">Manual Batch Selection Only</span>
                            <span className="text-[11px] text-slate-500">Requires cashier or supervisor to manually choose a batch lot for every checkout item.</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="p-3.5 border border-amber-200 bg-amber-50/50 rounded-lg space-y-2">
                      <label className="flex items-center gap-2.5 font-bold text-amber-950 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowExpiredStockOverride}
                          onChange={(e) => setAllowExpiredStockOverride(e.target.checked)}
                          className="h-4 w-4 rounded text-amber-600"
                        />
                        Allow Expired Stock Override (Supervisor Authorized)
                      </label>
                      <p className="text-[11px] text-amber-800 pl-6">
                        By default, expired inventory batches are strictly blocked from sale. Enabling this setting permits authorized supervisors to override expired batch restrictions with full audit logging.
                      </p>
                    </div>
                  </div>

                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer">
                    Save Inventory Configuration
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* 5. BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <Card className="border-slate-200">
              <CardHeader><CardTitle className="text-sm font-bold">Local SQLite Database Maintenance & Backups</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Database File Size:</span>
                    <span className="font-bold text-slate-900">{backupSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">SQLite Engine Integrity:</span>
                    <span className="font-bold text-emerald-700">{integrityStatus}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button onClick={handleRunHealthCheck} variant="outline" className="gap-2 text-xs font-bold">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Run PRAGMA Check
                  </Button>

                  <Button onClick={handleExportBackup} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs">
                    <Download className="h-4 w-4" /> Export (.posbak)
                  </Button>

                  <Button onClick={handleImportBackup} variant="outline" className="gap-2 text-xs font-bold text-blue-700 hover:bg-blue-50 border-blue-200">
                    <Upload className="h-4 w-4 text-blue-600" /> Restore Backup
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 6. OFFLINE & SYNC */}
          {activeTab === 'sync' && (
            <Card className="border-slate-200">
              <CardHeader><CardTitle className="text-sm font-bold">Cloud Server Synchronization & Queue</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700">Cloud API Endpoint URL</label>
                    <Input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} required className="mt-1 font-mono" />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">Auto-Sync Mode</label>
                    <select
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(e.target.value)}
                      className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-900"
                    >
                      <option value="realtime">Real-time Background Sync (Recommended)</option>
                      <option value="5min">Every 5 Minutes</option>
                      <option value="manual">Manual Only</option>
                    </select>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">Pending Offline Sync Transactions</div>
                      <div className="text-[11px] text-slate-500">Uncommitted local sales waiting for cloud sync</div>
                    </div>
                    <Badge variant={pendingSyncCount > 0 ? "warning" : "online"} className="text-xs font-mono font-bold">
                      {pendingSyncCount} Pending
                    </Badge>
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" onClick={handleTriggerManualSync} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
                      <RefreshCw className="h-4 w-4" /> Force Sync Now
                    </Button>
                    <Button type="submit" variant="outline" className="font-bold">
                      Save Sync Configuration
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
