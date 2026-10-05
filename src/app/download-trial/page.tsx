'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Download, FileText, CheckCircle2, Shield, Laptop, BookOpen,
  ArrowRight, MessageCircle, X, ChevronRight, Check, Printer,
  Store, ShoppingBag, Database, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';

function DownloadContent() {
  const searchParams = useSearchParams();
  const trialId = searchParams.get('trialId') || 'TRIAL-982415';
  const business = searchParams.get('business') || 'Your Retail Business';
  const expiry = searchParams.get('expiry') || new Date(Date.now() + 14 * 86400_000).toLocaleDateString();

  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);

  const handleDownloadInstaller = () => {
    setDownloadStarted(true);
    // Create simulated file download of the Windows Installer
    const element = document.createElement('a');
    const file = new Blob([
      `TRIWYN POS Commercial Desktop Installer v1.0.0\nTrial ID: ${trialId}\nTarget OS: Windows 10/11 (64-bit)\nInstaller Package: POS-Setup.exe`
    ], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'POS-Setup.exe';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
            Registration Successful
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white">YOUR FREE TRIAL IS READY</h1>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Your 14-day trial account has been created for <strong className="text-white">{business}</strong>.
            Download the Desktop POS application and install it on your Windows computer.
          </p>
        </div>

        {/* 2-Column Info & Download Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Column: Official Trial Info (NO PASSWORDS OR USERNAMES) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Trial Account Details</h3>
                  <p className="text-xs text-slate-400">Keep your Trial ID handy for support</p>
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                  <span className="text-slate-400 font-bold uppercase text-[11px]">Trial ID</span>
                  <span className="font-mono font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800 text-sm">
                    {trialId}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                  <span className="text-slate-400 font-bold uppercase text-[11px]">Business</span>
                  <span className="font-bold text-white text-right truncate max-w-[180px]">{business}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                  <span className="text-slate-400 font-bold uppercase text-[11px]">Trial Period</span>
                  <span className="font-bold text-cyan-400">14 Days (Full Access)</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400 font-bold uppercase text-[11px]">Expires On</span>
                  <span className="font-bold text-amber-400">{expiry}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="font-bold text-slate-200">How do I log in?</div>
                <p>
                  Launch the installed desktop app on your PC. The application communicates with your secure local terminal database.
                </p>
              </div>
            </div>

            <div className="pt-2 text-center text-xs text-slate-500">
              Need assistance? WhatsApp us at <strong className="text-emerald-400">0770802365</strong>
            </div>
          </div>

          {/* Right Column: Download Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                  <Laptop className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Download & Documentation</h3>
                  <p className="text-xs text-slate-400">Windows 10 / Windows 11 (64-bit)</p>
                </div>
              </div>

              {/* Main Download Button */}
              <div className="space-y-2">
                <button
                  onClick={handleDownloadInstaller}
                  className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-2xl font-black text-sm tracking-wide shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Download className="h-5 w-5" />
                  <span>DOWNLOAD DESKTOP POS</span>
                </button>
                <div className="flex justify-between text-[11px] text-slate-400 px-1">
                  <span>File: POS-Setup.exe</span>
                  <span>Size: ~85 MB</span>
                </div>
              </div>

              {downloadStarted && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Download initiated! Check your browser downloads folder.</span>
                </div>
              )}

              {/* Guides Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={() => setShowInstallGuide(true)}
                  className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-cyan-400" />
                    <span>VIEW INSTALLATION GUIDE</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>

                <button
                  onClick={() => setShowQuickGuide(true)}
                  className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="h-4 w-4 text-purple-400" />
                    <span>VIEW QUICK START GUIDE</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="text-center pt-2">
              <Link href="/" className="text-xs font-bold text-slate-400 hover:text-white transition-colors">
                ← Return to Homepage
              </Link>
            </div>
          </div>

        </div>

        {/* WhatsApp Activation Prompt Banner */}
        <div className="p-6 bg-slate-900 border border-emerald-500/30 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Need help setting up your printer or activating?</h4>
              <p className="text-xs text-slate-400 mt-0.5">Our support team is available on WhatsApp to assist you.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://wa.me/94770802365"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
            >
              0770802365
            </a>
            <a
              href="https://wa.me/94750802353"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-bold border border-emerald-500/30 transition-all"
            >
              0750802353
            </a>
          </div>
        </div>

      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          MODAL: INSTALLATION GUIDE (9-Step)
          ─────────────────────────────────────────────────────────────────────── */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <h3 className="text-lg font-black text-white">POS Desktop Installation Guide</h3>
                <p className="text-xs text-slate-400">Step-by-step setup for Windows computers</p>
              </div>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {[
                { step: 1, title: 'Download Installer', text: 'Click the "DOWNLOAD DESKTOP POS" button to save POS-Setup.exe to your computer.' },
                { step: 2, title: 'Open the Downloaded Installer', text: 'Locate the POS-Setup.exe file in your Downloads folder and double click to start.' },
                { step: 3, title: 'Follow Installation Wizard', text: 'Follow the standard on-screen Windows prompts. Installation takes less than 30 seconds.' },
                { step: 4, title: 'Create Desktop Shortcut', text: 'Check the box to place a convenient shortcut on your desktop for daily use.' },
                { step: 5, title: 'Launch TRIWYN POS', text: 'Double click the TRIWYN POS icon on your desktop to open the application.' },
                { step: 6, title: 'Sign In', text: 'Enter your credentials on the login screen to enter the POS terminal.' },
                { step: 7, title: 'Complete Initial Business Setup', text: 'Confirm your store name, currency, and tax rate under Settings.' },
                { step: 8, title: 'Configure Printer If Required', text: 'Connect your 80mm or 58mm thermal printer via USB and select it in Settings → Hardware.' },
                { step: 9, title: 'Start Using The POS', text: 'You are ready! Open Cash Register, add your items, and begin ring-up sales.' },
              ].map((s) => (
                <div key={s.step} className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-start gap-3.5">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                    {s.step}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{s.title}</h4>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <Button onClick={() => setShowInstallGuide(false)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl">
                Close Guide
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          MODAL: QUICK START GUIDE
          ─────────────────────────────────────────────────────────────────────── */}
      {showQuickGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <h3 className="text-lg font-black text-white">POS Quick Start Guide</h3>
                <p className="text-xs text-slate-400">Essential functions reference for cashiers and managers</p>
              </div>
              <button
                onClick={() => setShowQuickGuide(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {[
                { module: '1. Login & Shift Register', icon: Lock, desc: 'Every shift starts by opening the Cash Register with your starting cash float.' },
                { module: '2. Add Products', icon: Store, desc: 'Go to Products → Add Product. Enter SKU, barcode, cost price, and selling price.' },
                { module: '3. Manage Inventory', icon: Database, desc: 'Use Purchases to record new supplier deliveries with batch numbers and expiry dates.' },
                { module: '4. Create a Sale', icon: ShoppingBag, desc: 'Go to Point of Sale. Scan barcodes or click product tiles to add items to cart.' },
                { module: '5. Take Payment', icon: Check, desc: 'Press F2 or click Checkout. Select Cash, Card, or Split Tender.' },
                { module: '6. Print Thermal Receipt', icon: Printer, desc: 'Receipt prints automatically upon checkout. Press Ctrl+P to reprint last receipt.' },
                { module: '7. View Sales & Reports', icon: FileText, desc: 'Inspect daily turnover, gross profit margins, and shift cash summaries under Reports.' },
              ].map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div key={idx} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <Icon className="h-4 w-4 text-emerald-400" />
                      <span>{m.module}</span>
                    </div>
                    <p className="text-slate-400 pl-6 leading-relaxed">{m.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <Button onClick={() => setShowQuickGuide(false)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl">
                Close Guide
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function DownloadTrialPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading Trial Details…</div>}>
      <DownloadContent />
    </Suspense>
  );
}
