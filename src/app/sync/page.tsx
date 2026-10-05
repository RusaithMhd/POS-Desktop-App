'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, HardDrive, Server, Clock } from 'lucide-react';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteSyncQueueRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { SyncEngine } from '@/infrastructure/sync/SyncEngine';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function SyncPage() {
  return (
    <PermissionGuard permission="settings.manage" moduleName="Offline Sync Engine">
      <SyncContent />
    </PermissionGuard>
  );
}

function SyncContent() {
  const [queue, setQueue] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queueRepo = new SQLiteSyncQueueRepository();
  const syncEngine = new SyncEngine();

  useEffect(() => {
    loadQueueData();
  }, []);

  const loadQueueData = async () => {
    try {
      await getLocalDb();
      const items = await queueRepo.getPending();
      setQueue(items);
    } catch (err) {
      console.error('Failed to load sync queue:', err);
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setLastSyncResult(null);
    try {
      const res = await syncEngine.processQueue();
      setLastSyncResult(res);
      await loadQueueData();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const totalPages = Math.ceil(queue.length / pageSize);
  const paginatedQueue = queue.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-emerald-600" /> Offline Synchronization Queue
          </h2>
          <p className="text-xs text-slate-500">Inspect pending offline sales queued for background cloud PostgreSQL sync</p>
        </div>
        <Button
          onClick={handleForceSync}
          disabled={isSyncing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Trigger Sync Now'}
        </Button>
      </div>

      {lastSyncResult && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono space-y-1">
          <div className="font-bold">Sync Execution Result:</div>
          <div>Total Processed: {lastSyncResult.totalProcessed}</div>
          <div>Synced: {lastSyncResult.syncedCount}</div>
          <div>Failed: {lastSyncResult.failedCount}</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <HardDrive className="h-8 w-8 text-emerald-600" />
          <div>
            <div className="text-xs text-slate-500 font-bold">Local SQLite Database</div>
            <div className="text-sm font-bold text-slate-900">Operational (ACID Mode)</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-amber-600" />
          <div>
            <div className="text-xs text-slate-500 font-bold">Pending Outbound Queue</div>
            <div className="text-lg font-black text-amber-600 font-mono">{queue.length} Transactions</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <Server className="h-8 w-8 text-blue-600" />
          <div>
            <div className="text-xs text-slate-500 font-bold">Cloud Server Parity</div>
            <div className="text-sm font-bold text-slate-900">PostgreSQL Idempotent</div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <CardHeader><CardTitle className="text-sm font-bold">Pending Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {paginatedQueue.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
                <span>All local transactions are completely synchronized with the server!</span>
              </div>
            ) : (
              paginatedQueue.map((item) => (
                <div key={item.id} className="p-3 bg-white flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="font-mono font-bold text-slate-900">{item.clientTransactionId}</span>
                    <Badge variant="outline" className="ml-2 uppercase text-[10px]">{item.operation} {item.entityType}</Badge>
                  </div>
                  <Badge variant={item.status === 'PENDING' ? 'warning' : 'destructive'}>
                    {item.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={queue.length}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
