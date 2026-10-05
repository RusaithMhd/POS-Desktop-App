import { SQLiteSyncQueueRepository } from '../repositories/SQLiteRepositories';

export interface SyncResult {
  totalProcessed: number;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

export class SyncEngine {
  private queueRepo = new SQLiteSyncQueueRepository();
  private isSyncing = false;

  async processQueue(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { totalProcessed: 0, syncedCount: 0, failedCount: 0, errors: ['Sync already in progress.'] };
    }

    this.isSyncing = true;
    const pendingItems = await this.queueRepo.getPending();
    const result: SyncResult = {
      totalProcessed: pendingItems.length,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    for (const item of pendingItems) {
      try {
        // Send payload to Cloud API Endpoint (/api/sync)
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientTransactionId: item.clientTransactionId,
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
            payload: item.payload,
          }),
        });

        if (response.ok) {
          await this.queueRepo.markSynced(item.id);
          result.syncedCount++;
        } else {
          const errText = await response.text();
          await this.queueRepo.markFailed(item.id, `Server returned HTTP ${response.status}: ${errText}`);
          result.failedCount++;
          result.errors.push(`Transaction ${item.clientTransactionId}: ${errText}`);
        }
      } catch (err: any) {
        await this.queueRepo.markFailed(item.id, err.message || 'Network unreachable.');
        result.failedCount++;
        result.errors.push(`Transaction ${item.clientTransactionId}: ${err.message}`);
      }
    }

    this.isSyncing = false;
    return result;
  }
}
