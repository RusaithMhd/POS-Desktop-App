import { Database } from 'sql.js';
import initSqlJs from 'sql.js';

export interface BackupMetadata {
  id: string;
  filename: string;
  timestamp: string;
  sizeBytes: number;
  status: 'HEALTHY' | 'WARNING' | 'FAILED';
  recordCounts: {
    usersCount: number;
    productsCount: number;
    salesCount: number;
    inventoryBatchesCount: number;
    receiptsCount: number;
    auditLogsCount: number;
  };
}

export interface BackupHealthSummary {
  lastBackupTimestamp: string | null;
  backupAgeHours: number;
  status: 'HEALTHY' | 'WARNING' | 'FAILING';
  totalBackups: number;
  rpoTarget: string; // e.g. '1 Hour'
  rtoTarget: string; // e.g. '5 Minutes'
}

export class DatabaseBackupService {
  private static STORAGE_PREFIX = 'triwyn_pos_backup_v1_';
  private static INDEX_KEY = 'triwyn_pos_backup_index_v1';

  /**
   * Create an immediate production backup of the SQLite database
   */
  public static async createBackup(db: Database): Promise<BackupMetadata> {
    const binary = db.export();
    const now = new Date();
    const isoString = now.toISOString();
    const dateCode = isoString.replace(/[-:TZ.]/g, '').substring(0, 14);
    const backupId = `bkp-${dateCode}`;
    const filename = `triwyn_production_backup_${dateCode}.sqlite`;

    // Calculate record counts
    const recordCounts = this.getDatabaseRecordCounts(db);

    const metadata: BackupMetadata = {
      id: backupId,
      filename,
      timestamp: isoString,
      sizeBytes: binary.byteLength,
      status: 'HEALTHY',
      recordCounts,
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        let binaryStr = '';
        const len = binary.byteLength;
        for (let i = 0; i < len; i++) {
          binaryStr += String.fromCharCode(binary[i]);
        }
        const b64 = btoa(binaryStr);
        localStorage.setItem(this.STORAGE_PREFIX + backupId, b64);

        // Update Index
        const existingIndex = this.getBackupIndex();
        existingIndex.unshift(metadata);
        // Keep max 20 backups
        const trimmed = existingIndex.slice(0, 20);
        localStorage.setItem(this.INDEX_KEY, JSON.stringify(trimmed));
      } catch (err) {
        console.error('Failed to store backup in localStorage:', err);
        metadata.status = 'FAILED';
      }
    }

    return metadata;
  }

  /**
   * Get Backup Health Summary
   */
  public static getBackupHealthSummary(): BackupHealthSummary {
    const index = this.getBackupIndex();
    if (index.length === 0) {
      return {
        lastBackupTimestamp: null,
        backupAgeHours: 999,
        status: 'WARNING',
        totalBackups: 0,
        rpoTarget: '1 Hour',
        rtoTarget: '5 Minutes',
      };
    }

    const latest = index[0];
    const lastDate = new Date(latest.timestamp);
    const now = new Date();
    const ageHours = Number(((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60)).toFixed(1));

    let status: 'HEALTHY' | 'WARNING' | 'FAILING' = 'HEALTHY';
    if (ageHours > 24 || latest.status === 'FAILED') {
      status = 'FAILING';
    } else if (ageHours > 6) {
      status = 'WARNING';
    }

    return {
      lastBackupTimestamp: latest.timestamp,
      backupAgeHours: ageHours,
      status,
      totalBackups: index.length,
      rpoTarget: '1 Hour',
      rtoTarget: '5 Minutes',
    };
  }

  /**
   * Perform a dry-run test restore in an isolated in-memory SQL database
   */
  public static async verifyBackupIntegrity(backupId: string): Promise<{ success: boolean; testCounts?: any; message: string }> {
    if (typeof window === 'undefined') return { success: false, message: 'Browser environment required' };
    
    const b64 = localStorage.getItem(this.STORAGE_PREFIX + backupId);
    if (!b64) {
      return { success: false, message: 'Backup payload not found in storage' };
    }

    try {
      const binaryStr = atob(b64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const SQL = await initSqlJs({
        locateFile: (file) => `/${file}`,
      });

      // Dry-run load into isolated memory DB instance
      const testDb = new SQL.Database(bytes);
      const testCounts = this.getDatabaseRecordCounts(testDb);
      testDb.close();

      return {
        success: true,
        testCounts,
        message: `Backup dry-run restoration test passed cleanly! (${testCounts.salesCount} sales, ${testCounts.productsCount} products, ${testCounts.inventoryBatchesCount} batches verified).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Backup dry-run test failed: ${err.message || err}`,
      };
    }
  }

  public static getBackupIndex(): BackupMetadata[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = localStorage.getItem(this.INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static getDatabaseRecordCounts(db: Database) {
    const getCount = (sql: string) => {
      try {
        const stmt = db.prepare(sql);
        let c = 0;
        if (stmt.step()) c = (stmt.getAsObject().cnt as number) || 0;
        stmt.free();
        return c;
      } catch {
        return 0;
      }
    };

    return {
      usersCount: getCount('SELECT COUNT(*) as cnt FROM users'),
      productsCount: getCount('SELECT COUNT(*) as cnt FROM products'),
      salesCount: getCount('SELECT COUNT(*) as cnt FROM sales'),
      inventoryBatchesCount: getCount('SELECT COUNT(*) as cnt FROM inventory_batches'),
      receiptsCount: getCount('SELECT COUNT(*) as cnt FROM receipts'),
      auditLogsCount: getCount('SELECT COUNT(*) as cnt FROM audit_logs'),
    };
  }
}
