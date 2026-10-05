import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white p-6 rounded-lg border border-slate-200 text-center space-y-4 shadow-sm">
        <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-2">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Page Not Found (404)</h2>
        <p className="text-xs text-slate-500">
          The POS module or page you are looking for does not exist.
        </p>
        <Link href="/pos">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
            <ArrowLeft className="h-4 w-4" /> Return to POS Checkout
          </Button>
        </Link>
      </div>
    </div>
  );
}
