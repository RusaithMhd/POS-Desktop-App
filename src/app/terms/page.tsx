'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck, FileText, ArrowLeft, Printer, CheckCircle2,
  Lock, MessageCircle, AlertCircle, Building2, HelpCircle
} from 'lucide-react';

export default function TermsAndConditionsPage() {
  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* ───────────────────────────────────────────────────────────────────────
          HEADER
          ─────────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors group">
              <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg group-hover:border-slate-700">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">Back to Website</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <img src="/Assets/Icon.png" alt="Logo" className="h-6 w-6 object-contain" />
            <span className="font-black text-sm text-white">TRIWYN <span className="text-emerald-400">POS</span></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-bold border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Print Terms</span>
            </button>
          </div>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────────────────
          HERO BANNER
          ─────────────────────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-slate-950 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Commercial Software Licensing Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            TERMS &amp; CONDITIONS
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Effective Date: October 2026 • Applicable to TRIWYN POS Desktop Software, SaaS Subscriptions, and Terminal Licensing.
          </p>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          MAIN CONTENT
          ─────────────────────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto py-12 px-6 space-y-10 text-sm leading-relaxed text-slate-300">
        
        {/* Important Notice Callout */}
        <div className="p-5 bg-slate-900 border border-emerald-500/30 rounded-2xl flex items-start gap-4">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-white text-sm">Please Read Carefully</h4>
            <p className="text-slate-300 leading-relaxed">
              These Terms and Conditions constitute a legally binding commercial contract between you (the "Merchant" or "Licensee") and TRIWYN Technologies (Pvt) Ltd ("TRIWYN", "we", "our", or "Company"). By registering for a 14-day free trial, downloading the desktop installer, or purchasing a commercial license, you confirm your acceptance of these terms.
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">01.</span>
            <span>Definitions &amp; Interpretation</span>
          </h2>
          <p>
            Throughout this Agreement, the following terms hold explicit meanings:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-xs text-slate-400">
            <li><strong className="text-white">"Application" or "Software":</strong> Refers to the TRIWYN POS desktop executable, embedded SQLite storage engine, and associated native device drivers.</li>
            <li><strong className="text-white">"Merchant":</strong> Any registered individual, retailer, supermarket, wholesale trading company, or organization utilizing the application for business operations.</li>
            <li><strong className="text-white">"Trial Period":</strong> The 14-day complimentary evaluation license granted upon registration on our official website.</li>
            <li><strong className="text-white">"Super Admin":</strong> The centralized licensing and compliance authority operated exclusively by TRIWYN Technologies to verify bank payments and activate merchant licenses.</li>
            <li><strong className="text-white">"Local Database":</strong> The self-contained SQLite relational database residing securely on the Merchant's physical computer hard drive.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">02.</span>
            <span>Commercial License Grant &amp; Scope of Use</span>
          </h2>
          <p>
            Subject to compliance with these terms, TRIWYN grants the Merchant a non-exclusive, non-transferable, revocable license to install and operate the TRIWYN POS Desktop software on designated Windows cashier computers.
          </p>
          <p className="text-xs text-slate-400">
            Each commercial license key is paired with the physical hardware identifier (Machine GUID) of the terminal. Merchants operating multiple checkout lanes must obtain an authorized license for each active terminal.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">03.</span>
            <span>14-Day Free Evaluation Trial</span>
          </h2>
          <div className="space-y-2 text-xs text-slate-300">
            <p>
              1. <strong>No Payment Required:</strong> Free trial registration does not require credit card details or bank deposits.
            </p>
            <p>
              2. <strong>Duration:</strong> The trial license is valid for exactly 14 calendar days starting from the timestamp of account creation.
            </p>
            <p>
              3. <strong>Data Preservation:</strong> Upon expiration of the 14-day trial period, the POS terminal enters an inactive state until activated with a paid plan. Your local transaction records, item masters, and inventory batches remain stored intact on your hard drive and are never deleted.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">04.</span>
            <span>Subscription Plans, Bank Transfers &amp; Manual Activation</span>
          </h2>
          <p>
            TRIWYN POS operates on an upfront commercial subscription model (1 Month, 3 Months, 6 Months, or 1 Year Enterprise).
          </p>
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="font-bold text-white">Manual Verification Protocol:</div>
            <p className="text-slate-400">
              Payment is made via direct bank transfer to our authorized corporate account. To activate:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-300">
              <li>Customer provides their unique Trial ID (<code className="text-emerald-400">TRIAL-XXXXXX</code>).</li>
              <li>Customer transmits proof of bank deposit via official WhatsApp channels (<strong>0770802365</strong> / <strong>0750802353</strong>).</li>
              <li>Super Admin verifies funds clearance and manually issues official cashier and management credentials.</li>
            </ol>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">05.</span>
            <span>Offline Architecture &amp; Merchant Data Ownership</span>
          </h2>
          <p>
            <strong>You own 100% of your business data.</strong> TRIWYN POS is intentionally engineered as an offline-first desktop platform. All sales journals, profit margins, inventory levels, customer debts, and cashier cash floats reside locally on your terminal in an embedded SQLite database.
          </p>
          <p className="text-xs text-slate-400">
            TRIWYN Technologies does not copy, harvest, or monetize your retail transactions. Internet connectivity is utilized solely for license heartbeat verification and optional remote synchronization.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">06.</span>
            <span>Merchant Backup &amp; Hardware Responsibilities</span>
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-xs text-slate-400">
            <li><strong className="text-white">Database Backups:</strong> The Merchant is solely responsible for performing regular database backups using the software’s native <code>.posbak</code> export feature and saving files to a secondary flash drive or external disk.</li>
            <li><strong className="text-white">Uninterruptible Power Supply (UPS):</strong> Retail stores must connect terminals to a functioning UPS to prevent database corruption caused by sudden utility power failures.</li>
            <li><strong className="text-white">Hardware Peripherals:</strong> The Merchant is responsible for the physical condition and USB cabling of thermal receipt printers (80mm/58mm), barcode scanners, and RJ11 cash drawers.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">07.</span>
            <span>Prohibited Conduct &amp; Reverse Engineering</span>
          </h2>
          <p className="text-xs text-slate-400">
            Merchants agree not to: (a) reverse engineer, decompile, or disassemble the desktop application binaries; (b) bypass or tamper with the licensing and trial expiration mechanism; (c) duplicate software license keys across unauthorized machines; or (d) sub-license the software to unauthorized third parties.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">08.</span>
            <span>Limitation of Liability</span>
          </h2>
          <p className="text-xs text-slate-400">
            To the maximum extent permitted by applicable commercial law, TRIWYN Technologies shall not be held liable for indirect, incidental, punitive, or consequential damages, including loss of profits, inventory shrinkage, hardware failure, or business interruption resulting from power outages or improper computer usage.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">09.</span>
            <span>Governing Law &amp; Jurisdiction</span>
          </h2>
          <p className="text-xs text-slate-400">
            This Agreement is governed by and construed under the laws of the Democratic Socialist Republic of Sri Lanka. Any disputes arising in connection with commercial licenses shall be subject to the exclusive jurisdiction of the competent commercial courts of Colombo.
          </p>
        </section>

        {/* Section 10 */}
        <section className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-base">10.</span>
            <span>Official Support &amp; Activation Contacts</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-slate-400 font-bold block">WhatsApp Support Hotline 1</span>
              <a href="https://wa.me/94770802365" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-black text-base hover:underline">
                0770802365
              </a>
              <span className="text-[11px] text-slate-500 block">General Inquiries, Bank Slips &amp; Approvals</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-slate-400 font-bold block">WhatsApp Support Hotline 2</span>
              <a href="https://wa.me/94750802353" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-black text-base hover:underline">
                0750802353
              </a>
              <span className="text-[11px] text-slate-500 block">Hardware &amp; Thermal Printer Technical Setup</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center pt-2">
            Email Inquiries: <span className="text-slate-300">support@triwynpos.com</span> • Colombo, Sri Lanka
          </p>
        </section>

      </main>

      {/* ───────────────────────────────────────────────────────────────────────
          FOOTER
          ─────────────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 px-6 text-center text-xs text-slate-500">
        <p>© 2026 TRIWYN POS Technologies. All Rights Reserved.</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="/privacy" className="text-slate-400 hover:text-white">Privacy Policy</Link>
          <span>•</span>
          <Link href="/download-trial" className="text-slate-400 hover:text-white">Download POS</Link>
          <span>•</span>
          <Link href="/" className="text-slate-400 hover:text-white">Homepage</Link>
        </div>
      </footer>

    </div>
  );
}
