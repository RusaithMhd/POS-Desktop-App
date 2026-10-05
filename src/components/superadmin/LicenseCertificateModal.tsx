'use client';

import React, { useState } from 'react';
import {
  Shield, CheckCircle2, Award, Copy, Check, Printer,
  Building2, Calendar, Key, Monitor, Download, X
} from 'lucide-react';

interface LicenseCertificateModalProps {
  customer: {
    organization_id: string;
    business_name: string;
    full_name: string;
    email: string;
    phone?: string;
    selected_plan_code: string;
    billing_cycle: string;
    status: string;
    trial_ends_at?: string;
    created_at: string;
  };
  onClose: () => void;
}

export function LicenseCertificateModal({ customer, onClose }: LicenseCertificateModalProps) {
  const [copied, setCopied] = useState(false);

  const licenseKey = `TRW-${customer.organization_id.replace(/^org-/, '').toUpperCase()}-COMMERCIAL-2026`;
  const isTrial = customer.status === 'TRIALING' || customer.selected_plan_code === 'FREE_TRIAL';

  const certificateText = `
============================================================
           TRIWYN POS COMMERCIAL SOFTWARE LICENSE
============================================================
ORGANIZATION:        ${customer.business_name}
REGISTERED OWNER:    ${customer.full_name} (${customer.email})
ORGANIZATION ID:     ${customer.organization_id}
LICENSE KEY:         ${licenseKey}
LICENSE TYPE:        ${isTrial ? '14-Day Free Evaluation' : `${customer.selected_plan_code} Commercial License`}
BILLING CYCLE:       ${customer.billing_cycle || 'Monthly'}
LICENSE STATUS:      ${customer.status.toUpperCase()}
EXPIRATION DATE:     ${customer.trial_ends_at ? new Date(customer.trial_ends_at).toLocaleDateString() : 'Active Commercial'}
HARDWARE NODES:      Authorized for Windows Offline POS Terminals
SECURITY INTEGRITY:  AES-256 Offline SQLite Storage

SUPPORT HOTLINES:    +94 77 080 2365 / +94 75 080 2353
OFFICIAL PORTAL:     https://triwynpos.com
============================================================
`.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(certificateText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Commercial License Certificate</h3>
              <p className="text-xs text-slate-400">{customer.business_name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Certificate Display */}
        <div className="p-5 bg-gradient-to-b from-slate-950 to-slate-900 border border-amber-500/30 rounded-2xl space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-black text-amber-400 tracking-wider uppercase">Official License Record</span>
            </div>
            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
              customer.status === 'ACTIVE'
                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : 'bg-cyan-950 text-cyan-400 border-cyan-800'
            }`}>
              {customer.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] font-bold uppercase">Business Name</span>
              <span className="font-bold text-white text-sm">{customer.business_name}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] font-bold uppercase">Assigned Plan</span>
              <span className="font-bold text-amber-400 text-sm">{customer.selected_plan_code}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] font-bold uppercase">Organization ID</span>
              <span className="font-mono text-slate-300 text-xs">{customer.organization_id}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] font-bold uppercase">Valid Until</span>
              <span className="font-mono text-emerald-400 text-xs font-bold">
                {customer.trial_ends_at ? new Date(customer.trial_ends_at).toLocaleDateString() : 'Lifetime Commercial'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Cryptographic License Key</span>
            <div className="mt-1 p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-amber-300 break-all select-all flex items-center justify-between">
              <span>{licenseKey}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Certificate</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied Certificate!' : 'Copy Certificate'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
