import type { Metadata } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  const theme = savedTheme === 'dark' ? 'dark' : 'light';
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.style.colorScheme = theme;
                } catch (error) {
                  console.warn('Theme initialization failed', error);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="w-full min-h-screen overflow-x-hidden">
        <ThemeProvider>
          <div className="w-full min-h-screen flex flex-col">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
