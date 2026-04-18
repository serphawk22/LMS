import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LMS Platform - Learn, Teach, and Grow',
  description: 'A modern, professional Learning Management System for organizations, instructors, and learners.',
  keywords: 'LMS, learning, education, courses, training, management',
};

export const viewport = 'width=device-width, initial-scale=1, maximum-scale=5';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#0ea5e9" />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-900">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
