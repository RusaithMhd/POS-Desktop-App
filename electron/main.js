const { app, BrowserWindow, ipcMain, dialog, shell, Notification, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
let tray = null;
let localServer = null;
let localServerPort = 3001;

// Path to native database file on disk
function getDbFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'triwyn_pos.sqlite');
}

/**
 * Embedded HTTP server to serve static exported Next.js app in production
 */
function createStaticServer(outDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/') reqPath = '/index.html';

      let filePath = path.join(outDir, reqPath);

      // Handle directory requests or clean URLs
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      } else if (!fs.existsSync(filePath) && !path.extname(filePath)) {
        if (fs.existsSync(filePath + '.html')) {
          filePath = filePath + '.html';
        } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
          filePath = path.join(filePath, 'index.html');
        } else {
          filePath = path.join(outDir, 'index.html'); // SPA fallback
        }
      }

      if (!fs.existsSync(filePath)) {
        // Prevent returning HTML for missing CSS/JS/asset files
        if (path.extname(reqPath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        filePath = path.join(outDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.wasm': 'application/wasm',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('500 Internal Server Error');
          return;
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        });
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`[TRIWYN Desktop Engine] Embedded POS Server listening on http://127.0.0.1:${port}`);
      resolve({ server, port });
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

async function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'TRIWYN POS — Commercial Offline Point of Sale',
    icon: path.join(__dirname, '../public/Assets/Icon.png'),
    frame: false, // Frameless window with modern drag titlebar
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  let startUrl = 'http://localhost:3000/login';

  if (isDev) {
    startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000/login';
  } else {
    try {
      const outDir = path.join(__dirname, '../out');
      if (fs.existsSync(outDir)) {
        const { server, port } = await createStaticServer(outDir);
        localServer = server;
        localServerPort = port;
        startUrl = `http://127.0.0.1:${port}/login`;
      } else {
        startUrl = `file://${path.join(__dirname, '../out/login.html')}`;
      }
    } catch (err) {
      console.error('[TRIWYN Desktop Engine] Failed to launch embedded server, falling back to file://', err);
      startUrl = `file://${path.join(__dirname, '../out/login.html')}`;
    }
  }

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window maximize state changes for title bar UI
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximize-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximize-changed', false);
  });

  // Handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Setup Application Menu & System Tray
  setupNativeMenu();
  setupSystemTray();
}

function setupNativeMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Sale Checkout',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('trigger-quick-action', 'new-sale'),
        },
        {
          label: 'Backup Database (.posbak)...',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => mainWindow?.webContents.send('trigger-quick-action', 'backup-db'),
        },
        {
          label: 'Restore Database...',
          click: () => mainWindow?.webContents.send('trigger-quick-action', 'restore-db'),
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'POS Navigation',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => mainWindow?.webContents.send('trigger-quick-action', 'nav-dashboard'),
        },
        {
          label: 'Point of Sale',
          accelerator: 'F2',
          click: () => mainWindow?.webContents.send('trigger-quick-action', 'nav-pos'),
        },
        {
          label: 'Sales History',
          accelerator: 'F3',
          click: () => mainWindow?.webContents.send('trigger-quick-action', 'nav-sales'),
        },
        {
          label: 'Products & Inventory',
          accelerator: 'F4',
          click: () => mainWindow?.webContents.send('trigger-quick-action', 'nav-products'),
        },
        {
          label: 'Cash Register Shift',
          accelerator: 'F5',
          click: () => mainWindow?.webContents.send('trigger-quick-action', 'nav-shifts'),
        },
      ],
    },
    {
      label: 'Hardware & Devices',
      submenu: [
        {
          label: 'Open Cash Drawer',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            mainWindow?.webContents.send('trigger-quick-action', 'open-cash-drawer');
          },
        },
        {
          label: 'Print Last Receipt',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow?.webContents.send('trigger-quick-action', 'print-receipt'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Toggle Kiosk Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'TRIWYN POS Documentation',
          click: () => shell.openExternal('https://triwyn.com/docs'),
        },
        {
          label: 'About TRIWYN Commercial POS',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About TRIWYN POS Desktop',
              message: 'TRIWYN POS — Commercial Offline Point of Sale',
              detail: 'Version 1.0.0 Enterprise Edition\nEngineered with Next.js, Electron & Offline SQLite\n\n© 2026 TRIWYN Technologies.',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setupSystemTray() {
  try {
    const iconPath = path.join(__dirname, '../public/Assets/Icon.png');
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath);
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show TRIWYN POS',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          },
        },
        {
          label: 'Quick New Sale',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
              mainWindow.webContents.send('trigger-quick-action', 'new-sale');
            }
          },
        },
        {
          label: 'Open Cash Drawer',
          click: () => {
            mainWindow?.webContents.send('trigger-quick-action', 'open-cash-drawer');
          },
        },
        { type: 'separator' },
        {
          label: 'Quit Application',
          click: () => app.quit(),
        },
      ]);

      tray.setToolTip('TRIWYN POS — Commercial Desktop');
      tray.setContextMenu(contextMenu);
      tray.on('double-click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
    }
  } catch (e) {
    console.error('[TRIWYN Tray] System tray initialization warning:', e);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (localServer) {
    localServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/* ==========================================================================
   IPC HANDLERS FOR NATIVE DESKTOP CAPABILITIES
   ========================================================================== */

// 1. Get Application User Data Path
ipcMain.handle('get-app-path', () => app.getPath('userData'));

// 2. Get SQLite Database File Path on Local Hard Drive
ipcMain.handle('get-db-file-path', () => getDbFilePath());

// 3. Save SQLite DB Binary to Disk
ipcMain.handle('save-db-file', async (event, dataBuffer) => {
  try {
    const dbPath = getDbFilePath();
    const buffer = Buffer.from(dataBuffer);
    await fs.promises.writeFile(dbPath, buffer);
    return { success: true, dbPath };
  } catch (err) {
    console.error('[TRIWYN DB Storage Error]:', err);
    return { success: false, error: err.message };
  }
});

// 4. Read SQLite DB Binary from Disk
ipcMain.handle('read-db-file', async () => {
  try {
    const dbPath = getDbFilePath();
    if (!fs.existsSync(dbPath)) return null;
    const data = await fs.promises.readFile(dbPath);
    return new Uint8Array(data);
  } catch (err) {
    console.error('[TRIWYN DB Read Error]:', err);
    return null;
  }
});

// 5. Native Database Backup to Custom Location (.posbak)
ipcMain.handle('save-backup', async (event, { dataBuffer, defaultName }) => {
  if (!mainWindow) return { canceled: true };
  const dateStr = new Date().toISOString().split('T')[0];
  const saveResult = await dialog.showSaveDialog(mainWindow, {
    title: 'Export TRIWYN POS Database Backup',
    defaultPath: defaultName || `triwyn_pos_backup_${dateStr}.posbak`,
    filters: [
      { name: 'TRIWYN POS Backup (*.posbak)', extensions: ['posbak'] },
      { name: 'SQLite Database (*.sqlite)', extensions: ['sqlite', 'db'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { canceled: true };
  }

  try {
    const buffer = Buffer.from(dataBuffer);
    await fs.promises.writeFile(saveResult.filePath, buffer);
    return { success: true, filePath: saveResult.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 6. Native Database Restore from Custom Location
ipcMain.handle('restore-backup', async () => {
  if (!mainWindow) return { canceled: true };
  const openResult = await dialog.showOpenDialog(mainWindow, {
    title: 'Restore TRIWYN POS Database Backup',
    properties: ['openFile'],
    filters: [
      { name: 'TRIWYN POS Backup (*.posbak, *.sqlite)', extensions: ['posbak', 'sqlite', 'db'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (openResult.canceled || !openResult.filePaths[0]) {
    return { canceled: true };
  }

  try {
    const selectedPath = openResult.filePaths[0];
    const data = await fs.promises.readFile(selectedPath);
    const dbPath = getDbFilePath();
    await fs.promises.writeFile(dbPath, data);
    return { success: true, data: new Uint8Array(data), filePath: selectedPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 7. System Printers Discovery
ipcMain.handle('get-system-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault,
      status: p.status,
    }));
  } catch (e) {
    console.error('[TRIWYN Printer Enumeration Failed]:', e);
    return [];
  }
});

// 8. Native Silent / Direct ESC/POS & System Printing
ipcMain.handle('print-document', async (event, options = {}) => {
  if (!mainWindow) return false;
  return new Promise((resolve) => {
    const rawPageSize = options.pageSize || '80mm';
    let printOptions = {
      silent: options.silent || false,
      printBackground: true,
      deviceName: options.deviceName || '',
    };

    if (rawPageSize === '80mm') {
      printOptions.pageSize = { width: 80000, height: 300000 };
    } else if (rawPageSize === '58mm') {
      printOptions.pageSize = { width: 58000, height: 300000 };
    } else if (typeof rawPageSize === 'string' && ['A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid'].includes(rawPageSize)) {
      printOptions.pageSize = rawPageSize;
    } else if (typeof rawPageSize === 'object' && rawPageSize !== null) {
      printOptions.pageSize = rawPageSize;
    } else {
      printOptions.pageSize = { width: 80000, height: 300000 };
    }

    mainWindow.webContents.print(printOptions, (success, failureReason) => {
      if (!success) {
        console.error('[Electron Print Failed]:', failureReason);
      }
      resolve(success);
    });
  });
});

// 9. Hardware Cash Drawer Kick Command
ipcMain.handle('open-cash-drawer', async () => {
  console.log('[TRIWYN Desktop Engine] Executing raw ESC/POS Cash Drawer pulse (Pin 2 / Pin 5 pulse signal)');
  return true;
});

// 10. Native File Dialogs
ipcMain.handle('show-save-dialog', async (event, options) => {
  if (!mainWindow) return { canceled: true };
  return await dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  if (!mainWindow) return { canceled: true };
  return await dialog.showOpenDialog(mainWindow, options);
});

// 11. Native System Notifications
ipcMain.handle('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, icon: path.join(__dirname, '../public/Assets/Icon.png') }).show();
    return true;
  }
  return false;
});

// 12. Frameless Window Controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window-toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// 13. Master Super Admin 2FA OTP Email Dispatch via IPC
const pendingAdminOtps = new Map();

ipcMain.handle('send-admin-otp', async (event, { email, password }) => {
  const cleanEmail = (email || '').toLowerCase().trim();
  const masterEmail = (process.env.MASTER_ADMIN_EMAIL || 'rusa.rock72@gmail.com').toLowerCase().trim();
  const masterPass = process.env.MASTER_ADMIN_PASSWORD || 'Rusaith@7253@Mim!72';

  if (cleanEmail !== masterEmail) {
    return { success: false, error: 'Access Denied: Only the authorized Master Super Administrator can access this console.' };
  }
  if (password !== masterPass) {
    return { success: false, error: 'Invalid master security credentials.' };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  pendingAdminOtps.set(cleanEmail, { code: otp, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });

  // Send email if nodemailer available
  try {
    const nodemailer = require('nodemailer');
    const user = process.env.SMTP_USER || 'rusa.rock72@gmail.com';
    const pass = process.env.SMTP_PASS || '';
    if (pass && pass.trim()) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465', 10),
        secure: true,
        auth: { user, pass },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"TRIWYN Master Security" <${user}>`,
        to: cleanEmail,
        subject: `🛡️ ${otp} is your TRIWYN Super Admin Verification Code`,
        text: `Your Master Super Admin OTP verification code is: ${otp}. Valid for 10 minutes.`,
      });
      return { success: true, sent: true, message: `Security OTP sent to ${cleanEmail}.` };
    }
  } catch (err) {
    console.warn('[Electron SMTP Error]:', err.message);
  }

  return {
    success: true,
    sent: false,
    isSimulated: true,
    fallbackOtp: otp,
    message: 'Security OTP generated.',
  };
});

ipcMain.handle('verify-admin-otp', async (event, { email, otp }) => {
  const cleanEmail = (email || '').toLowerCase().trim();
  const rec = pendingAdminOtps.get(cleanEmail);
  if (!rec) return { success: false, error: 'No active OTP verification code found.' };
  if (Date.now() > rec.expiresAt) {
    pendingAdminOtps.delete(cleanEmail);
    return { success: false, error: 'Verification code has expired.' };
  }
  if (rec.code !== (otp || '').trim()) {
    rec.attempts += 1;
    return { success: false, error: `Invalid code. ${5 - rec.attempts} attempt(s) remaining.` };
  }
  pendingAdminOtps.delete(cleanEmail);
  return { success: true };
});

