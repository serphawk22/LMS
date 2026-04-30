'use client';

import { useEffect, useState } from 'react';
import { createAnnouncement, fetchAnnouncements } from '@/services/announcements';
import type { Announcement } from '@/services/announcements';

interface AnnouncementInput {
  title: string;
  content: string;
  course_id?: number | null;
}

export function InstructorAnnouncementsPanel({ courses }: { courses?: Array<{ id: number; title: string }> }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState<AnnouncementInput>({
    title: '',
    content: '',
    course_id: null,
  });
  const [submitting, setSubmitting] = useState(false);

  // Load announcements
  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    try {
      setLoading(true);
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
      const message = (err as any)?.response?.data?.detail || 'Failed to load announcements';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and message are required');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const payload = {
        title: formData.title,
        content: formData.content,
        course_id: formData.course_id,
        published: true,
        priority: 'normal',
        target_audience: 'all',
      };

      await createAnnouncement(payload);

      setSuccess('Announcement created successfully!');
      setFormData({ title: '', content: '', course_id: null });

      // Reload announcements
      await loadAnnouncements();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const message = (err as any)?.response?.data?.detail || 'Failed to create announcement';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Create Announcement Form */}
      <div className="modern-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Create Announcement</h3>
            <p className="text-sm text-slate-600">Share updates with your students</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Quiz Results Posted"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
          </div>

          {courses && courses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Course (optional)</label>
              <select
                value={formData.course_id ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  course_id: e.target.value ? Number(e.target.value) : null,
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
              >
                <option value="">All courses</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Message Textarea */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter your announcement message..."
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={submitting}
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {submitting ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </div>

      {/* Announcements List */}
      <div className="modern-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Your Announcements</h3>
            <p className="text-sm text-slate-600">{announcements.length} total</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-600">No announcements yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{announcement.title}</h4>
                    <p className="text-slate-700 text-sm mt-1 line-clamp-2">{announcement.content}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs text-slate-500">
                        {announcement.published_at
                          ? new Date(announcement.published_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : new Date(announcement.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                      </span>
                      {announcement.published && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Published
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}