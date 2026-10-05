import React from 'react';
import { PosAccessGuard } from '@/components/licensing/PosAccessGuard';

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <PosAccessGuard>{children}</PosAccessGuard>;
}
