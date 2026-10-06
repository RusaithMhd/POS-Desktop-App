const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // Storage & Disk Access
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getDbFilePath: () => ipcRenderer.invoke('get-db-file-path'),
  saveDbFile: (dataBuffer) => ipcRenderer.invoke('save-db-file', dataBuffer),
  readDbFile: () => ipcRenderer.invoke('read-db-file'),
  saveBackup: (options) => ipcRenderer.invoke('save-backup', options),
  restoreBackup: () => ipcRenderer.invoke('restore-backup'),

  // Hardware & Printing
  getSystemPrinters: () => ipcRenderer.invoke('get-system-printers'),
  printDocument: (options) => ipcRenderer.invoke('print-document', options),
  openCashDrawer: () => ipcRenderer.invoke('open-cash-drawer'),

  // Native Dialogs & Notifications
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showNotification: (payload) => ipcRenderer.invoke('show-notification', payload),

  // Window & Kiosk Controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  toggleFullscreen: () => ipcRenderer.send('window-toggle-fullscreen'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Event Listeners for Native Menu / Tray / Window State
  onMaximizeChanged: (callback) => {
    const handler = (event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window-maximize-changed', handler);
    return () => ipcRenderer.removeListener('window-maximize-changed', handler);
  },
  onQuickAction: (callback) => {
    const handler = (event, action) => callback(action);
    ipcRenderer.on('trigger-quick-action', handler);
    return () => ipcRenderer.removeListener('trigger-quick-action', handler);
  },

  // Master Super Admin 2FA
  sendAdminOtp: (payload) => ipcRenderer.invoke('send-admin-otp', payload),
  verifyAdminOtp: (payload) => ipcRenderer.invoke('verify-admin-otp', payload),
});
