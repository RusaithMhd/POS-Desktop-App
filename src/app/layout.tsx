import type { Metadata } from "next";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";

export const metadata: Metadata = {
  title: "TRIWYN POS — Offline-First Commercial POS",
  description: "Commercial-grade offline-first Point of Sale (POS) system engineered for high reliability and zero-latency cashier workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
