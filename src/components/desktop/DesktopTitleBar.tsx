'use client';

import React, { useState, useEffect } from 'react';
import { 
  Minus, 
  Square, 
  Copy, 
  X, 
  Database, 
  Printer, 
  HardDrive, 
  Maximize2, 
  Lock,
  Download,
  Upload,
  CircleCheck,
  RefreshCw
} from 'lucide-react';
import { isDesktopApp, exportDatabaseBackupNative, importDatabaseBackupNative } from '@/lib/electronBridge';
import { getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';

export function DesktopTitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const desktopCheck = isDesktopApp();
    setIsDesktop(desktopCheck);

    if (desktopCheck && window.electronAPI) {
      window.electronAPI.isMaximized().then(setIsMaximized);
      
      const unbindMax = window.electronAPI.onMaximizeChanged((maxState) => {
        setIsMaximized(maxState);
      });

      const unbindActions = window.electronAPI.onQuickAction((action) => {
        if (action === 'backup-db') {
          handleBackupDb();
        } else if (action === 'restore-db') {
          handleRestoreDb();
        } else if (action === 'open-cash-drawer') {
          window.electronAPI?.openCashDrawer();
          showNotificationMessage('Cash Drawer Kick Transmitted');
        }
      });

      return () => {
        unbindMax();
        unbindActions();
      };
    }
  }, []);

  const showNotificationMessage = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximizeWindow();
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow();
  };

  const handleBackupDb = async () => {
    try {
      const rawDb = getRawSqlDb();
      const binary = rawDb.export();
      const res = await exportDatabaseBackupNative(binary);
      if (res.success) {
        showNotificationMessage('Database Backup Saved Successfully');
      }
    } catch (e: any) {
      console.error('Database backup failed', e);
    }
  };

  const handleRestoreDb = async () => {
    try {
      const res = await importDatabaseBackupNative();
      if (res.success) {
        showNotificationMessage('Database Restored — Reloading App...');
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (e: any) {
      console.error('Database restore failed', e);
    }
  };

  // Only display desktop titlebar when running inside Electron window
  if (!isDesktop) return null;

  return (
    <div 
      className="h-9 bg-slate-900 text-slate-200 border-b border-slate-800 flex items-center justify-between px-3 select-none z-50 shrink-0 text-xs font-sans"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* LEFT BRAND & APP STATUS */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img src="/Assets/Icon.png" alt="TRIWYN Logo" className="h-5 w-5 object-contain" />
          <span className="font-extrabold tracking-wide text-white text-xs">
            TRIWYN POS <span className="font-medium text-[10px] text-emerald-400 ml-1">Desktop v1.0</span>
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-700 mx-0.5" />

        {/* Database Disk Sync Badge */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
          <HardDrive className="h-3 w-3 text-emerald-400" />
          <span>Local SQLite (Disk Synced)</span>
        </div>

        {/* Temporary Notification Alert */}
        {statusMsg && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-700/60 animate-pulse">
            <CircleCheck className="h-3 w-3 text-emerald-400" />
            <span>{statusMsg}</span>
          </div>
        )}
      </div>

      {/* RIGHT QUICK CONTROLS & WINDOW BUTTONS */}
      <div 
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Backup Database Quick Button */}
        <button
          onClick={handleBackupDb}
          title="Backup SQLite Database (.posbak)"
          className="p-1 px-2 hover:bg-slate-800 rounded text-slate-300 hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
        >
          <Download className="h-3.5 w-3.5 text-slate-400" />
          <span>Backup DB</span>
        </button>

        {/* Restore Database Quick Button */}
        <button
          onClick={handleRestoreDb}
          title="Restore Database from .posbak file"
          className="p-1 px-2 hover:bg-slate-800 rounded text-slate-300 hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
        >
          <Upload className="h-3.5 w-3.5 text-slate-400" />
          <span>Restore DB</span>
        </button>

        <div className="h-3.5 w-px bg-slate-800 mx-1" />

        {/* Window Control Buttons */}
        <button
          onClick={handleMinimize}
          title="Minimize Window"
          className="h-7 w-9 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          title={isMaximized ? 'Restore Window' : 'Maximize Window'}
          className="h-7 w-9 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          {isMaximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>

        <button
          onClick={handleClose}
          title="Close Application"
          className="h-7 w-9 flex items-center justify-center hover:bg-red-600 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
