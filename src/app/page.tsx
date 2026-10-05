'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, ShoppingBag, Layers, Receipt, BarChart3, Printer,
  Users, CheckCircle2, ArrowRight, Download, Laptop, Clock,
  PhoneCall, MessageCircle, HelpCircle, Sparkles, ChevronRight,
  Monitor, Cpu, Check, AlertCircle, Loader2, Star, Zap, Lock
} from 'lucide-react';
import { CustomerRegistrationService } from '@/services/registration/CustomerRegistrationService';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';

export default function HomePage() {
  const router = useRouter();

  // Registration Form State
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('Sri Lanka');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Interactive showcase tab state
  const [activeTab, setActiveTab] = useState<'billing' | 'inventory' | 'sales' | 'reports' | 'printer'>('billing');

  // Submit Free Trial Registration
  const handleRegisterTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!businessName.trim()) {
      setFormError('Please enter your business name.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Please enter your contact phone number.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Please provide a valid email address.');
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      setFormError('You must accept the Terms & Conditions and Privacy Policy.');
      return;
    }

    setIsSubmitting(true);
    try {
      await getLocalDb();
      const res = await CustomerRegistrationService.registerFreeTrial({
        fullName: fullName.trim(),
        businessName: businessName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        country: country || 'Sri Lanka',
      });

      // Redirect directly to the download page with trial details
      router.push(`/download-trial?trialId=${res.trialId}&business=${encodeURIComponent(res.businessName)}&expiry=${encodeURIComponent(res.expiryDate)}`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to initialize trial. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* ───────────────────────────────────────────────────────────────────────
          1. HEADER NAVIGATION
          ─────────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/Assets/Icon.png" alt="TRIWYN POS Logo" className="h-9 w-9 object-contain" />
            <div>
              <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                TRIWYN <span className="text-emerald-400">POS</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">
                Commercial Desktop Software
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-emerald-400 transition-colors cursor-pointer">
              Home
            </button>
            <button onClick={() => scrollToSection('features')} className="hover:text-emerald-400 transition-colors cursor-pointer">
              Features
            </button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-emerald-400 transition-colors cursor-pointer">
              How It Works
            </button>
            <button onClick={() => scrollToSection('showcase')} className="hover:text-emerald-400 transition-colors cursor-pointer">
              Showcase
            </button>
            <button onClick={() => scrollToSection('activation')} className="hover:text-emerald-400 transition-colors cursor-pointer">
              Activation
            </button>
            <button onClick={() => scrollToSection('support')} className="hover:text-emerald-400 transition-colors cursor-pointer">
              Support
            </button>
          </nav>

          {/* CTA Header Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollToSection('register-trial')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs tracking-wide shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>DOWNLOAD FREE TRIAL</span>
            </button>
          </div>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────────────────
          2. HERO SECTION
          ─────────────────────────────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-20 px-6 overflow-hidden bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Commercial Windows POS • v1.0 Enterprise</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
              POWER YOUR BUSINESS <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                WITH A SMARTER POS
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              A simple, reliable point-of-sale desktop application engineered to help you sell faster,
              manage inventory with batch tracking, print thermal receipts instantly, and control your business completely offline.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={() => scrollToSection('register-trial')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
              >
                <span>START 14-DAY FREE TRIAL</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>EXPLORE FEATURES</span>
              </button>
            </div>

            {/* Trust Badges */}
            <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>14-Day Free Trial</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Desktop Application</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>No Payment for Trial</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Easy 1-Click Setup</span>
              </div>
            </div>
          </div>

          {/* Right Hero Preview Mockup */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-2.5 shadow-2xl border border-slate-700/80">
              
              {/* Window Title Header */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-950 rounded-t-xl border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 ml-2">TRIWYN POS Terminal — Main Register</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  OFFLINE ACTIVE
                </span>
              </div>

              {/* POS Interface Simulation */}
              <div className="bg-slate-900 rounded-b-xl p-4 space-y-3.5 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Sale</span>
                    <span className="text-base font-black text-emerald-400">Rs. 4,850.00</span>
                  </div>
                  <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Items Scanned</span>
                    <span className="text-base font-black text-white">4 items</span>
                  </div>
                  <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Register Shift</span>
                    <span className="text-base font-black text-cyan-400">Shift #104</span>
                  </div>
                </div>

                {/* Simulated Cart Items */}
                <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 divide-y divide-slate-800/50">
                  <div className="flex justify-between items-center py-1">
                    <div>
                      <div className="font-bold text-white text-[11px]">Ceylon Tea 500g (Pouch)</div>
                      <div className="text-[10px] text-slate-500 font-mono">SKU: TEA-500 • Batch #B902</div>
                    </div>
                    <div className="font-bold text-slate-200">2 × Rs. 850.00</div>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <div>
                      <div className="font-bold text-white text-[11px]">Organic White Rice 5kg</div>
                      <div className="text-[10px] text-slate-500 font-mono">SKU: RICE-W5 • Exp: 2027</div>
                    </div>
                    <div className="font-bold text-slate-200">1 × Rs. 1,450.00</div>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <div>
                      <div className="font-bold text-white text-[11px]">Refined Sunflower Oil 1L</div>
                      <div className="text-[10px] text-slate-500 font-mono">SKU: OIL-SUN1</div>
                    </div>
                    <div className="font-bold text-slate-200">1 × Rs. 1,700.00</div>
                  </div>
                </div>

                {/* Quick Payment Action */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 py-2.5 bg-emerald-600 rounded-xl text-center font-black text-white text-xs shadow-md shadow-emerald-700/50 flex items-center justify-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5" />
                    <span>F2 — CASH CHECKOUT</span>
                  </div>
                  <div className="px-3 py-2.5 bg-slate-800 rounded-xl text-center font-bold text-slate-300 text-xs border border-slate-700">
                    CARD
                  </div>
                </div>
              </div>
            </div>

            {/* Glowing Backdrop */}
            <div className="absolute -inset-4 bg-emerald-500/10 rounded-3xl blur-2xl -z-10" />
          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          3. PRODUCT SHOWCASE (Real Interface Demonstration)
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="showcase" className="py-20 px-6 border-t border-slate-800/80 bg-slate-900/40">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Complete Commercial POS</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Experience The Actual POS Interface</h2>
            <p className="text-sm sm:text-base text-slate-400">
              Designed for retail shops, supermarkets, restaurants, and wholesale businesses. No complex cloud dependencies.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl mx-auto">
            {[
              { id: 'billing', label: 'Fast & Simple Billing', icon: ShoppingBag },
              { id: 'inventory', label: 'Inventory & Batches', icon: Layers },
              { id: 'sales', label: 'Sales Management', icon: Receipt },
              { id: 'reports', label: 'Reports & Dashboard', icon: BarChart3 },
              { id: 'printer', label: 'Thermal Printers & Hardware', icon: Printer },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Display */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {activeTab === 'billing' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl inline-block border border-emerald-500/20">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-black text-white">Ultra-Fast Checkout & Barcode Billing</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Designed for high-traffic checkouts. Supports handheld USB barcode scanners, multi-product variations,
                    instant discounts, customer credit lookups, and split payments without taking your hands off the keyboard.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300 font-medium">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Full keyboard hotkeys (F2 Checkout, F4 Search, F5 Shifts)</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Multiple payment methods: Cash, Card, Bank, Credit Ledger</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Automatic tax calculation & percentage discounts</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Checkout Features Built-In</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <div className="font-bold text-white">Barcode Scanning</div>
                      <div className="text-slate-400 text-[11px] mt-1">Instant SKU & Barcode resolution</div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <div className="font-bold text-white">Customer Loyalty</div>
                      <div className="text-slate-400 text-[11px] mt-1">Credit limits & point tracking</div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <div className="font-bold text-white">Quick Cash Tender</div>
                      <div className="text-slate-400 text-[11px] mt-1">Auto change calculation</div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <div className="font-bold text-white">Zero Cloud Lag</div>
                      <div className="text-slate-400 text-[11px] mt-1">Direct local SQLite execution</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl inline-block border border-blue-500/20">
                    <Layers className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-black text-white">Product & Batch Inventory Control</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Track stock across multiple warehouses or branches. Includes automatic FIFO batch allocation,
                    expiry date warnings, supplier purchase orders, and stock audit adjustment ledgers.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300 font-medium">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-400" /> Supplier purchase invoices with payment tracking</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-400" /> Batch-level cost and selling price margins</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-400" /> Low stock alerts & reorder thresholds</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                  <div className="text-slate-400 font-sans font-bold uppercase text-[11px]">Live Stock Allocation Preview</div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="text-white font-bold">Anchor Butter 250g</div>
                      <div className="text-[10px] text-slate-500">Batch: B-2026-091 • Exp: 12/2026</div>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold">142 In Stock</span>
                      <div className="text-[10px] text-slate-400">Cost: Rs. 650.00</div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="text-white font-bold">Munchee Super Cream Cracker</div>
                      <div className="text-[10px] text-slate-500">Batch: B-2026-118 • Exp: 08/2027</div>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold">85 In Stock</span>
                      <div className="text-[10px] text-slate-400">Cost: Rs. 210.00</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sales' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl inline-block border border-purple-500/20">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-black text-white">Sales Records & Full Audit History</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Search historical transactions in milliseconds. Reprint previous thermal receipts, process item returns
                    with inventory reversal, and review cashier shift openings and closings with complete cash difference auditing.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300 font-medium">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-purple-400" /> Tamper-evident receipt logs</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-purple-400" /> Cash drawer float, cash-in, and cash-out reconciliation</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-purple-400" /> Full sales return & refund tracking</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3 text-xs">
                  <div className="text-slate-400 font-bold uppercase text-[11px]">Shift Summary Record</div>
                  <div className="space-y-2 text-slate-300">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span>Opening Float:</span>
                      <span className="font-bold text-white">Rs. 10,000.00</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span>Total Cash Sales:</span>
                      <span className="font-bold text-emerald-400">Rs. 84,320.00</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span>Card / Digital Payments:</span>
                      <span className="font-bold text-cyan-400">Rs. 32,150.00</span>
                    </div>
                    <div className="flex justify-between py-1 font-bold text-white">
                      <span>Net Cash in Drawer:</span>
                      <span className="text-emerald-400">Rs. 94,320.00</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl inline-block border border-amber-500/20">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-black text-white">Financial Reports & Profit Margins</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Understand your business performance at a glance. Instant daily, weekly, and monthly revenue summaries,
                    profit and loss, top-selling products, and double-entry accounting ledgers.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300 font-medium">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-400" /> Gross & Net profit margin analysis</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-400" /> Exportable financial reports for tax filing</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-400" /> Integrated Chart of Accounts and General Ledger</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 text-xs">
                  <div className="flex items-center justify-between text-slate-400 font-bold">
                    <span>MONTHLY REVENUE SNAPSHOT</span>
                    <span className="text-emerald-400 font-bold">+24% vs Last Month</span>
                  </div>
                  <div className="text-3xl font-black text-white">Rs. 1,425,800.00</div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Gross Profit</span>
                      <span className="text-base font-black text-emerald-400">Rs. 412,500</span>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Completed Orders</span>
                      <span className="text-base font-black text-cyan-400">1,894 Bills</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'printer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl inline-block border border-cyan-500/20">
                    <Printer className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-black text-white">Thermal Receipt & Hardware Support</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Plug and play with all standard Windows thermal printers (80mm and 58mm).
                    Automatic electronic cash drawer opening via ESC/POS pulse signals on checkout.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300 font-medium">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cyan-400" /> Native 80mm & 58mm roll printing (EPSON, Xprinter, Rongta, Star)</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cyan-400" /> Automatic cash drawer kick pulse (RJ11/RJ12 connector)</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cyan-400" /> Custom store header, logo, and footer return policy</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3 font-mono text-center text-xs">
                  <div className="bg-white text-slate-950 p-4 rounded-xl shadow-inner max-w-xs mx-auto space-y-2 text-left">
                    <div className="text-center font-bold text-sm">TRIWYN RETAIL STORE</div>
                    <div className="text-center text-[10px] text-slate-600">123 Galle Road, Colombo • Tel: 0770802365</div>
                    <div className="border-b border-dashed border-slate-400 my-1" />
                    <div className="flex justify-between text-[11px]">
                      <span>INV: #TRX-9482</span>
                      <span>05/10/2026</span>
                    </div>
                    <div className="border-b border-dashed border-slate-400 my-1" />
                    <div className="flex justify-between font-bold text-xs">
                      <span>TOTAL (4 Items):</span>
                      <span>Rs. 4,850.00</span>
                    </div>
                    <div className="text-center text-[10px] text-slate-500 pt-2 font-sans font-bold">
                      Thank you for shopping with us!
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          4. FEATURES SECTION (Professional Grid)
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Enterprise Capabilities</span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">Built For Every Aspect of Your Store</h2>
          <p className="text-sm sm:text-base text-slate-400">
            A comprehensive suite of retail tools packaged in a lightweight, native Windows desktop application.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { title: 'Fast Billing', desc: 'Scan barcodes and complete sales in under 3 seconds.', icon: ShoppingBag },
            { title: 'Inventory Management', desc: 'Real-time stock alerts, batch numbers and expiry tracking.', icon: Layers },
            { title: 'Product Management', desc: 'Categorized items, variants, multiple barcode aliases.', icon: Cpu },
            { title: 'Customer Management', desc: 'Track balances, customer credit history, and loyalty.', icon: Users },
            { title: 'Sales Tracking', desc: 'Full transaction receipts, refunds, and void audits.', icon: Receipt },
            { title: 'Reports & Analytics', desc: 'Gross margin, daily cashier reconciliation, profit and loss.', icon: BarChart3 },
            { title: 'Receipt Printing', desc: 'Silent ESC/POS thermal printing & cash drawer kicks.', icon: Printer },
            { title: 'User Management', desc: 'Multi-cashier logins with individual shift registers.', icon: Users },
            { title: 'Role-Based Access', desc: 'Enforce manager permissions for discounts and returns.', icon: Lock },
            { title: 'Business Settings', desc: 'Custom receipt branding, currency, tax rates and backup.', icon: Monitor },
          ].map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl hover:border-emerald-500/40 hover:bg-slate-900 transition-all space-y-2.5">
                <div className="p-2.5 bg-slate-800/80 rounded-xl text-emerald-400 inline-block">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white text-sm">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          5. HOW IT WORKS (4-Step Process)
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-6 border-t border-slate-800/80 bg-slate-900/20">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Simple Onboarding</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">How Getting Started Works</h2>
            <p className="text-sm sm:text-base text-slate-400">
              Go from zero to a live desktop POS terminal in under 5 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Start Your Free Trial',
                desc: 'Fill out the quick 1-minute form below with your business name. No credit card or payment required.',
              },
              {
                step: '02',
                title: 'Download & Install POS',
                desc: 'Download the Windows installer (POS-Setup.exe) along with our simple Quick Start & Setup Guide.',
              },
              {
                step: '03',
                title: 'Try the POS for 14 Days',
                desc: 'Launch the application on your computer. Add your products, test barcode scanning, and ring up sales.',
              },
              {
                step: '04',
                title: 'Activate After Payment',
                desc: 'Send a quick WhatsApp message to verify payment. Receive your permanent login credentials directly.',
              },
            ].map((step, idx) => (
              <div key={idx} className="relative p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                <span className="text-3xl font-black text-emerald-500/30">{step.step}</span>
                <h3 className="text-lg font-black text-white">{step.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          6. FREE TRIAL REGISTRATION FORM (Main Conversion Anchor)
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="register-trial" className="py-20 px-6 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto">
          
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-8 relative overflow-hidden">
            
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                <Clock className="h-3.5 w-3.5" /> 14 Days Free • No Credit Card
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white">Create Your 14-Day Free Trial</h2>
              <p className="text-sm text-slate-300">
                Enter your business details below to generate your trial account and receive immediate access
                to the Windows Desktop POS installer and setup guide.
              </p>
            </div>

            {formError && (
              <div className="p-4 bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterTrial} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium focus:border-emerald-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Business Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metro Supermarket"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium focus:border-emerald-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Phone Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 0770802365"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium focus:border-emerald-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@business.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium focus:border-emerald-500 outline-none transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium focus:border-emerald-500 outline-none transition-colors"
                  >
                    <option value="Sri Lanka">Sri Lanka</option>
                    <option value="India">India</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United States">United States</option>
                    <option value="Australia">Australia</option>
                    <option value="Singapore">Singapore</option>
                    <option value="UAE">United Arab Emirates</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="h-4 w-4 rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
                  />
                  <span>
                    I agree to the{' '}
                    <Link href="/terms" target="_blank" className="text-emerald-400 font-bold hover:underline" onClick={(e) => e.stopPropagation()}>
                      Terms &amp; Conditions
                    </Link>
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                    className="h-4 w-4 rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
                  />
                  <span>
                    I agree to the{' '}
                    <Link href="/privacy" target="_blank" className="text-emerald-400 font-bold hover:underline" onClick={(e) => e.stopPropagation()}>
                      Privacy Policy
                    </Link>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-13 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Creating Your Trial Account…</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5" />
                    <span>CREATE FREE TRIAL</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center text-xs text-slate-400">
              Already downloaded? Launch the application on your computer to log in.
            </div>

          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          7. WHATSAPP ACTIVATION PROCESS (Manual Activation Rules 18-20)
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="activation" className="py-20 px-6 border-t border-slate-800/80 bg-slate-900/30">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Manual License Verification</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">How Account Activation Works</h2>
            <p className="text-sm sm:text-base text-slate-400">
              Simple, transparent, direct support without automatic recurring credit card deductions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-5xl mx-auto">
            
            {/* Steps */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-start gap-3.5">
                <span className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                <div>
                  <h4 className="font-bold text-white text-sm">Send Your Trial ID via WhatsApp</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Contact our support numbers (0770802365 / 0750802353) with your Trial ID.</p>
                </div>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-start gap-3.5">
                <span className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                <div>
                  <h4 className="font-bold text-white text-sm">Make Bank Transfer</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Super Admin provides official bank details. Transfer the plan fee and send payment receipt.</p>
                </div>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-start gap-3.5">
                <span className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                <div>
                  <h4 className="font-bold text-white text-sm">Super Admin Payment Verification</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Admin verifies the bank slip and activates your commercial account in the licensing portal.</p>
                </div>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-start gap-3.5">
                <span className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">4</span>
                <div>
                  <h4 className="font-bold text-white text-sm">Receive Permanent Username & Password</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Super admin assigns your official POS credentials directly to you.</p>
                </div>
              </div>
            </div>

            {/* WhatsApp Buttons Box */}
            <div className="bg-slate-900 p-8 rounded-3xl border border-emerald-500/40 shadow-xl space-y-6 text-center">
              <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 inline-block">
                <MessageCircle className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Direct WhatsApp Activation</h3>
                <p className="text-xs text-slate-400 mt-1">Tap below to chat with our verification specialists:</p>
              </div>

              <div className="space-y-3">
                <a
                  href="https://wa.me/94770802365?text=Hello%2C%20I%20would%20like%20to%20activate%20my%20POS.%0APlease%20provide%20the%20payment%20details."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Activate via WhatsApp: 0770802365</span>
                </a>

                <a
                  href="https://wa.me/94750802353?text=Hello%2C%20I%20would%20like%20to%20activate%20my%20POS.%0APlease%20provide%20the%20payment%20details."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Activate via WhatsApp: 0750802353</span>
                </a>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          8. FAQ SECTION
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="support" className="py-20 px-6 max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Questions & Answers</span>
          <h2 className="text-3xl font-black text-white">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4 text-xs">
          {[
            {
              q: 'Does TRIWYN POS require an internet connection to bill?',
              a: 'No! The POS is engineered as a 100% offline desktop application with an embedded local SQLite engine. You can ring up sales, print receipts, and manage inventory completely offline.'
            },
            {
              q: 'Which Windows versions are supported?',
              a: 'TRIWYN POS runs smoothly on Windows 10 and Windows 11 (64-bit). No third-party runtimes such as Node.js, Python, or PostgreSQL are required.'
            },
            {
              q: 'What thermal receipt printers work with the POS?',
              a: 'All standard 80mm and 58mm USB / Ethernet thermal printers work out of the box (including Epson, Rongta, Xprinter, and Bixolon). The system also sends automatic kick pulse signals to open standard cash drawers.'
            },
            {
              q: 'What happens when my 14-day free trial ends?',
              a: 'When your trial concludes, normal terminal billing is paused and you will see the activation screen. You simply contact support on WhatsApp (0770802365 / 0750802353) to transfer your license fee and receive permanent credentials.'
            },
            {
              q: 'Will my products and sales data be preserved after activation?',
              a: 'Yes, 100%. All your products, stock ledgers, and transactions entered during the trial remain safe on your local computer hard drive.'
            },
          ].map((item, i) => (
            <div key={i} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{item.q}</span>
              </h4>
              <p className="text-slate-400 leading-relaxed pl-6">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          9. FOOTER
          ─────────────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-xs text-slate-400">
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img src="/Assets/Icon.png" alt="Logo" className="h-7 w-7 object-contain" />
              <span className="font-black text-white text-base">TRIWYN POS</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              Professional offline-first point of sale desktop software for retail, supermarkets, and trading organizations.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-white uppercase text-[11px] tracking-wider">Product</div>
            <div><button onClick={() => scrollToSection('features')} className="hover:text-emerald-400">Features</button></div>
            <div><button onClick={() => scrollToSection('how-it-works')} className="hover:text-emerald-400">How It Works</button></div>
            <div><button onClick={() => scrollToSection('register-trial')} className="hover:text-emerald-400">Free 14-Day Trial</button></div>
            <div><Link href="/download-trial" className="hover:text-emerald-400">Download POS</Link></div>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-white uppercase text-[11px] tracking-wider">Support & Activation</div>
            <div>WhatsApp: <a href="https://wa.me/94770802365" className="text-emerald-400 font-bold hover:underline">0770802365</a></div>
            <div>WhatsApp: <a href="https://wa.me/94750802353" className="text-emerald-400 font-bold hover:underline">0750802353</a></div>
            <div>Email: <span className="text-slate-300">support@triwynpos.com</span></div>
            <div>Operating Hours: Mon – Sat (8:30 AM – 7:00 PM)</div>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-white uppercase text-[11px] tracking-wider">Company &amp; Legal</div>
            <div><Link href="/terms" className="hover:text-emerald-400 transition-colors">Terms &amp; Conditions</Link></div>
            <div><Link href="/privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</Link></div>
            <div><Link href="/terms#licensing" className="hover:text-emerald-400 transition-colors">License Agreement</Link></div>
            <div className="pt-2 text-slate-500">© 2026 TRIWYN POS. All Rights Reserved.</div>
          </div>

        </div>
      </footer>

    </div>
  );
}
