'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Download, FileText, CheckCircle2, Shield, Laptop, BookOpen,
  ArrowRight, MessageCircle, X, ChevronRight, Check, Printer,
  Store, ShoppingBag, Database, Lock, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

function DownloadContent() {
  const searchParams = useSearchParams();
  const trialId = searchParams?.get('trialId') || 'TRIAL-982415';
  const business = searchParams?.get('business') || 'Your Retail Business';
  const expiry = searchParams?.get('expiry') || new Date(Date.now() + 14 * 86400_000).toLocaleDateString();

  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      window.location.href = '/login';
    }
  }, []);

  const getZipDownloadUrl = () => {
    if (process.env.NEXT_PUBLIC_ZIP_DOWNLOAD_URL) {
      return process.env.NEXT_PUBLIC_ZIP_DOWNLOAD_URL;
    }
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return '/downloads/TRIWYN-POS-Complete-Setup-Package.zip';
    }
    return 'https://github.com/RusaithMhd/POS-Desktop-App/releases/latest/download/TRIWYN-POS-Complete-Setup-Package.zip';
  };

  const getExeDownloadUrl = () => {
    if (process.env.NEXT_PUBLIC_EXE_DOWNLOAD_URL) {
      return process.env.NEXT_PUBLIC_EXE_DOWNLOAD_URL;
    }
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return '/downloads/POS-Setup.exe';
    }
    return 'https://github.com/RusaithMhd/POS-Desktop-App/releases/latest/download/POS-Setup.exe';
  };

  const handleDownloadZipPackage = () => {
    setDownloadStarted('Entire Application Package (ZIP with Installer & Support Files)');
    const url = getZipDownloadUrl();
    if (url.startsWith('http')) {
      window.open(url, '_blank');
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = 'TRIWYN-POS-Complete-Setup-Package.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadInstaller = () => {
    setDownloadStarted('Standalone Windows Installer (POS-Setup.exe)');
    const url = getExeDownloadUrl();
    if (url.startsWith('http')) {
      window.open(url, '_blank');
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = 'POS-Setup.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSupportFile = (filename: string) => {
    const link = document.createElement('a');
    link.href = `/downloads/${filename}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
            Registration Successful • 14-Day Full Access
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white">YOUR POS TRIAL IS READY</h1>
          <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Your 14-day commercial trial account has been generated for <strong className="text-white">{business}</strong>.
            Download the complete Windows desktop package containing the installer, native drivers, and setup guides.
          </p>
        </div>

        {/* 2-Column Info & Download Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Official Trial Info */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl flex flex-col justify-between">
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

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>How to Log In to the POS?</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Install and launch the desktop application on your PC. The application communicates with your secure local offline database. When prompted, log in with your account credentials.
                </p>
              </div>

              <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl space-y-2">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
                  Activation Assistance
                </span>
                <p className="text-[11px] text-slate-300">
                  Need an official paid license or printer setup support? WhatsApp our activation team directly:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href="https://wa.me/94770802365"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>0770802365</span>
                  </a>
                  <a
                    href="https://wa.me/94750802353"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-500/30 transition-all flex items-center gap-1.5"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>0750802353</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              <Link href="/" className="text-xs font-bold text-slate-400 hover:text-white transition-colors">
                ← Return to Main Website
              </Link>
            </div>
          </div>

          {/* Right Column: Download Actions & Support Files */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                    <Laptop className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Download Entire Application Suite</h3>
                    <p className="text-xs text-slate-400">Windows 10 / Windows 11 (64-bit)</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] uppercase tracking-wider">
                  v1.0 Enterprise
                </span>
              </div>

              {/* PRIMARY ACTION: Download Complete ZIP Package with Support Files */}
              <div className="p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-emerald-500/50 rounded-2xl space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase px-3 py-0.5 rounded-bl-lg tracking-wider">
                  Complete Bundle
                </div>
                
                <div>
                  <h4 className="font-black text-white text-base flex items-center gap-2">
                    <span>Full Application &amp; Support Package</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Includes NSIS Installer (<code className="text-emerald-400">POS-Setup.exe</code>), 1-Click Batch Installer, Hardware &amp; Printer Guides, Offline Manual, and WhatsApp Support configs.
                  </p>
                </div>

                <button
                  onClick={handleDownloadZipPackage}
                  className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-3 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Download className="h-5 w-5" />
                  <span>DOWNLOAD ENTIRE APPLICATION (.ZIP)</span>
                </button>
                <div className="flex justify-between text-[11px] text-slate-400 px-1 font-mono">
                  <span>File: TRIWYN-POS-Complete-Setup-Package.zip</span>
                  <span>Size: ~168 MB</span>
                </div>
              </div>

              {/* SECONDARY ACTION: Standalone Executable */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-white text-xs">Direct Windows Installer (.EXE)</h5>
                    <p className="text-[11px] text-slate-400">If you only need the single-click NSIS setup wizard executable.</p>
                  </div>
                  <button
                    onClick={handleDownloadInstaller}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <Download className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Download .EXE</span>
                  </button>
                </div>
              </div>

              {downloadStarted && (
                <div className="p-3.5 bg-emerald-950/70 border border-emerald-700/80 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Download started for: <strong className="text-white">{downloadStarted}</strong>. Check your browser downloads.</span>
                </div>
              )}

              {/* INDIVIDUAL SUPPORT FILES DOWNLOADS */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Included Support &amp; Setup Documentation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => handleDownloadSupportFile('Installation_Guide.html')}
                    className="p-3 bg-slate-950 hover:bg-slate-800/90 text-left border border-slate-800 rounded-xl flex items-center justify-between transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span className="truncate text-slate-200 group-hover:text-white">Installation_Guide.html</span>
                    </div>
                    <Download className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                  </button>

                  <button
                    onClick={() => handleDownloadSupportFile('Hardware_and_Thermal_Printer_Setup.txt')}
                    className="p-3 bg-slate-950 hover:bg-slate-800/90 text-left border border-slate-800 rounded-xl flex items-center justify-between transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Printer className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="truncate text-slate-200 group-hover:text-white">Thermal_Printer_Setup.txt</span>
                    </div>
                    <Download className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                  </button>

                  <button
                    onClick={() => handleDownloadSupportFile('Quick_Start_Guide.txt')}
                    className="p-3 bg-slate-950 hover:bg-slate-800/90 text-left border border-slate-800 rounded-xl flex items-center justify-between transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <BookOpen className="h-4 w-4 text-purple-400 shrink-0" />
                      <span className="truncate text-slate-200 group-hover:text-white">Quick_Start_Guide.txt</span>
                    </div>
                    <Download className="h-3.5 w-3.5 text-slate-500 group-hover:text-purple-400 shrink-0" />
                  </button>

                  <button
                    onClick={() => handleDownloadSupportFile('Install_TRIWYN_POS.bat')}
                    className="p-3 bg-slate-950 hover:bg-slate-800/90 text-left border border-slate-800 rounded-xl flex items-center justify-between transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Laptop className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="truncate text-slate-200 group-hover:text-white">Install_TRIWYN_POS.bat</span>
                    </div>
                    <Download className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 shrink-0" />
                  </button>

                  <button
                    onClick={() => handleDownloadSupportFile('Uninstall_TRIWYN_POS.bat')}
                    className="p-3 bg-slate-950 hover:bg-slate-800/90 text-left border border-slate-800 rounded-xl flex items-center justify-between transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Trash2 className="h-4 w-4 text-rose-400 shrink-0" />
                      <span className="truncate text-slate-200 group-hover:text-white">Uninstall_TRIWYN_POS.bat</span>
                    </div>
                    <Download className="h-3.5 w-3.5 text-slate-500 group-hover:text-rose-400 shrink-0" />
                  </button>
                </div>
              </div>

              {/* View in Browser Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setShowInstallGuide(true)}
                  className="flex-1 py-2.5 px-3 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Interactive Setup Guide</span>
                </button>
                <button
                  onClick={() => setShowQuickGuide(true)}
                  className="flex-1 py-2.5 px-3 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <BookOpen className="h-3.5 w-3.5 text-purple-400" />
                  <span>Cashier Operations Guide</span>
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* ───────────────────────────────────────────────────────────────────────
            3. PROPER WINDOWS INSTALLATION STEPS (Dedicated Step-by-Step Card)
            ─────────────────────────────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                Installation Walkthrough
              </span>
              <h3 className="text-xl font-black text-white">How to Properly Install TRIWYN POS on Windows</h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">Estimated Time: ~1 Minute</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">1</span>
                <h4 className="font-bold text-white text-xs">Extract ZIP</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Right-click <code className="text-emerald-400 text-[10px]">TRIWYN-POS-Complete-Setup-Package.zip</code> and select <strong>"Extract All"</strong> to access the installer and support files.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">2</span>
                <h4 className="font-bold text-white text-xs">Run Setup</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Double-click <strong className="text-white">POS-Setup.exe</strong> or run <code className="text-cyan-400 text-[10px]">Install_TRIWYN_POS.bat</code>. If Windows SmartScreen appears, click <u>More info</u> &rarr; <u>Run anyway</u>.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">3</span>
                <h4 className="font-bold text-white text-xs">Follow Wizard</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Choose installation folder and keep <strong>"Create Desktop Shortcut"</strong> checked. The wizard registers the program in your Windows Start Menu.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">4</span>
                <h4 className="font-bold text-white text-xs">Launch Desktop POS</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Launch <strong className="text-white">TRIWYN POS</strong> from your desktop. The offline SQLite engine and cashier register initialize automatically!
              </p>
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
              <p className="text-xs text-slate-400 mt-0.5">Our support engineers are available on WhatsApp to assist you directly.</p>
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
