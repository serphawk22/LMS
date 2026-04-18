'use client';

import { useEffect, useState } from 'react';
import { fetchAnnouncements } from '@/services/announcements';
import type { Announcement } from '@/services/announcements';

export function AnnouncementsSection() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAnnouncements() {
      try {
        const data = await fetchAnnouncements();
        console.log('Fetched announcements', data);
        const sorted = [...data].sort((a, b) => {
          const dateA = new Date(a.published_at ?? a.created_at).getTime();
          const dateB = new Date(b.published_at ?? b.created_at).getTime();
          return dateB - dateA;
        });
        setAnnouncements(sorted);
        setError('');
      } catch (err) {
        const message = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
          || (err as { message?: string }).message
          || 'Failed to load announcements';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadAnnouncements();
  }, []);

  if (loading) {
    return (
      <div className="modern-card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Announcements</h3>
        <p className="text-sm text-slate-600 mb-4">Loading announcements...</p>
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="h-3 bg-slate-200 rounded w-full mb-2"></div>
          <div className="h-3 bg-slate-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modern-card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Announcements</h3>
        <div className="text-center text-slate-500">
          <p>Failed to load announcements</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="modern-card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Announcements</h3>
        <div className="text-center text-slate-500">
          <p>No announcements yet</p>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="modern-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Announcements</h3>
          <p className="text-sm text-slate-600">Stay updated with the latest news</p>
        </div>
      </div>

      <div className="space-y-4">
        {announcements.map((announcement) => (
          <div key={announcement.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-slate-900">{announcement.title}</h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(announcement.priority)}`}>
                    {announcement.priority}
                  </span>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed">{announcement.content}</p>
                <div className="text-xs text-slate-500 mt-3 space-y-1">
                  {announcement.created_by && (
                    <p>
                      Posted by {announcement.created_by.full_name || announcement.created_by.email}
                    </p>
                  )}
                  <p>
                    {announcement.published_at
                      ? new Date(announcement.published_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : new Date(announcement.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}