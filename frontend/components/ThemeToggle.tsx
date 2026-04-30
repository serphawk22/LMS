'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-[var(--border-color)] bg-[var(--card-color)] p-2 shadow-sm shadow-black/10 transition-all duration-300">
      <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[var(--muted-color)]">Theme</span>
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={toggleTheme}
        className="theme-switch relative inline-flex h-10 w-20 shrink-0 cursor-pointer items-center rounded-full border border-[var(--border-color)] bg-[var(--surface-strong)] p-1 text-left transition-all duration-300 hover:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
      >
        <span
          className={`theme-thumb absolute left-1 top-1 inline-block h-8 w-8 rounded-full transition-transform duration-300 ${theme === 'dark' ? 'translate-x-10 bg-[var(--secondary-color)]' : 'bg-[var(--primary-color)]'}`}
        >
          {mounted ? (
            theme === 'dark' ? (
              <svg className="h-5 w-5 text-white mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-yellow-400 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 6.95l-1.41-1.41M6.34 6.34L4.93 4.93m12.02 0l-1.41 1.41M6.34 17.66l-1.41 1.41" />
              </svg>
            )
          ) : null}
        </span>
      </button>
    </div>
  );
}
