'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { fetchStudentNotifications, markNotificationAsRead } from '@/services/dashboard';
import type { DashboardNotificationItem } from '@/types/dashboard';

const POLL_INTERVAL_MS = 30000;

export function NotificationBell() {
  const { authenticated } = useAuth();
  const [notifications, setNotifications] = useState<DashboardNotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await fetchStudentNotifications();
      setNotifications(data);
    } catch (err) {
      setError('Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function safeLoadNotifications() {
      if (!mounted || !authenticated) return;
      await loadNotifications();
    }

    if (authenticated) {
      safeLoadNotifications();
      const interval = window.setInterval(safeLoadNotifications, POLL_INTERVAL_MS);
      return () => {
        mounted = false;
        window.clearInterval(interval);
      };
    }

    return () => {
      mounted = false;
    };
  }, [authenticated]);

  useEffect(() => {
    if (!isOpen || !authenticated) {
      return;
    }

    loadNotifications();

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, authenticated]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.status === 'unread').length,
    [notifications],
  );

  const markRead = async (notificationId: number) => {
    try {
      const updatedNotification = await markNotificationAsRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === updatedNotification.id ? updatedNotification : notification,
        ),
      );
    } catch {
      // Ignore notification update errors silently.
    }
  };

  const toggleDropdown = () => {
    setIsOpen((current) => !current);
  };

  const handleNotificationClick = async (notificationId: number) => {
    const notification = notifications.find((item) => item.id === notificationId);
    if (notification?.status === 'unread') {
      await markRead(notificationId);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0h6z"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[22rem] rounded-2xl border border-slate-200 bg-white shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">Latest updates for your learning</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 rounded-full p-1 transition-colors"
              aria-label="Close notifications"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="p-4 text-sm text-slate-600">Loading notifications…</div>
            )}

            {error && (
              <div className="p-4 text-sm text-red-600">{error}</div>
            )}

            {!loading && !error && notifications.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                No new notifications yet.
              </div>
            )}

            {!loading && !error && notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  notification.status === 'unread' ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{notification.title}</p>
                    {notification.message && (
                      <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                    )}
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{new Date(notification.created_at).toLocaleDateString()}</span>
                </div>
                {notification.status === 'unread' && (
                  <span className="mt-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    New
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
