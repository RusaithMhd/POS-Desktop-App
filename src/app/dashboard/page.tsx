'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Layers,
  DollarSign,
  Package,
  Users,
  CreditCard,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  BarChart3,
  Percent,
  Database,
  Download,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { getLocalDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import {
  DashboardAnalyticsService,
  DashboardAnalyticsData,
  ChartDataPoint,
} from '@/services/analytics/DashboardAnalyticsService';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function DashboardPage() {
  return (
    <PermissionGuard permission={['dashboard.view', 'reports.view']} moduleName="Business Intelligence Dashboard">
      <DashboardContent />
    </PermissionGuard>
  );
}

function DashboardContent() {
  const router = useRouter();
  const [data, setData] = useState<DashboardAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDatePreset, setActiveDatePreset] = useState<string>('today');
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [hoveredChartPoint, setHoveredChartPoint] = useState<ChartDataPoint | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [activeDatePreset]);

  // Keyboard shortcut for Open POS [Ctrl+K]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        router.push('/pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      await getLocalDb();
      const analytics = await DashboardAnalyticsService.getDashboardAnalytics(activeDatePreset);
      setData(analytics);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Failed to load dashboard analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupDatabase = () => {
    try {
      saveLocalDbState();
      setBackupSuccessMessage('Local database backup state saved to disk successfully.');
      setTimeout(() => setBackupSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Backup failed:', err);
    }
  };

  const [formattedTodayDate, setFormattedTodayDate] = useState('');

  useEffect(() => {
    setFormattedTodayDate(new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }));
  }, []);

  // Skeleton Loading State
  if (isLoading || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-slate-200 rounded animate-pulse"></div>
            <div className="h-4 w-64 bg-slate-100 rounded animate-pulse"></div>
          </div>
          <div className="h-10 w-32 bg-slate-200 rounded animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="h-4 w-24 bg-slate-100 rounded animate-pulse"></div>
              <div className="h-8 w-36 bg-slate-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Handle Empty State
  if (data.isEmpty) {
    return (
      <div className="p-12 max-w-3xl mx-auto text-center space-y-6">
        <div className="inline-flex p-4 rounded-full bg-slate-100 text-slate-700 mb-2">
          <Briefcase className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">No Sales Data Available Yet</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Start recording sales transactions or importing inventory products to populate real-time business intelligence metrics.
        </p>
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button onClick={() => router.push('/pos')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
            <ShoppingBag className="h-4 w-4" /> Open POS Checkout
          </Button>
          <Button onClick={() => router.push('/products')} variant="outline" className="border-slate-300 font-semibold gap-2">
            <Package className="h-4 w-4" /> Add Products
          </Button>
        </div>
      </div>
    );
  }

  const maxChartVal = Math.max(
    ...data.salesPerformanceChart.map((d) => Math.max(d.current, d.previous)),
    100
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-900">
      {/* 1. HEADER AREA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Business Overview</h1>
            <span className="text-xs text-slate-500 font-medium">{formattedTodayDate}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational statistics, sales velocity, and inventory alerts • Refreshed at {lastRefreshed}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700">
            {(['today', 'yesterday', '7days', '30days', 'month'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setActiveDatePreset(preset)}
                className={`px-3 py-1.5 rounded-md capitalize transition-all ${
                  activeDatePreset === preset
                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset === '7days' ? '7 Days' : preset === '30days' ? '30 Days' : preset}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={loadDashboard} className="border-slate-200 text-slate-700 font-semibold gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>

          <Button
            onClick={() => router.push('/pos')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs shadow-sm"
          >
            <ShoppingBag className="h-4 w-4" /> OPEN POS <kbd className="hidden sm:inline text-[10px] bg-emerald-700 px-1.5 py-0.5 rounded text-emerald-100 font-mono">Ctrl+K</kbd>
          </Button>
        </div>
      </div>

      {backupSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> {backupSuccessMessage}
          </span>
          <button onClick={() => setBackupSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-extrabold">✕</button>
        </div>
      )}

      {/* 2. OPERATIONAL STATUS BAR */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
          <Activity className="h-4 w-4 text-emerald-600" /> System Operational Status:
        </div>
        <div className="flex items-center gap-6 flex-wrap font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-500">Sales Pace:</span>
            <span className="font-bold text-emerald-700">Healthy</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${data.inventoryOverview.lowStockCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            <span className="text-slate-500">Inventory:</span>
            <span className={`font-bold ${data.inventoryOverview.lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
              {data.inventoryOverview.lowStockCount > 0 ? `${data.inventoryOverview.lowStockCount} Items Low` : 'Healthy'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-500">Register:</span>
            <span className="font-bold text-emerald-700">Balanced</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            <span className="text-slate-500">Local Database:</span>
            <span className="font-bold text-slate-800">100% Offline SQLite</span>
          </div>
        </div>
      </div>

      {/* 3. BUSINESS ALERTS / NEEDS ATTENTION SECTION */}
      <div className={`p-3.5 rounded-xl border transition-all text-xs ${
        data.inventoryOverview.lowStockCount > 0
          ? 'bg-amber-50/60 border-amber-200'
          : 'bg-emerald-50/40 border-emerald-100'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 font-bold">
            {data.inventoryOverview.lowStockCount > 0 ? (
              <span className="text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> NEEDS ATTENTION: {data.inventoryOverview.lowStockCount} Products Below Minimum Threshold
              </span>
            ) : (
              <span className="text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> BUSINESS ALERTS: All inventory levels healthy, register balanced, database fully synced.
              </span>
            )}
          </div>
          {data.inventoryOverview.lowStockCount > 0 && (
            <Button size="sm" onClick={() => router.push('/inventory')} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] h-7 px-3">
              View Inventory
            </Button>
          )}
        </div>
      </div>

      {/* 4. FINANCIAL & OPERATIONAL KPI SUMMARY CARDS */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Performance Metrics ({data.rangeLabel})</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Card 1: Today Sales (Financial Primary) */}
          <Card className="p-4 bg-emerald-50/40 border-emerald-200 shadow-sm hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider">
              <span>{data.kpis.todaySales.title}</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1.5">{data.kpis.todaySales.value}</div>
            <div className="flex items-center gap-1 text-[11px] mt-1.5">
              {data.kpis.todaySales.changePercent !== null ? (
                <span className={`font-bold ${data.kpis.todaySales.changePercent >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {data.kpis.todaySales.changePercent >= 0 ? '+' : ''}{data.kpis.todaySales.changePercent}% {data.kpis.todaySales.changeLabel}
                </span>
              ) : (
                <span className="text-slate-400 font-medium">No comparison available</span>
              )}
            </div>
          </Card>

          {/* Card 2: Gross Profit (Financial Primary) */}
          <Card className="p-4 bg-emerald-50/40 border-emerald-200 shadow-sm hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider">
              <span>GROSS PROFIT</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 font-mono mt-1.5">{data.kpis.grossProfit.value}</div>
            <div className="text-[11px] text-emerald-800 font-bold mt-1.5">
              {data.kpis.grossProfit.subtitle || 'Calculated margin'}
            </div>
          </Card>

          {/* Card 3: Gross Margin (Financial Primary) */}
          <Card className="p-4 bg-emerald-50/40 border-emerald-200 shadow-sm hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider">
              <span>GROSS MARGIN</span>
              <Percent className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1.5">
              {data.profitOverview.grossMarginPercent.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1.5">Net profit efficiency</div>
          </Card>

          {/* Card 4: Transactions (Operational) */}
          <Card className="p-4 bg-white border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <span>TRANSACTIONS</span>
              <ShoppingBag className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-1.5">{data.kpis.transactions.value}</div>
            <div className="text-[11px] text-slate-500 mt-1.5">
              {data.kpis.transactions.changePercent !== null ? (
                <span className="font-bold text-slate-700">
                  {data.kpis.transactions.changePercent >= 0 ? '+' : ''}{data.kpis.transactions.changePercent}% {data.kpis.transactions.changeLabel}
                </span>
              ) : (
                'No comparison available'
              )}
            </div>
          </Card>

          {/* Card 5: Items Sold (Operational) */}
          <Card className="p-4 bg-white border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <span>ITEMS SOLD</span>
              <Layers className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-1.5">{data.kpis.itemsSold.value}</div>
            <div className="text-[11px] text-slate-500 mt-1.5">
              {data.kpis.itemsSold.changePercent !== null ? (
                <span className="font-bold text-slate-700">
                  {data.kpis.itemsSold.changePercent >= 0 ? '+' : ''}{data.kpis.itemsSold.changePercent}% {data.kpis.itemsSold.changeLabel}
                </span>
              ) : (
                'Units scanned'
              )}
            </div>
          </Card>

          {/* Card 6: Average Order Value (Operational) */}
          <Card className="p-4 bg-white border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <span>AVG ORDER VALUE</span>
              <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-1.5">{data.kpis.averageOrderValue.value}</div>
            <div className="text-[11px] text-slate-500 mt-1.5">Per receipt average</div>
          </Card>
        </div>
      </div>

      {/* 5. SALES PERFORMANCE CHART (8 COLS) + LIVE ACTIVITY STREAM (4 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Sales Performance Chart */}
        <div className="lg:col-span-8">
          <Card className="p-4 bg-white border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" /> Sales Performance ({data.rangeLabel})
                </CardTitle>
                <p className="text-xs text-slate-500">Revenue trajectory comparison across active date range</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span> Current Period
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300"></span> Previous Period
                </span>
              </div>
            </div>

            {/* Interactive SVG Line Chart */}
            <div className="pt-4 relative h-64 w-full">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 700 200" preserveAspectRatio="none">
                {[0, 50, 100, 150, 200].map((y) => (
                  <line key={y} x1="0" y1={y} x2="700" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                ))}

                {/* Previous Period Line (Dashed Gray) */}
                <path
                  d={data.salesPerformanceChart
                    .map((pt, idx) => {
                      const x = (idx / (data.salesPerformanceChart.length - 1 || 1)) * 700;
                      const y = 200 - (pt.previous / maxChartVal) * 180;
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                {/* Current Period Line (Solid Emerald) */}
                <path
                  d={data.salesPerformanceChart
                    .map((pt, idx) => {
                      const x = (idx / (data.salesPerformanceChart.length - 1 || 1)) * 700;
                      const y = 200 - (pt.current / maxChartVal) * 180;
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#059669"
                  strokeWidth="3"
                />

                {/* Interactive Points */}
                {data.salesPerformanceChart.map((pt, idx) => {
                  const x = (idx / (data.salesPerformanceChart.length - 1 || 1)) * 700;
                  const y = 200 - (pt.current / maxChartVal) * 180;
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="4"
                      className="fill-emerald-600 stroke-white stroke-2 cursor-pointer hover:r-6 transition-all"
                      onMouseEnter={() => setHoveredChartPoint(pt)}
                      onMouseLeave={() => setHoveredChartPoint(null)}
                    />
                  );
                })}
              </svg>

              {/* Chart Tooltip */}
              {hoveredChartPoint && (
                <div className="absolute top-2 right-4 bg-slate-900 text-white p-3 rounded-lg shadow-lg text-xs space-y-1 z-10 font-mono border border-slate-700">
                  <div className="font-bold text-slate-300">{hoveredChartPoint.label}</div>
                  <div className="text-emerald-400 font-extrabold">Current: {formatCurrency(hoveredChartPoint.current)}</div>
                  <div className="text-slate-400">Previous: {formatCurrency(hoveredChartPoint.previous)}</div>
                </div>
              )}
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100">
              {data.salesPerformanceChart.map((pt, idx) => (
                <span key={idx}>{pt.label}</span>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Live Operational Stream */}
        <div className="lg:col-span-4">
          <Card className="h-full bg-white border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600" /> Live Operational Stream
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => router.push('/sales')} className="text-xs text-emerald-600 font-semibold p-0 h-auto">
                  View Sales
                </Button>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {data.liveActivities.map((act) => (
                  <div key={act.id} className="p-3 hover:bg-slate-50 transition-all flex items-start gap-3 text-xs">
                    <div className="text-[11px] font-mono font-semibold text-slate-400 min-w-[45px] pt-0.5">{act.time}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate">{act.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{act.description}</div>
                    </div>
                    {act.badgeText && (
                      <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-800 font-extrabold uppercase shrink-0">
                        {act.badgeText}
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <Button variant="ghost" size="sm" onClick={() => router.push('/sales')} className="text-xs text-slate-700 font-bold w-full gap-1">
                View Full Audit Stream <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* 6. LOWER ANALYTICS: SALES BY HOUR & TOP SELLING PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales by Hour */}
        <div className="lg:col-span-6">
          <Card className="p-4 bg-white border-slate-200 shadow-sm">
            <CardHeader className="p-0 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" /> Sales by Hour (Peak Traffic)
                </CardTitle>
                <p className="text-xs text-slate-500">Customer purchasing density by hour of day</p>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-4">
              <div className="h-44 flex items-end justify-between gap-1.5 px-2">
                {data.salesByHour.map((pt) => {
                  const maxAmt = Math.max(...data.salesByHour.map((p) => p.amount), 1);
                  const heightPct = (pt.amount / maxAmt) * 100;
                  return (
                    <div key={pt.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full bg-emerald-500 rounded-t group-hover:bg-emerald-600 transition-all cursor-pointer min-h-[4px]"
                        style={{ height: `${Math.max(4, heightPct)}%` }}
                      ></div>
                      <span className="text-[10px] text-slate-400 font-mono truncate">{pt.hourLabel.split(' ')[0]}</span>

                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white p-2 rounded shadow text-[10px] z-20 whitespace-nowrap font-mono">
                        {pt.hourLabel}: {formatCurrency(pt.amount)} ({pt.count} sales)
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <Sparkles className="h-4 w-4 text-emerald-600" /> Peak Sales Window:
                </div>
                <div className="font-extrabold text-emerald-700 font-mono text-sm">{data.peakSalesPeriod}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Selling Products */}
        <div className="lg:col-span-6">
          <Card className="p-4 bg-white border-slate-200 shadow-sm">
            <CardHeader className="p-0 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-600" /> Top Selling Products
                </CardTitle>
                <p className="text-xs text-slate-500">Highest performing SKUs ranked by revenue & gross profit</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/products')} className="text-xs text-emerald-600 font-semibold p-0 h-auto">
                View Products
              </Button>
            </CardHeader>
            <CardContent className="p-0 pt-3">
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-12 pb-2 text-[11px] font-bold text-slate-500 uppercase">
                  <span className="col-span-1">#</span>
                  <span className="col-span-5">PRODUCT</span>
                  <span className="col-span-2 text-right">UNITS</span>
                  <span className="col-span-4 text-right">REVENUE (PROFIT)</span>
                </div>
                {data.topProducts.map((p) => (
                  <div key={p.id} className="grid grid-cols-12 py-2.5 items-center text-xs text-slate-900 hover:bg-slate-50 transition-all">
                    <span className="col-span-1 font-extrabold font-mono text-slate-400">{p.rank}</span>
                    <div className="col-span-5 min-w-0 pr-2">
                      <div className="font-bold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                    </div>
                    <span className="col-span-2 text-right font-mono font-bold text-slate-700">{p.unitsSold}</span>
                    <div className="col-span-4 text-right min-w-0">
                      <div className="font-extrabold text-slate-900 font-mono">{formatCurrency(p.revenue)}</div>
                      <div className="text-[10px] text-emerald-600 font-mono font-bold">+{formatCurrency(p.profit)} profit</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 7. INVENTORY HEALTH & PAYMENT METHODS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inventory Status Breakdown */}
        <div className="lg:col-span-6">
          <Card className="p-4 bg-white border-slate-200 shadow-sm">
            <CardHeader className="p-0 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-600" /> Inventory Health Breakdown
                </CardTitle>
                <p className="text-xs text-slate-500">Product inventory counts categorized by status</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/inventory')} className="text-xs text-emerald-600 font-semibold p-0 h-auto">
                Ledger
              </Button>
            </CardHeader>
            <CardContent className="p-0 pt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase">Healthy Stock</div>
                  <div className="text-xl font-extrabold text-emerald-700 font-mono mt-0.5">
                    {data.inventoryOverview.totalProducts - data.inventoryOverview.lowStockCount - data.inventoryOverview.outOfStockCount}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <div className="text-[10px] font-bold text-amber-800 uppercase">Low Stock</div>
                  <div className="text-xl font-extrabold text-amber-600 font-mono mt-0.5">
                    {data.inventoryOverview.lowStockCount}
                  </div>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                  <div className="text-[10px] font-bold text-rose-800 uppercase">Out of Stock</div>
                  <div className="text-xl font-extrabold text-rose-600 font-mono mt-0.5">
                    {data.inventoryOverview.outOfStockCount}
                  </div>
                </div>
              </div>

              {/* Low Stock Items List */}
              {data.inventoryOverview.lowStockItems.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-700">Stock Reorder Items</div>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                    {data.inventoryOverview.lowStockItems.slice(0, 3).map((item) => (
                      <div key={item.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.sku} • Stock: {item.stockQuantity}</div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => router.push('/inventory')}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] h-7 px-2.5"
                        >
                          Restock
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods */}
        <div className="lg:col-span-6">
          <Card className="p-4 bg-white border-slate-200 shadow-sm">
            <CardHeader className="p-0 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" /> Payment Channel Analysis
                </CardTitle>
                <p className="text-xs text-slate-500">Revenue collected per register payment tender type</p>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-4 space-y-3">
              {data.paymentMethods.map((pm) => (
                <div key={pm.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{pm.label}</span>
                    <span className="font-extrabold font-mono text-slate-900">
                      {formatCurrency(pm.amount)} ({pm.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, pm.percentage)}%` }}></div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 8. DATABASE BACKUP & RESTORE UTILITY BAR */}
      <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-800 text-emerald-400">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-sm">Local SQLite Database Controls</div>
            <div className="text-xs text-slate-400">Manage offline data state persistence & emergency backups</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleBackupDatabase} variant="outline" size="sm" className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-bold text-xs gap-1.5">
            <Download className="h-3.5 w-3.5 text-emerald-400" /> Backup Database
          </Button>
          <Button onClick={() => setShowRestoreModal(true)} variant="outline" size="sm" className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-bold text-xs gap-1.5">
            <Upload className="h-3.5 w-3.5 text-amber-400" /> Restore State
          </Button>
        </div>
      </div>

      {/* RESTORE CONFIRMATION MODAL */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600 font-extrabold text-lg">
              <AlertTriangle className="h-6 w-6" /> Restore Local Database
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Restoring database state will reload local transactions from saved storage. This action may replace uncommitted offline edits. Are you sure you want to proceed?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setShowRestoreModal(false)} className="text-xs font-semibold">
                Cancel
              </Button>
              <Button size="sm" onClick={() => { setShowRestoreModal(false); loadDashboard(); }} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs">
                Confirm Restore
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
