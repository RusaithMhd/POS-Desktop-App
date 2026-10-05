'use client';

import React from 'react';
import Link from 'next/link';
import {
  Shield, Lock, ArrowLeft, Printer, CheckCircle2,
  Database, EyeOff, Server, HardDrive, MessageCircle
} from 'lucide-react';

export default function PrivacyPolicyPage() {
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
              <span className="hidden sm:inline">Print Policy</span>
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
            <Lock className="h-3.5 w-3.5" />
            <span>Zero-Cloud Retail Privacy Commitment</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            PRIVACY POLICY
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Effective Date: October 2026 • How TRIWYN POS protects merchant store data, terminal licensing integrity, and customer privacy.
          </p>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          MAIN CONTENT
          ─────────────────────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto py-12 px-6 space-y-10 text-sm leading-relaxed text-slate-300">
        
        {/* Core Offline Privacy Guarantee */}
        <div className="p-6 bg-slate-900 border border-emerald-500/30 rounded-3xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <HardDrive className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Our Core Privacy Philosophy: Offline-First</h3>
              <p className="text-xs text-slate-400">Your store sales and accounting data never leave your computer.</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Unlike cloud-only POS systems that upload every receipt and product margin to remote public servers, TRIWYN POS is architected as an <strong>embedded offline desktop solution</strong>. Your financial journals, barcode inventories, customer contact databases, and cashier shifts are stored exclusively on your terminal's local hard drive in an encrypted SQLite database.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">01.</span>
            <span>Information We Collect</span>
          </h2>
          <p>
            To deliver commercial licensing, free trials, and technical support, we collect only minimal, essential business information:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-xs text-slate-400">
            <li><strong className="text-white">Account Registration Details:</strong> Full Name, Business Name, Contact Phone Number, Email Address, and Country entered when requesting a 14-day free trial on our website.</li>
            <li><strong className="text-white">Hardware Terminal Fingerprint:</strong> Machine GUID / Operating System identifiers used solely to bind software licenses to your physical cashier terminal and prevent unauthorized license cloning.</li>
            <li><strong className="text-white">Bank Transfer Verification Data:</strong> Bank deposit slips, transaction reference numbers, and billing confirmation images voluntarily provided via WhatsApp for subscription activation.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">02.</span>
            <span>Information We NEVER Collect or Monitor</span>
          </h2>
          <p>
            We strictly do NOT collect, transmit, or analyze your internal retail data:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="font-bold text-red-400 flex items-center gap-1.5">
                <EyeOff className="h-4 w-4" /> NO Sales Transactions
              </span>
              <p className="text-slate-400">We do not see your daily revenues, basket sizes, or receipt totals.</p>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="font-bold text-red-400 flex items-center gap-1.5">
                <EyeOff className="h-4 w-4" /> NO Wholesale Margins
              </span>
              <p className="text-slate-400">Your supplier costs, profit margins, and purchase invoices remain confidential.</p>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="font-bold text-red-400 flex items-center gap-1.5">
                <EyeOff className="h-4 w-4" /> NO In-Store Customer Debts
              </span>
              <p className="text-slate-400">Customer credit ledgers and loyalty phone numbers remain on your disk.</p>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="font-bold text-red-400 flex items-center gap-1.5">
                <EyeOff className="h-4 w-4" /> NO Payment Card Data
              </span>
              <p className="text-slate-400">Customer credit/debit card numbers are never processed or retained by TRIWYN POS.</p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">03.</span>
            <span>Local Database Security &amp; Encryption</span>
          </h2>
          <p className="text-xs text-slate-300">
            The local database (<code>triwyn_pos.sqlite</code>) is maintained inside your operating system’s secure application directory (<code>%LOCALAPPDATA%</code>). User credentials and administrative PINs are salted and hashed using industry-standard <strong>bcrypt</strong> before storage.
          </p>
          <p className="text-xs text-slate-400">
            When exporting <code>.posbak</code> backup archives to USB drives, merchants are advised to store physical media in a fireproof cash safe or encrypted storage device.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">04.</span>
            <span>WhatsApp Communications &amp; Payment Proof</span>
          </h2>
          <p className="text-xs text-slate-300">
            Official communications, technical assistance, and payment verifications take place over end-to-end encrypted WhatsApp chats via our designated hotlines (<strong>0770802365</strong> &amp; <strong>0750802353</strong>). Bank transfer deposit slips submitted for license activations are retained strictly for corporate accounting audit compliance and are never disclosed to third parties.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">05.</span>
            <span>Third-Party Disclosures &amp; Commercial Integrity</span>
          </h2>
          <p className="text-xs text-slate-400">
            TRIWYN Technologies does not sell, trade, rent, or lease merchant contact databases to advertisers, marketing brokers, or competitive entities. Your registration information is utilized solely for customer service, subscription renewals, and security advisories.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="text-emerald-400 font-mono text-base">06.</span>
            <span>Merchant Rights &amp; Data Erasure</span>
          </h2>
          <p className="text-xs text-slate-400">
            Because your operational data is stored on your local computer, you possess total unilateral control to delete, backup, or purge your sales records at any time simply by removing the application or clearing the database file. If you wish to delete your business contact record from our licensing registry, submit a formal request via WhatsApp or email.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-base">07.</span>
            <span>Privacy Inquiries &amp; Data Protection Officer</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-slate-400 font-bold block">Privacy &amp; Compliance Hotline</span>
              <a href="https://wa.me/94770802365" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-black text-base hover:underline">
                0770802365
              </a>
              <span className="text-[11px] text-slate-500 block">General Data Inquiries &amp; Licensing</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-slate-400 font-bold block">Technical Security Desk</span>
              <a href="https://wa.me/94750802353" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-black text-base hover:underline">
                0750802353
              </a>
              <span className="text-[11px] text-slate-500 block">Terminal Isolation &amp; Local DB Assistance</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center pt-2">
            Official Email: <span className="text-slate-300">support@triwynpos.com</span> • TRIWYN Technologies (Pvt) Ltd
          </p>
        </section>

      </main>

      {/* ───────────────────────────────────────────────────────────────────────
          FOOTER
          ─────────────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 px-6 text-center text-xs text-slate-500">
        <p>© 2026 TRIWYN POS Technologies. All Rights Reserved.</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="/terms" className="text-slate-400 hover:text-white">Terms &amp; Conditions</Link>
          <span>•</span>
          <Link href="/download-trial" className="text-slate-400 hover:text-white">Download POS</Link>
          <span>•</span>
          <Link href="/" className="text-slate-400 hover:text-white">Homepage</Link>
        </div>
      </footer>

    </div>
  );
}
