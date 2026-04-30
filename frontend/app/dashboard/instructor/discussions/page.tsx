'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { fetchCurrentUser } from '@/services/auth';
import { createDiscussion, fetchDiscussions, createDiscussionReply } from '@/services/discussions';
import type { Discussion } from '@/types/discussion';
import type { UserProfile } from '@/types/auth';

const DISCUSSION_CATEGORIES = ['All', 'General', 'Assignments', 'Technical', 'Learning Support', 'Career', 'Exams'];

export default function InstructorDiscussionsPage() {
  const { authenticated, initialized, role } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    if (initialized && !authenticated) {
      router.push('/login');
    }
  }, [authenticated, initialized, router]);

  useEffect(() => {
    if (!initialized || !authenticated) {
      return;
    }

    async function loadPage() {
      setLoading(true);
      setError('');
      try {
        const [profile, discussionList] = await Promise.all([
          fetchCurrentUser(),
          fetchDiscussions(search.trim(), selectedCategory),
        ]);
        setUser(profile);
        setDiscussions(discussionList);
      } catch (err) {
        console.error(err);
        setError('Unable to load discussions right now.');
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [authenticated, initialized, search, selectedCategory]);

  const userInitials = useMemo(() => {
    if (!user?.full_name) {
      return 'U';
    }
    return user.full_name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [user]);

  const handleCreateDiscussion = async () => {
    if (!title.trim() || !description.trim() || !category.trim()) {
      setError('Title, description, and category are required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await createDiscussion({ title: title.trim(), description: description.trim(), category });
      setShowModal(false);
      setTitle('');
      setDescription('');
      setCategory('General');
      
      const discussionList = await fetchDiscussions(search.trim(), selectedCategory);
      setDiscussions(discussionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create discussion.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (discussionId: number) => {
    if (!replyMessage.trim()) {
      setError('Reply message is required.');
      return;
    }

    setSubmittingReply(true);
    setError('');

    try {
      await createDiscussionReply(discussionId, { message: replyMessage.trim() });
      setReplyingTo(null);
      setReplyMessage('');
      
      const discussionList = await fetchDiscussions(search.trim(), selectedCategory);
      setDiscussions(discussionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const filteredDiscussions = useMemo(() => {
    if (!search.trim()) {
      return discussions;
    }
    const searchLower = search.toLowerCase();
    return discussions.filter(
      (d) =>
        d.title.toLowerCase().includes(searchLower) ||
        d.description.toLowerCase().includes(searchLower)
    );
  }, [discussions, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[var(--muted-color)]">Loading discussions...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-[var(--text-color)]">Discussions</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-[var(--primary-color)] hover:opacity-90 text-white font-medium py-2 px-6 rounded-md transition"
          >
            + New Discussion
          </button>
        </div>
        <p className="text-[var(--muted-color)]">
          Engage with students, answer questions, and facilitate discussions across your courses.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search discussions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-[var(--border-color)] px-4 py-2 text-sm focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-md border border-[var(--border-color)] px-4 py-2 text-sm focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20"
        >
          {DISCUSSION_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Discussions List */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">{error}</div>
      )}

      {filteredDiscussions.length === 0 ? (
        <div className="text-center py-12 bg-[var(--card-color)] rounded-lg border border-[var(--border-color)]">
          <p className="text-[var(--muted-color)]">No discussions found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDiscussions.map((discussion) => (
            <div
              key={discussion.id}
              className="p-6 bg-[var(--card-color)] rounded-lg border border-[var(--border-color)] hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--primary-color)]/10 text-[var(--primary-color)]">
                      {discussion.category}
                    </span>
                    <span className="text-xs text-[var(--muted-color)]">
                      {new Date(discussion.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--text-color)] mb-2">
                    {discussion.title}
                  </h3>
                  <p className="text-sm text-[var(--muted-color)] line-clamp-2">
                    {discussion.description}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-sm text-[var(--muted-color)]">
                    <span>👤 {discussion.author?.full_name || discussion.author?.email || 'Unknown'}</span>
                    <span>💬 {discussion.reply_count || 0} replies</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setReplyingTo(discussion.id)}
                    className="px-4 py-2 text-sm font-medium text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 rounded-md transition"
                  >
                    💬 Reply
                  </button>
                </div>
                {replyingTo === discussion.id && (
                  <div className="mt-4 flex flex-col gap-2">
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Write your reply..."
                      className="w-full rounded-md border border-[var(--border-color)] px-4 py-2 text-sm focus:border-[var(--primary-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReply(discussion.id)}
                        disabled={submittingReply}
                        className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary-color)] hover:opacity-90 rounded-md transition disabled:opacity-50"
                      >
                        {submittingReply ? 'Posting...' : 'Post Reply'}
                      </button>
                      <button
                        onClick={() => { setReplyingTo(null); setReplyMessage(''); }}
                        className="px-4 py-2 text-sm font-medium text-[var(--muted-color)] hover:bg-slate-100 rounded-md transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Discussion Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-[var(--card-color)] rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-[var(--text-color)] mb-4">Create New Discussion</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm focus:border-[var(--primary-color)] focus:outline-none"
                  placeholder="Discussion title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm focus:border-[var(--primary-color)] focus:outline-none"
                >
                  {DISCUSSION_CATEGORIES.filter(c => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm focus:border-[var(--primary-color)] focus:outline-none"
                  placeholder="What would you like to discuss?"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setError('');
                }}
                className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-md text-sm font-medium text-[var(--text-color)] hover:bg-[var(--surface-strong)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDiscussion}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-[var(--primary-color)] text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}