'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ModernHeader } from '@/components/ModernHeader';
import { useAuth } from '@/hooks/useAuth';
import { fetchCurrentUser } from '@/services/auth';
import { createDiscussion, fetchDiscussions } from '@/services/discussions';
import type { Discussion } from '@/types/discussion';
import type { UserProfile } from '@/types/auth';

const DISCUSSION_CATEGORIES = ['All', 'General', 'Assignments', 'Technical', 'Learning Support', 'Career', 'Exams'];

export default function DiscussionsPage() {
  const { authenticated, initialized } = useAuth();
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
      const discussion = await createDiscussion({
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
      });
      setShowModal(false);
      setTitle('');
      setDescription('');
      setCategory('General');
      router.push(`/discussions/${discussion.id}`);
    } catch (err) {
      console.error(err);
      setError('Unable to create discussion. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)]">
      <ModernHeader
        userName={user?.full_name ?? 'User'}
        userInitials={userInitials}
        userImageUrl={user?.avatar_url}
      />
      <main className="w-full px-6 lg:px-10 py-10">
        <div className="w-full space-y-8">
          <section className="rounded-[32px] border border-slate-200/70 bg-[color:var(--card-bg)] p-6 shadow-[0_20px_70px_-40px_rgba(15,23,42,0.45)] sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-500">Discussion Hub</p>
                <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Ask questions and learn with your cohort</h1>
                <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                  Browse open discussions, search by topic, and jump into conversations without leaving your dashboard flow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:opacity-95"
              >
                Ask Question
              </button>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Search discussions</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, description, or category"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Filter by category</span>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                >
                  {DISCUSSION_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-[28px] border border-slate-200/70 bg-[color:var(--card-bg)] p-8 text-center text-slate-600">
              Loading discussions...
            </div>
          ) : discussions.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-[color:var(--card-bg)] p-10 text-center">
              <h2 className="text-xl font-semibold text-slate-900">No discussions yet</h2>
              <p className="mt-2 text-sm text-slate-600">Start the first conversation for your class or team.</p>
            </div>
          ) : (
            <section className="grid gap-5">
              {discussions.map((discussion) => (
                <button
                  key={discussion.id}
                  type="button"
                  onClick={() => router.push(`/discussions/${discussion.id}`)}
                  className="group rounded-[28px] border border-slate-200/70 bg-[color:var(--card-bg)] p-6 text-left shadow-[0_20px_70px_-40px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_24px_80px_-42px_rgba(59,130,246,0.35)]"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                          {discussion.category}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                            discussion.status === 'open'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {discussion.status}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900 transition group-hover:text-sky-700">
                          {discussion.title}
                        </h2>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{discussion.description}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-500 lg:min-w-[220px] lg:text-right">
                      <p>
                        <span className="font-medium text-slate-700">Author:</span> {discussion.author.full_name || discussion.author.email}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Date:</span> {new Date(discussion.created_at).toLocaleString()}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Replies:</span> {discussion.reply_count}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </section>
          )}
        </div>
      </main>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Ask a new question</h2>
                <p className="mt-1 text-sm text-slate-600">Create a discussion thread inside the student dashboard.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                  placeholder="What do you want help with?"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                  placeholder="Describe your question or issue clearly so others can help."
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                >
                  {DISCUSSION_CATEGORIES.filter((item) => item !== 'All').map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateDiscussion}
                disabled={submitting}
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Posting...' : 'Post Discussion'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
