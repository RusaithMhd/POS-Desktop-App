import { SaleEntity } from "@/domain/entities/Sale";
import { 
  isDesktopApp, 
  printReceiptNative, 
  fetchSystemPrintersNative, 
  openCashDrawerNative 
} from "@/lib/electronBridge";

export interface IPrinterService {
  printReceipt(sale: SaleEntity): Promise<boolean>;
  getPrinters(): Promise<string[]>;
}

export interface ICashDrawerService {
  openDrawer(): Promise<boolean>;
}

export interface IBarcodeScannerService {
  onScan(callback: (barcode: string) => void): () => void;
}

export class ThermalPrinterService implements IPrinterService {
  async printReceipt(sale: SaleEntity): Promise<boolean> {
    console.log(`[PrinterService] Transmitting thermal receipt print job for invoice #${sale.invoiceNumber}...`);
    return await printReceiptNative({ silent: true });
  }

  async getPrinters(): Promise<string[]> {
    if (isDesktopApp()) {
      const printers = await fetchSystemPrintersNative();
      if (printers && printers.length > 0) {
        return printers.map((p) => p.displayName || p.name);
      }
    }
    return ['Thermal ESC/POS Printer (USB 001)', 'Windows Default Printer', 'Microsoft Print to PDF'];
  }
}

export class CashDrawerService implements ICashDrawerService {
  async openDrawer(): Promise<boolean> {
    console.log('[CashDrawerService] Transmitting raw ESC/POS pulse signal (DK Port Pin 2 / Pin 5)...');
    if (isDesktopApp()) {
      return await openCashDrawerNative();
    }
    return true;
  }
}

export class BarcodeScannerService implements IBarcodeScannerService {
  private buffer = '';
  private lastKeyTime = 0;

  onScan(callback: (barcode: string) => void): () => void {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      
      // Hardware USB/HID Barcode scanners typically send keystrokes with < 50ms intervals
      if (now - this.lastKeyTime > 80) {
        this.buffer = '';
      }
      this.lastKeyTime = now;

      if (e.key === 'Enter') {
        if (this.buffer.length >= 3) {
          callback(this.buffer);
          this.buffer = '';
        }
      } else if (e.key.length === 1) {
        this.buffer += e.key;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }
}

export const defaultPrinterService = new ThermalPrinterService();
export const defaultCashDrawerService = new CashDrawerService();
export const defaultBarcodeScannerService = new BarcodeScannerService();
