'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg border border-slate-200 text-center space-y-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Global Application Error</h2>
          <p className="text-xs text-slate-600">
            {error?.message || 'A system-level error occurred.'}
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-emerald-600 text-white rounded font-bold text-xs"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
