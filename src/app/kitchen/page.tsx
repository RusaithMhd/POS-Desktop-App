'use client';

import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, CheckCircle2, AlertCircle, RefreshCw, Layers, Check, Play } from 'lucide-react';
import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { RBACService } from '@/services/security/RBACService';
import { AuthService } from '@/features/auth/AuthService';

export default function KitchenPage() {
  return (
    <PermissionGuard permission={['kitchen.view', 'kitchen.update_status']} moduleName="Kitchen Display System (KOT)">
      <KitchenContent />
    </PermissionGuard>
  );
}

function KitchenContent() {
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadKitchenOrders();
    // Auto-refresh every 5 seconds for live kitchen updates
    const interval = setInterval(loadKitchenOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadKitchenOrders = async () => {
    try {
      await getLocalDb();
      const db = getRawSqlDb();

      // Load active sales orders that need kitchen fulfillment (SUBMITTED, PREPARING, READY)
      const stmt = db.prepare(
        `SELECT s.id as sale_id, s.invoice_number, s.status as sale_status, s.notes, s.created_at, u.full_name as cashier_name
         FROM sales s 
         LEFT JOIN users u ON s.user_id = u.id 
         WHERE s.status IN ('SUBMITTED', 'PREPARING', 'READY', 'COMPLETED') 
         ORDER BY s.created_at DESC LIMIT 30`
      );

      const orders: any[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        orders.push({
          ...row,
          items: [],
        });
      }
      stmt.free();

      // Attach items for each order
      for (const order of orders) {
        const itemStmt = db.prepare(
          `SELECT product_name, quantity, total_amount FROM sale_items WHERE sale_id = :sid`
        );
        itemStmt.bind({ ':sid': order.sale_id });
        const items: any[] = [];
        while (itemStmt.step()) {
          items.push(itemStmt.getAsObject());
        }
        itemStmt.free();
        order.items = items;
      }

      setKitchenOrders(orders);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load kitchen orders:', err);
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = (saleId: string, currentStatus: string, newStatus: string) => {
    try {
      const activeUser = AuthService.getActiveSession();
      // Server-Side RBAC check
      RBACService.validatePermission(activeUser, 'kitchen.update_status', 'KOT Order Status');

      const db = getRawSqlDb();
      db.run('UPDATE sales SET status = ?, updated_at = ? WHERE id = ?', [
        newStatus,
        new Date().toISOString(),
        saleId,
      ]);

      saveLocalDbState();

      RBACService.logAudit({
        userId: activeUser?.id,
        userName: activeUser?.fullName,
        roleName: activeUser?.roleName,
        action: 'KITCHEN_STATUS_UPDATE',
        entity: 'SALES_ORDER',
        entityId: saleId,
        oldValue: currentStatus,
        newValue: newStatus,
        reason: `Kitchen status transitioned from ${currentStatus} to ${newStatus}`,
      });

      loadKitchenOrders();
    } catch (err: any) {
      alert(err?.message || 'Failed to update kitchen order status.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-900 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-emerald-600" /> Kitchen Display System (KOT Monitor)
          </h2>
          <p className="text-xs text-slate-500">
            Live real-time order queue for kitchen preparation and dispatch (Updates automatically)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadKitchenOrders}
            variant="outline"
            size="sm"
            className="text-xs font-bold gap-1.5 bg-white border-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Queue
          </Button>
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-xs px-3 py-1">
            Live KOT Sync Active
          </Badge>
        </div>
      </div>

      {/* Orders Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px] text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : kitchenOrders.length === 0 ? (
        <Card className="border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="inline-flex p-4 rounded-full bg-slate-100 text-slate-400 mb-3">
            <ChefHat className="h-10 w-10" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">Kitchen Queue Clean</h3>
          <p className="text-xs text-slate-500 mt-1">No pending orders in kitchen preparation queue right now.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {kitchenOrders.map((order) => {
            const isNew = order.sale_status === 'SUBMITTED' || order.sale_status === 'COMPLETED';
            const isPreparing = order.sale_status === 'PREPARING';
            const isReady = order.sale_status === 'READY';

            return (
              <Card
                key={order.sale_id}
                className={`overflow-hidden border transition-all ${
                  isNew
                    ? 'border-amber-300 bg-amber-50/20 shadow-md'
                    : isPreparing
                    ? 'border-blue-300 bg-blue-50/20 shadow-md'
                    : 'border-emerald-300 bg-emerald-50/20 shadow-xs'
                }`}
              >
                {/* KOT Header */}
                <CardHeader className={`py-3 px-4 border-b flex flex-row items-center justify-between ${
                  isNew
                    ? 'bg-amber-100/70 border-amber-200 text-amber-900'
                    : isPreparing
                    ? 'bg-blue-100/70 border-blue-200 text-blue-900'
                    : 'bg-emerald-100/70 border-emerald-200 text-emerald-900'
                }`}>
                  <div>
                    <CardTitle className="text-sm font-black tracking-wide flex items-center gap-2">
                      #{order.invoice_number}
                    </CardTitle>
                    <div className="text-[10px] font-semibold opacity-80 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" /> {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <Badge className={`font-black uppercase text-[10px] px-2.5 py-0.5 ${
                    isNew
                      ? 'bg-amber-500 text-white'
                      : isPreparing
                      ? 'bg-blue-600 text-white animate-pulse'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {isNew ? 'NEW KOT' : isPreparing ? 'PREPARING' : 'READY'}
                  </Badge>
                </CardHeader>

                {/* KOT Items List */}
                <CardContent className="p-4 space-y-3">
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg bg-white p-2">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                        <div className="font-extrabold text-slate-900 flex items-center gap-2">
                          <span className="h-5 w-5 rounded bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                            {item.quantity}x
                          </span>
                          <span>{item.product_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="p-2 bg-amber-100/50 border border-amber-200 rounded text-[11px] text-amber-900 font-bold">
                      Note: {order.notes}
                    </div>
                  )}

                  {/* Status Change Controls */}
                  <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                    {isNew && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(order.sale_id, order.sale_status, 'PREPARING')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5" /> Start Preparing
                      </Button>
                    )}

                    {isPreparing && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(order.sale_id, order.sale_status, 'READY')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Order Ready
                      </Button>
                    )}

                    {isReady && (
                      <div className="w-full text-center text-xs font-bold text-emerald-700 py-1 bg-emerald-100 rounded">
                        ✓ Ready for Customer Pickup
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
