'use client';

import { useTheme } from '@/components/ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

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
          className={`theme-thumb absolute left-1 top-1 inline-block h-8 w-8 rounded-full bg-[var(--primary-color)] transition-transform duration-300 ${theme === 'dark' ? 'translate-x-10 bg-[var(--secondary-color)]' : ''}`}
        />
      </button>
    </div>
  );
}
