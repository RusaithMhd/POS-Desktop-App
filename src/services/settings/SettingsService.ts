import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';

export interface ShopSettings {
  businessName: string;
  taxNumber: string;
  address: string;
  phone: string;
  email: string;
  currencySymbol: string;
  logoUrl: string;
  showLogoOnReceipt: boolean;
  autoPrintReceipt: boolean;
  silentPrinting: boolean;
  selectedPrinterName: string;
  receiptHeader: string;
  receiptFooter: string;
  paperSize: string;
  showCashierName: boolean;
  showCustomerDetails: boolean;
  showSkuOnReceipt?: boolean;
  showUnitPriceOnReceipt?: boolean;
  showDiscountOnReceipt?: boolean;
  showTaxOnReceipt?: boolean;
  showTerminalName?: boolean;
  returnPolicy?: string;
  defaultTaxRate: number;
  taxName: string;
  isTaxInclusive: boolean;
  showTaxOnPos: boolean;
  enableCash: boolean;
  enableCard: boolean;
  enableQR: boolean;
  enableCustomerCredit: boolean;
  autoKickDrawer: boolean;
  enableKOTDisplay: boolean;
  serverUrl: string;
  syncInterval: string;
  batchAllocationMethod: 'FIFO' | 'FEFO' | 'MANUAL' | 'FIFO_MANUAL_OVERRIDE';
  allowExpiredStockOverride: boolean;
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  businessName: 'TRIWYN Retail & Cafe',
  taxNumber: 'TAX-889920',
  address: '100 Commercial Plaza, Suite 400',
  phone: '+1 (555) 019-2831',
  email: 'contact@triwynpos.com',
  currencySymbol: 'LKR',
  logoUrl: '',
  showLogoOnReceipt: true,
  autoPrintReceipt: true,
  silentPrinting: true,
  selectedPrinterName: '',
  receiptHeader: 'TRIWYN RETAIL & CAFE\n100 Commercial Plaza, Suite 400',
  receiptFooter: 'Thank you for shopping with us!\nPlease come again.',
  paperSize: '80mm',
  showCashierName: true,
  showCustomerDetails: true,
  showSkuOnReceipt: false,
  showUnitPriceOnReceipt: false,
  showDiscountOnReceipt: true,
  showTaxOnReceipt: true,
  showTerminalName: true,
  returnPolicy: 'Goods sold can be exchanged within 7 days with valid receipt.',
  defaultTaxRate: 0.0,
  taxName: 'Zero Tax / Exempt',
  isTaxInclusive: false,
  showTaxOnPos: true,
  enableCash: true,
  enableCard: true,
  enableQR: true,
  enableCustomerCredit: true,
  autoKickDrawer: true,
  enableKOTDisplay: true,
  serverUrl: 'https://api.triwynpos.com/v1',
  syncInterval: 'realtime',
  batchAllocationMethod: 'FIFO_MANUAL_OVERRIDE',
  allowExpiredStockOverride: false,
};

class SettingsService {
  private cachedSettings: ShopSettings = { ...DEFAULT_SHOP_SETTINGS };

  async getSettings(): Promise<ShopSettings> {
    try {
      await getLocalDb();
      const db = getRawSqlDb();

      // Read from businesses table first
      const bizStmt = db.prepare('SELECT * FROM businesses LIMIT 1');
      if (bizStmt.step()) {
        const biz = bizStmt.getAsObject();
        if (biz.name) this.cachedSettings.businessName = biz.name as string;
        if (biz.tax_number) this.cachedSettings.taxNumber = biz.tax_number as string;
        if (biz.address) this.cachedSettings.address = biz.address as string;
        if (biz.phone) this.cachedSettings.phone = biz.phone as string;
        if (biz.email) this.cachedSettings.email = biz.email as string;
        if (biz.currency_symbol) this.cachedSettings.currencySymbol = biz.currency_symbol as string;
      }
      bizStmt.free();

      // Read settings table key-values
      const setStmt = db.prepare('SELECT key, value FROM settings');
      while (setStmt.step()) {
        const row = setStmt.getAsObject();
        const key = row.key as string;
        let val = row.value as string;
        try {
          val = JSON.parse(val);
        } catch {
          // Keep raw string if JSON parsing fails
        }

        if (key === 'logo_url') this.cachedSettings.logoUrl = String(val || '');
        else if (key === 'show_logo_on_receipt') this.cachedSettings.showLogoOnReceipt = Boolean(val);
        else if (key === 'auto_print_receipt') this.cachedSettings.autoPrintReceipt = Boolean(val);
        else if (key === 'silent_printing') this.cachedSettings.silentPrinting = Boolean(val);
        else if (key === 'selected_printer_name') this.cachedSettings.selectedPrinterName = String(val || '');
        else if (key === 'receipt_header') this.cachedSettings.receiptHeader = String(val);
        else if (key === 'receipt_footer') this.cachedSettings.receiptFooter = String(val);
        else if (key === 'paper_size') this.cachedSettings.paperSize = String(val);
        else if (key === 'show_cashier_name') this.cachedSettings.showCashierName = Boolean(val);
        else if (key === 'show_customer_details') this.cachedSettings.showCustomerDetails = Boolean(val);
        else if (key === 'show_sku_on_receipt') this.cachedSettings.showSkuOnReceipt = Boolean(val);
        else if (key === 'show_unit_price_on_receipt') this.cachedSettings.showUnitPriceOnReceipt = Boolean(val);
        else if (key === 'show_discount_on_receipt') this.cachedSettings.showDiscountOnReceipt = Boolean(val);
        else if (key === 'show_tax_on_receipt') this.cachedSettings.showTaxOnReceipt = Boolean(val);
        else if (key === 'show_terminal_name') this.cachedSettings.showTerminalName = Boolean(val);
        else if (key === 'return_policy') this.cachedSettings.returnPolicy = String(val);
        else if (key === 'default_tax_rate') {
          const parsed = parseFloat(String(val));
          this.cachedSettings.defaultTaxRate = isNaN(parsed) ? 0.0 : parsed;
        }
        else if (key === 'tax_name') this.cachedSettings.taxName = String(val);
        else if (key === 'is_tax_inclusive') this.cachedSettings.isTaxInclusive = Boolean(val);
        else if (key === 'show_tax_on_pos') this.cachedSettings.showTaxOnPos = Boolean(val);
        else if (key === 'enable_cash') this.cachedSettings.enableCash = Boolean(val);
        else if (key === 'enable_card') this.cachedSettings.enableCard = Boolean(val);
        else if (key === 'enable_qr') this.cachedSettings.enableQR = Boolean(val);
        else if (key === 'enable_customer_credit') this.cachedSettings.enableCustomerCredit = Boolean(val);
        else if (key === 'auto_kick_drawer') this.cachedSettings.autoKickDrawer = Boolean(val);
        else if (key === 'enable_kot_display') this.cachedSettings.enableKOTDisplay = Boolean(val);
        else if (key === 'server_url') this.cachedSettings.serverUrl = String(val);
        else if (key === 'sync_interval') this.cachedSettings.syncInterval = String(val);
        else if (key === 'batch_allocation_method') this.cachedSettings.batchAllocationMethod = val as any;
        else if (key === 'allow_expired_stock_override') this.cachedSettings.allowExpiredStockOverride = Boolean(val);
      }
      setStmt.free();
    } catch (e) {
      console.error('[SettingsService] Failed to load settings from SQLite:', e);
    }

    return this.cachedSettings;
  }

  async saveSettings(updated: Partial<ShopSettings>): Promise<ShopSettings> {
    try {
      await getLocalDb();
      const db = getRawSqlDb();
      const now = new Date().toISOString();

      // Merge into cache
      this.cachedSettings = { ...this.cachedSettings, ...updated };

      // Update businesses table
      db.run(
        `UPDATE businesses SET 
          name = ?, tax_number = ?, address = ?, phone = ?, email = ?, currency_symbol = ?, updated_at = ?
         WHERE id = 'biz-001'`,
        [
          this.cachedSettings.businessName,
          this.cachedSettings.taxNumber,
          this.cachedSettings.address,
          this.cachedSettings.phone,
          this.cachedSettings.email,
          this.cachedSettings.currencySymbol,
          now,
        ]
      );

      // Save key-values into settings table
      const settingsMap: Record<string, any> = {
        logo_url: this.cachedSettings.logoUrl,
        show_logo_on_receipt: this.cachedSettings.showLogoOnReceipt,
        auto_print_receipt: this.cachedSettings.autoPrintReceipt,
        silent_printing: this.cachedSettings.silentPrinting,
        selected_printer_name: this.cachedSettings.selectedPrinterName,
        receipt_header: this.cachedSettings.receiptHeader,
        receipt_footer: this.cachedSettings.receiptFooter,
        paper_size: this.cachedSettings.paperSize,
        show_cashier_name: this.cachedSettings.showCashierName,
        show_customer_details: this.cachedSettings.showCustomerDetails,
        show_sku_on_receipt: this.cachedSettings.showSkuOnReceipt,
        show_unit_price_on_receipt: this.cachedSettings.showUnitPriceOnReceipt,
        show_discount_on_receipt: this.cachedSettings.showDiscountOnReceipt,
        show_tax_on_receipt: this.cachedSettings.showTaxOnReceipt,
        show_terminal_name: this.cachedSettings.showTerminalName,
        return_policy: this.cachedSettings.returnPolicy,
        default_tax_rate: this.cachedSettings.defaultTaxRate,
        tax_name: this.cachedSettings.taxName,
        is_tax_inclusive: this.cachedSettings.isTaxInclusive,
        show_tax_on_pos: this.cachedSettings.showTaxOnPos,
        enable_cash: this.cachedSettings.enableCash,
        enable_card: this.cachedSettings.enableCard,
        enable_qr: this.cachedSettings.enableQR,
        enable_customer_credit: this.cachedSettings.enableCustomerCredit,
        auto_kick_drawer: this.cachedSettings.autoKickDrawer,
        enable_kot_display: this.cachedSettings.enableKOTDisplay,
        server_url: this.cachedSettings.serverUrl,
        sync_interval: this.cachedSettings.syncInterval,
        batch_allocation_method: this.cachedSettings.batchAllocationMethod,
        allow_expired_stock_override: this.cachedSettings.allowExpiredStockOverride,
      };

      for (const [key, val] of Object.entries(settingsMap)) {
        db.run(
          `INSERT INTO settings (id, business_id, branch_id, terminal_id, key, value, updated_at)
           VALUES (?, 'biz-001', 'branch-001', 'term-001', ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [`set-${key}`, key, JSON.stringify(val), now]
        );
      }

      saveLocalDbState();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      }
    } catch (e) {
      console.error('[SettingsService] Failed to save settings to SQLite:', e);
    }

    return this.cachedSettings;
  }
}

export const defaultSettingsService = new SettingsService();
