'use client';

import React from 'react';
import { SaleEntity } from '@/domain/entities/Sale';
import { ShopSettings, DEFAULT_SHOP_SETTINGS } from '@/services/settings/SettingsService';
import { formatCurrency } from '@/lib/utils';

interface ThermalReceiptProps {
  sale: SaleEntity;
  settings?: ShopSettings;
  isReprint?: boolean;
  className?: string;
}

export function ThermalReceipt({
  sale,
  settings = DEFAULT_SHOP_SETTINGS,
  isReprint = false,
  className = '',
}: ThermalReceiptProps) {
  const currencySymbol = settings.currencySymbol || 'LKR';
  const paperSize = settings.paperSize || '80mm';
  const is58mm = paperSize === '58mm';

  // Toggle flags with fallbacks
  const showLogo = settings.showLogoOnReceipt !== false && Boolean(settings.logoUrl);
  const showCashier = settings.showCashierName !== false;
  const showCustomer = settings.showCustomerDetails !== false && Boolean(sale.customerName);
  const showTerminal = settings.showTerminalName !== false;
  const showSku = Boolean(settings.showSkuOnReceipt);
  const showUnitPrice = Boolean(settings.showUnitPriceOnReceipt);
  const showDiscount = settings.showDiscountOnReceipt !== false;
  const showTax = settings.showTaxOnReceipt !== false;

  // Format date time cleanly
  const formattedDate = new Date(sale.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = new Date(sale.createdAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div
      className={`bg-white text-slate-900 font-mono text-xs leading-tight select-text print:p-0 ${
        is58mm ? 'max-w-[220px]' : 'max-w-[320px]'
      } w-full mx-auto p-4 space-y-3 ${className}`}
    >
      {/* REPRINT BANNER */}
      {isReprint && (
        <div className="text-center font-sans font-black text-slate-900 border-2 border-slate-900 py-1 text-[11px] uppercase tracking-widest bg-slate-100">
          *** DUPLICATE / REPRINT ***
        </div>
      )}

      {/* 1. BUSINESS HEADER */}
      <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-400">
        {showLogo && (
          <div className="flex justify-center pb-1.5">
            <img
              src={settings.logoUrl}
              alt={settings.businessName}
              className="max-h-16 max-w-[180px] object-contain filter grayscale"
            />
          </div>
        )}

        <div className="text-sm font-black text-slate-900 tracking-wide uppercase whitespace-pre-line">
          {settings.receiptHeader || settings.businessName}
        </div>

        {settings.address && (
          <div className="text-[10px] text-slate-700 whitespace-pre-line leading-snug">
            {settings.address}
          </div>
        )}

        {settings.phone && (
          <div className="text-[10px] text-slate-700">
            TEL: {settings.phone}
          </div>
        )}

        {settings.taxNumber && (
          <div className="text-[10px] text-slate-700 font-semibold">
            VAT/Tax No: {settings.taxNumber}
          </div>
        )}
      </div>

      {/* 2. INVOICE INFORMATION */}
      <div className="space-y-1 text-[10.5px] pb-2 border-b border-dashed border-slate-400">
        <div className="flex justify-between font-bold text-slate-900 text-xs">
          <span>INV: {sale.invoiceNumber}</span>
          {sale.status === 'REFUNDED' && (
            <span className="text-red-700 uppercase">[REFUND]</span>
          )}
        </div>

        <div className="flex justify-between text-slate-700">
          <span>Date: {formattedDate}</span>
          <span>Time: {formattedTime}</span>
        </div>

        {(showTerminal || showCashier) && (
          <div className="flex justify-between text-slate-700">
            {showTerminal && <span>Terminal: {sale.terminalId || 'term-001'}</span>}
            {showCashier && <span>Cashier: {sale.userId || 'Admin'}</span>}
          </div>
        )}

        {/* CUSTOMER INFORMATION (NEVER TRUNCATED) */}
        {showCustomer && (
          <div className="pt-1 border-t border-dotted border-slate-300">
            <div className="text-slate-500 font-sans font-bold text-[9.5px]">CUSTOMER:</div>
            <div className="font-bold text-slate-900 break-words whitespace-pre-wrap">
              {sale.customerName}
            </div>
          </div>
        )}
      </div>

      {/* 3. PRODUCT TABLE */}
      <div className="space-y-1.5 pt-1">
        {/* Table Header */}
        <div className="flex items-center justify-between font-bold text-slate-800 border-b-2 border-slate-900 pb-1 text-[10.5px]">
          <div className="flex-1 pr-1">ITEM</div>
          {showUnitPrice && <div className="w-14 text-right pr-1">PRICE</div>}
          <div className="w-8 text-center">QTY</div>
          <div className="w-16 text-right">TOTAL</div>
        </div>

        {/* Item Rows - Dynamic wrapping inside ITEM column, zero truncation */}
        {sale.items.map((item) => (
          <div key={item.id} className="py-1 border-b border-dotted border-slate-200">
            <div className="flex items-start justify-between text-slate-900">
              {/* Product Name wraps naturally on multiple lines */}
              <div className="flex-1 pr-1 break-words whitespace-pre-wrap font-medium leading-snug">
                {item.productName}
              </div>

              {/* Optional Unit Price */}
              {showUnitPrice && (
                <div className="w-14 shrink-0 text-right pr-1 text-slate-700 text-[10px]">
                  {formatCurrency(item.unitPrice, currencySymbol)}
                </div>
              )}

              {/* Quantity pinned to top right alignment */}
              <div className="w-8 shrink-0 text-center font-bold text-[10.5px]">
                {item.quantity}
              </div>

              {/* Line Total pinned to top right alignment */}
              <div className="w-16 shrink-0 text-right font-bold text-[10.5px]">
                {formatCurrency(item.totalAmount, currencySymbol)}
              </div>
            </div>

            {/* Optional SKU details */}
            {showSku && (item.variantId || item.productId) && (
              <div className="text-[9.5px] text-slate-500 pl-1 pt-0.5">
                SKU: {item.variantId || item.productId}
              </div>
            )}

            {/* Optional Item Discount */}
            {showDiscount && item.discountAmount > 0 && (
              <div className="text-[9.5px] text-emerald-800 pl-1 pt-0.5 italic">
                Discount: -{formatCurrency(item.discountAmount, currencySymbol)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 4. SUMMARY SECTION */}
      <div className="border-t border-dashed border-slate-400 pt-2 space-y-1 text-[11px] text-slate-800">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(sale.subtotal, currencySymbol)}</span>
        </div>

        {showDiscount && sale.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-800 font-semibold">
            <span>Discount:</span>
            <span>-{formatCurrency(sale.discountAmount, currencySymbol)}</span>
          </div>
        )}

        {showTax && (
          <div className="flex justify-between">
            <span>
              {settings.taxName || 'Tax'} ({settings.defaultTaxRate}%):
            </span>
            <span>{formatCurrency(sale.taxAmount, currencySymbol)}</span>
          </div>
        )}

        {settings.isTaxInclusive && (
          <div className="text-[9px] text-slate-500 italic text-center py-0.5">
            (Prices are inclusive of {settings.taxName || 'Tax'})
          </div>
        )}

        {/* PROMINENT GRAND TOTAL */}
        <div className="flex justify-between text-sm font-black text-slate-900 py-1.5 my-1 border-y-2 border-slate-900">
          <span>TOTAL</span>
          <span>
            {currencySymbol} {formatCurrency(sale.totalAmount, '')}
          </span>
        </div>
      </div>

      {/* 5. PAYMENT SECTION */}
      <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-[10.5px]">
        {sale.payments && sale.payments.length > 0 ? (
          sale.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-slate-800">
              <span>Received ({p.methodCode || 'CASH'}):</span>
              <span>{formatCurrency(p.amount, currencySymbol)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between text-slate-800">
            <span>Received (CASH):</span>
            <span>{formatCurrency(sale.paidAmount, currencySymbol)}</span>
          </div>
        )}

        <div className="flex justify-between font-bold text-slate-900 border-t border-dotted border-slate-300 pt-1">
          <span>Total Received:</span>
          <span>{formatCurrency(sale.paidAmount, currencySymbol)}</span>
        </div>

        <div className="flex justify-between font-bold text-slate-900">
          <span>Balance / Change:</span>
          <span>{formatCurrency(sale.changeAmount, currencySymbol)}</span>
        </div>
      </div>

      {/* 6. RECEIPT FOOTER */}
      <div className="text-center pt-2 space-y-2 text-[10px] text-slate-600 font-sans">
        {settings.receiptFooter && (
          <div className="whitespace-pre-line font-medium text-slate-800">
            {settings.receiptFooter}
          </div>
        )}

        {settings.returnPolicy && (
          <div className="text-[9px] text-slate-500 border-t border-dotted border-slate-200 pt-1">
            {settings.returnPolicy}
          </div>
        )}

        {/* BARCODE REPRESENTATION & TX ID */}
        <div className="pt-1 font-mono space-y-0.5">
          <div className="text-[12px] tracking-[0.25em] font-bold text-slate-900 select-none">
            ||| | |||| | ||||| || | ||| ||
          </div>
          <div className="text-[9px] text-slate-500">
            TX ID: {sale.clientTransactionId || sale.id}
          </div>
        </div>
      </div>
    </div>
  );
}
