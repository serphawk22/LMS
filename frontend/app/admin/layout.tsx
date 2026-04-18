'use client';

import { AdminHeader } from '@/components/AdminHeader';

/**
 * Admin layout: replaces the root Navbar with the dedicated AdminHeader.
 * 
 * Hides the inherited root Navbar using inline CSS (instant, no FOUC).
 * The root layout.tsx is NOT modified.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div id="admin-layout">
      {/*
       * Critical: use a <style> tag to INSTANTLY hide the root Navbar 
       * on admin routes. This is faster than useEffect because CSS is 
       * applied before paint, preventing any flash of the wrong navbar.
       *
       * The root layout renders: <body> → <header> (Navbar) → <div> (content)
       * The Navbar component renders a <header> with class "border-b border-slate-200".
       * We target it by its unique styling classes to avoid affecting AdminHeader.
       */}
      <style>{`
        header.border-b.border-slate-200 {
          display: none !important;
        }
      `}</style>
      <AdminHeader />
      <div className="min-h-screen bg-slate-50">{children}</div>
    </div>
  );
}
