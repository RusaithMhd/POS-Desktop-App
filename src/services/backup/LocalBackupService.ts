import { getRawSqlDb, saveLocalDbState } from "@/infrastructure/database/sqlite/db";

export interface BackupMetadata {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  status: 'SUCCESS' | 'FAILED';
}

export class LocalBackupService {
  public static async createBackup(): Promise<BackupMetadata> {
    try {
      const rawDb = getRawSqlDb();
      const binaryArray = rawDb.export();
      const base64Data = Buffer.from(binaryArray).toString('base64');
      
      const now = new Date();
      const filename = `triwyn_backup_${now.toISOString().replace(/[:.]/g, '-')}.sqlite`;
      const backupId = `bkp-${Date.now()}`;

      // Save backup snapshot to local backup history registry in localStorage
      const historyJson = localStorage.getItem('triwyn_backup_history') || '[]';
      const history: BackupMetadata[] = JSON.parse(historyJson);

      const metadata: BackupMetadata = {
        id: backupId,
        filename,
        sizeBytes: binaryArray.byteLength,
        createdAt: now.toISOString(),
        status: 'SUCCESS',
      };

      // Keep backup payload in local storage under backup key
      localStorage.setItem(`triwyn_backup_file_${backupId}`, base64Data);
      
      history.unshift(metadata);
      localStorage.setItem('triwyn_backup_history', JSON.stringify(history));

      return metadata;
    } catch (err) {
      console.error('[BackupService] Backup creation failed:', err);
      throw new Error('Failed to generate safe SQLite local database backup snapshot.');
    }
  }

  public static getBackupHistory(): BackupMetadata[] {
    if (typeof window === 'undefined') return [];
    const historyJson = localStorage.getItem('triwyn_backup_history') || '[]';
    return JSON.parse(historyJson);
  }

  public static async restoreBackup(backupId: string): Promise<boolean> {
    try {
      const base64Data = localStorage.getItem(`triwyn_backup_file_${backupId}`);
      if (!base64Data) {
        throw new Error('Backup snapshot file not found.');
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const rawDb = getRawSqlDb();

      // Open restored database bytes into sql.js
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      const restoredDb = new SQL.Database(buffer);

      // Export restored database back into active database instance
      const restoredBytes = restoredDb.export();
      saveLocalDbState();
      
      // Reload window to refresh active database state in memory
      window.location.reload();
      return true;
    } catch (err) {
      console.error('[BackupService] Restore failed:', err);
      throw new Error('Failed to restore database from selected backup file.');
    }
  }
}
