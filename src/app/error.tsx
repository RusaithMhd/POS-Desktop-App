'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router Boundary Caught Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <Card className="max-w-md w-full border-slate-200 bg-white shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 mb-2">
            <AlertCircle className="h-6 w-6" />
          </div>
          <CardTitle className="text-base font-bold text-slate-900">
            Application Error Handled
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-xs text-slate-600">
            {error?.message || 'An unexpected application error occurred. Your local SQLite sales data remains safe and secure.'}
          </p>

          <div className="flex gap-2 justify-center pt-2">
            <Button onClick={() => reset()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
              <RefreshCw className="h-4 w-4" /> Retry Action
            </Button>
            <Button onClick={() => window.location.href = '/pos'} variant="outline" className="gap-2">
              <Home className="h-4 w-4" /> Go to POS
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
