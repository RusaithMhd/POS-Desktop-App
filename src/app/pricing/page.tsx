'use client';

import React, { useState } from 'react';
import {
  CheckCircle2, X, Zap, Shield, Star, Building2, ArrowRight,
  Users, Monitor, GitBranch, Package, BarChart3, Headphones,
  Crown, Globe
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// PLAN DATA
// ─────────────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    code: 'FREE_TRIAL',
    name: 'Free Trial',
    tagline: 'Try before you buy',
    monthlyPrice: 0,
    yearlyPrice: 0,
    badge: null,
    highlight: false,
    color: 'from-slate-600 to-slate-700',
    btnClass: 'bg-slate-800 hover:bg-slate-700 text-white',
    users: 2, devices: 1, branches: 1, products: 500, transactions: 1000,
    trialDays: 14,
    features: ['POS Terminal', 'Basic Inventory', 'Sales Reports', 'Receipt Printing', 'Single Branch'],
    notIncluded: ['Multi-Branch', 'Advanced Reports', 'API Access', 'Priority Support'],
    support: 'Community',
  },
  {
    code: 'STARTER',
    name: 'Starter',
    tagline: 'Small businesses',
    monthlyPrice: 2999,
    yearlyPrice: 29990,
    badge: null,
    highlight: false,
    color: 'from-blue-600 to-blue-700',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    users: 3, devices: 2, branches: 1, products: 2000, transactions: 10000,
    trialDays: 0,
    features: ['Everything in Trial', 'Inventory Management', 'Customer Accounts', 'Supplier Management', 'Purchase Orders', 'Expense Tracking'],
    notIncluded: ['Multi-Branch', 'Advanced Reports', 'API Access'],
    support: 'Standard',
  },
  {
    code: 'PROFESSIONAL',
    name: 'Professional',
    tagline: 'Growing businesses',
    monthlyPrice: 5999,
    yearlyPrice: 59990,
    badge: 'Most Popular',
    highlight: true,
    color: 'from-emerald-600 to-teal-600',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30',
    users: 10, devices: 5, branches: 2, products: 10000, transactions: 50000,
    trialDays: 0,
    features: ['Everything in Starter', 'Multi-Branch (2)', 'Advanced Reports', 'Batch Management', 'Accounting Module', 'Kitchen Display', 'Shift Management'],
    notIncluded: ['API Access'],
    support: 'Priority',
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    tagline: 'Multi-location chains',
    monthlyPrice: 11999,
    yearlyPrice: 119990,
    badge: 'Best Value',
    highlight: false,
    color: 'from-violet-600 to-purple-700',
    btnClass: 'bg-violet-600 hover:bg-violet-700 text-white',
    users: 25, devices: 10, branches: 5, products: 50000, transactions: 200000,
    trialDays: 0,
    features: ['Everything in Professional', 'Multi-Branch (5)', 'API Access', 'Custom Branding', 'Advanced Analytics', 'Bulk Import/Export', 'Dedicated Account Manager'],
    notIncluded: [],
    support: 'Priority 24/7',
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Large enterprises',
    monthlyPrice: 0,
    yearlyPrice: 0,
    badge: 'Custom',
    highlight: false,
    color: 'from-amber-600 to-orange-600',
    btnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    users: 999, devices: 50, branches: 50, products: 999999, transactions: 999999,
    trialDays: 0,
    features: ['Everything in Business', 'Unlimited Users', '50+ Devices', '50+ Branches', 'Custom Integrations', 'SLA Guarantee', 'On-site Training', 'Custom Development'],
    notIncluded: [],
    support: '24/7 Dedicated',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PLAN CARD
// ─────────────────────────────────────────────────────────────────────────────

function PlanCard({ plan, billing }: { plan: typeof PLANS[0]; billing: 'monthly' | 'yearly' }) {
  const price = billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const isCustom = plan.code === 'ENTERPRISE';
  const isTrial = plan.code === 'FREE_TRIAL';

  const handleSelect = () => {
    window.location.href = `/register?plan=${plan.code}&billing=${billing}`;
  };

  return (
    <div className={`relative flex flex-col rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
      plan.highlight ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-slate-200 bg-white'
    }`}>
      {/* Badge */}
      {plan.badge && (
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white rounded-b-xl bg-gradient-to-r ${plan.color}`}>
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <div className={`bg-gradient-to-br ${plan.color} px-6 pt-8 pb-6 text-white`}>
        <div className="text-sm font-black uppercase tracking-wider opacity-90">{plan.name}</div>
        <div className="text-xs opacity-70 mt-0.5">{plan.tagline}</div>

        <div className="mt-4">
          {isCustom ? (
            <div className="text-3xl font-black">Custom</div>
          ) : isTrial ? (
            <div>
              <div className="text-3xl font-black">Free</div>
              <div className="text-xs opacity-80 font-semibold">{plan.trialDays}-day trial, no card required</div>
            </div>
          ) : (
            <div>
              <div className="flex items-end gap-1">
                <span className="text-sm font-bold opacity-80">LKR</span>
                <span className="text-3xl font-black">{price.toLocaleString()}</span>
                <span className="text-xs opacity-80 mb-1">/{billing === 'yearly' ? 'yr' : 'mo'}</span>
              </div>
              {billing === 'yearly' && (
                <div className="text-[11px] opacity-80 font-semibold">Save {Math.round((1 - plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100)}% vs monthly</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Limits */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 grid grid-cols-2 gap-2.5">
        {[
          { icon: Users, label: 'Users', value: plan.users >= 999 ? 'Unlimited' : plan.users },
          { icon: Monitor, label: 'Devices', value: plan.devices >= 50 ? '50+' : plan.devices },
          { icon: GitBranch, label: 'Branches', value: plan.branches >= 50 ? '50+' : plan.branches },
          { icon: Package, label: 'Products', value: plan.products >= 999999 ? 'Unlimited' : plan.products.toLocaleString() },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-2 text-xs">
            <stat.icon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">{stat.label}:</span>
            <span className="font-black text-slate-800">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="flex-1 px-6 py-4 space-y-2">
        {plan.features.map((f) => (
          <div key={f} className="flex items-start gap-2 text-xs text-slate-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
            {f}
          </div>
        ))}
        {plan.notIncluded.map((f) => (
          <div key={f} className="flex items-start gap-2 text-xs text-slate-400">
            <X className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
            {f}
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100 mt-2">
          <Headphones className="h-3.5 w-3.5 text-slate-400" />
          {plan.support} Support
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <button
          onClick={handleSelect}
          className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${plan.btnClass}`}
        >
          {isTrial ? (
            <><Zap className="h-4 w-4" /> Start Free Trial</>
          ) : isCustom ? (
            <><Globe className="h-4 w-4" /> Contact Sales</>
          ) : (
            <><ArrowRight className="h-4 w-4" /> Choose {plan.name}</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 font-sans">
      {/* Top Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-500/20 rounded-lg">
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <span className="text-lg font-black text-white">TRIWYN POS</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/login" className="text-xs font-bold text-slate-300 hover:text-white transition-colors">
            Sign In
          </a>
          <a
            href="/register?plan=FREE_TRIAL&billing=monthly"
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <Zap className="h-3.5 w-3.5" /> Start Free Trial
          </a>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        {/* Hero */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-bold">
            <Star className="h-3.5 w-3.5" />
            Simple, transparent pricing — no hidden fees
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
            Pricing that scales<br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">with your business</span>
          </h1>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Start free for 14 days. No credit card required. Upgrade when you're ready to grow.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${billing === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-5 py-2 text-sm font-bold rounded-lg transition-all relative ${billing === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Yearly
              <span className="absolute -top-2.5 -right-2 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">-17%</span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {PLANS.map((plan) => (
            <PlanCard key={plan.code} plan={plan} billing={billing} />
          ))}
        </div>

        {/* Feature Comparison Highlights */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
          <h2 className="text-xl font-black text-white text-center">Everything included in all plans</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: Monitor, label: 'Offline POS' },
              { icon: Package, label: 'Inventory Batches' },
              { icon: BarChart3, label: 'Sales Reports' },
              { icon: Shield, label: 'Data Encryption' },
              { icon: Building2, label: 'Multi-User' },
              { icon: Crown, label: 'Role-Based Access' },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl text-center">
                <f.icon className="h-5 w-5 text-emerald-400" />
                <span className="text-xs font-bold text-slate-300">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ / Trust */}
        <div className="text-center space-y-3">
          <p className="text-slate-500 text-sm">
            Questions? <a href="mailto:support@triwyn.com" className="text-emerald-400 font-bold hover:underline">contact@triwyn.com</a>
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> 14-day free trial</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Cancel anytime</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Your data stays yours</span>
          </div>
        </div>
      </div>
    </div>
  );
}
