export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
  status: number;
}

export interface ElectronAPI {
  isElectron: boolean;
  
  // Storage & Disk Access
  getAppPath: () => Promise<string>;
  getDbFilePath: () => Promise<string>;
  saveDbFile: (dataBuffer: Uint8Array) => Promise<{ success: boolean; dbPath?: string; error?: string }>;
  readDbFile: () => Promise<Uint8Array | null>;
  saveBackup: (options: { dataBuffer: Uint8Array; defaultName?: string }) => Promise<{ canceled?: boolean; success?: boolean; filePath?: string; error?: string }>;
  restoreBackup: () => Promise<{ canceled?: boolean; success?: boolean; data?: Uint8Array; filePath?: string; error?: string }>;

  // Hardware & Printing
  getSystemPrinters: () => Promise<PrinterInfo[]>;
  printDocument: (options?: { silent?: boolean; deviceName?: string; pageSize?: string }) => Promise<boolean>;
  openCashDrawer: () => Promise<boolean>;

  // Native Dialogs & Notifications
  showSaveDialog: (options: any) => Promise<any>;
  showOpenDialog: (options: any) => Promise<any>;
  showNotification: (payload: { title: string; body: string }) => Promise<boolean>;

  // Window & Kiosk Controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  toggleFullscreen: () => void;
  isMaximized: () => Promise<boolean>;

  // Event Listeners
  onMaximizeChanged: (callback: (isMaximized: boolean) => void) => () => void;
  onQuickAction: (callback: (action: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
}

export async function getNativeAppPath(): Promise<string | null> {
  if (isDesktopApp() && window.electronAPI) {
    return await window.electronAPI.getAppPath();
  }
  return null;
}

export async function getNativeDbPath(): Promise<string | null> {
  if (isDesktopApp() && window.electronAPI) {
    return await window.electronAPI.getDbFilePath();
  }
  return null;
}

export async function saveDbToDiskNative(data: Uint8Array): Promise<boolean> {
  if (isDesktopApp() && window.electronAPI) {
    const res = await window.electronAPI.saveDbFile(data);
    return Boolean(res.success);
  }
  return false;
}

export async function readDbFromDiskNative(): Promise<Uint8Array | null> {
  if (isDesktopApp() && window.electronAPI) {
    return await window.electronAPI.readDbFile();
  }
  return null;
}

export async function exportDatabaseBackupNative(data: Uint8Array): Promise<{ success: boolean; filePath?: string }> {
  if (isDesktopApp() && window.electronAPI) {
    const res = await window.electronAPI.saveBackup({ dataBuffer: data });
    return { success: Boolean(res.success), filePath: res.filePath };
  }
  return { success: false };
}

export async function importDatabaseBackupNative(): Promise<{ success: boolean; data?: Uint8Array; filePath?: string }> {
  if (isDesktopApp() && window.electronAPI) {
    const res = await window.electronAPI.restoreBackup();
    return { success: Boolean(res.success), data: res.data, filePath: res.filePath };
  }
  return { success: false };
}

export async function printReceiptNative(options?: any): Promise<boolean> {
  if (isDesktopApp() && window.electronAPI) {
    return await window.electronAPI.printDocument(options);
  } else if (typeof window !== 'undefined') {
    window.print();
    return true;
  }
  return false;
}

export async function openCashDrawerNative(): Promise<boolean> {
  if (isDesktopApp() && window.electronAPI) {
    return await window.electronAPI.openCashDrawer();
  }
  return false;
}

export async function fetchSystemPrintersNative(): Promise<PrinterInfo[]> {
  if (isDesktopApp() && window.electronAPI) {
    return await window.electronAPI.getSystemPrinters();
  }
  return [];
}

export async function sendNativeNotification(title: string, body: string): Promise<boolean> {
  if (isDesktopApp() && window.electronAPI) {
    return await window.electronAPI.showNotification({ title, body });
  } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
    return true;
  }
  return false;
}
