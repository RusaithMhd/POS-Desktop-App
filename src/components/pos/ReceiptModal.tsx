'use client';

import React, { useState, useEffect } from 'react';
import { Printer, CheckCircle, X } from 'lucide-react';
import { SaleEntity } from '@/domain/entities/Sale';
import { Button } from '@/components/ui/button';
import { defaultSettingsService, ShopSettings, DEFAULT_SHOP_SETTINGS } from '@/services/settings/SettingsService';
import { isDesktopApp, printReceiptNative } from '@/lib/electronBridge';
import { ThermalReceipt } from '@/components/pos/ThermalReceipt';

interface ReceiptModalProps {
  sale: SaleEntity | null;
  onClose: () => void;
  autoPrint?: boolean;
}

export function ReceiptModal({ sale, onClose, autoPrint = true }: ReceiptModalProps) {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [lastPrintedSaleId, setLastPrintedSaleId] = useState<string | null>(null);

  const executePrintJob = (targetSettings: ShopSettings) => {
    if (isDesktopApp()) {
      printReceiptNative({
        silent: targetSettings.silentPrinting !== false,
        deviceName: targetSettings.selectedPrinterName || '',
        pageSize: targetSettings.paperSize || '80mm',
      });
    } else {
      window.print();
    }
  };

  useEffect(() => {
    if (!sale) return;

    defaultSettingsService.getSettings().then((loadedSettings) => {
      setSettings(loadedSettings);

      const shouldPrint = autoPrint && loadedSettings.autoPrintReceipt !== false;
      if (shouldPrint && lastPrintedSaleId !== sale.id) {
        setLastPrintedSaleId(sale.id);
        const timer = setTimeout(() => {
          executePrintJob(loadedSettings);
        }, 50);
        return () => clearTimeout(timer);
      }
    });
  }, [sale, autoPrint, lastPrintedSaleId]);

  if (!sale) return null;

  const handlePrint = () => {
    executePrintJob(settings);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Receipt #{sale.invoiceNumber}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Thermal Printable Body (Single Source of Truth) */}
        <div className="p-4 overflow-y-auto bg-slate-100 flex justify-center printable-receipt">
          <div className="shadow-xs rounded-sm border border-slate-200 bg-white">
            <ThermalReceipt sale={sale} settings={settings} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex gap-2">
          <Button onClick={handlePrint} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 cursor-pointer">
            <Printer className="h-4 w-4" /> Print Receipt
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1 cursor-pointer">Close</Button>
        </div>
      </div>
    </div>
  );
}
