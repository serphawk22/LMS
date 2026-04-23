'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ModernHeader } from '@/components/ModernHeader';
import { useAuth } from '@/hooks/useAuth';
import { fetchCurrentUser } from '@/services/auth';
import {
  createDiscussionReply,
  deleteDiscussionReply,
  fetchDiscussion,
  updateDiscussionReply,
  updateDiscussionStatus,
  markBestAnswer,
} from '@/services/discussions';
import type { DiscussionDetail, DiscussionReply } from '@/types/discussion';
import type { UserProfile } from '@/types/auth';

export default function DiscussionDetailPage() {
  const { authenticated, initialized, role } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const discussionId = Number(params.id);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [discussion, setDiscussion] = useState<DiscussionDetail | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialized && !authenticated) {
      router.push('/login');
    }
  }, [authenticated, initialized, router]);

  useEffect(() => {
    if (!initialized || !authenticated || !discussionId) {
      return;
    }

    async function loadDiscussion() {
      setLoading(true);
      setError('');
      try {
        const [profile, result] = await Promise.all([fetchCurrentUser(), fetchDiscussion(discussionId)]);
        setUser(profile);
        setDiscussion(result);
      } catch (err) {
        console.error(err);
        setError('Unable to load this discussion.');
      } finally {
        setLoading(false);
      }
    }

    loadDiscussion();
  }, [authenticated, initialized, discussionId]);

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

  const refreshDiscussion = async () => {
    if (!discussionId) {
      return;
    }
    const result = await fetchDiscussion(discussionId);
    setDiscussion(result);
  };

  const handleReplySubmit = async () => {
    if (!discussion || !replyMessage.trim()) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const updated = await createDiscussionReply(discussion.id, { message: replyMessage.trim() });
      setDiscussion(updated);
      setReplyMessage('');
    } catch (err) {
      console.error(err);
      setError('Unable to add reply right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyUpdate = async (reply: DiscussionReply) => {
    if (!editingMessage.trim()) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const updated = await updateDiscussionReply(reply.id, { message: editingMessage.trim() });
      setDiscussion(updated);
      setEditingReplyId(null);
      setEditingMessage('');
    } catch (err) {
      console.error(err);
      setError('Unable to update reply right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyDelete = async (reply: DiscussionReply) => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await deleteDiscussionReply(reply.id);
      setDiscussion(updated);
    } catch (err) {
      console.error(err);
      setError('Unable to delete reply right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async () => {
    if (!discussion) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const updated = await updateDiscussionStatus(discussion.id, discussion.status === 'open' ? 'closed' : 'open');
      setDiscussion(updated);
    } catch (err) {
      console.error(err);
      setError('Unable to update discussion status right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkBestAnswer = async (reply: DiscussionReply) => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await markBestAnswer(reply.id, !reply.is_best_answer);
      setDiscussion(updated);
    } catch (err) {
      console.error(err);
      setError('Unable to mark best answer right now.');
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
      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full space-y-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/discussions')}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Discussions
            </button>
            <button
              type="button"
              onClick={refreshDiscussion}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {loading || !discussion ? (
            <div className="rounded-[28px] border border-slate-200/70 bg-[color:var(--card-bg)] p-8 text-center text-slate-600">
              Loading discussion...
            </div>
          ) : (
            <>
              <section className="rounded-[32px] border border-slate-200/70 bg-[color:var(--card-bg)] p-6 shadow-[0_20px_70px_-40px_rgba(15,23,42,0.45)] sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
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
                      <h1 className="text-3xl font-bold text-slate-900">{discussion.title}</h1>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600 sm:text-base">
                        {discussion.description}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-3">
                      <p>
                        <span className="font-medium text-slate-700">Author:</span> {discussion.author.full_name || discussion.author.email}
                        {discussion.author.role === 'instructor' && (
                          <span className="ml-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-amber-700">
                            Instructor
                          </span>
                        )}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Date:</span> {new Date(discussion.created_at).toLocaleString()}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Replies:</span> {discussion.reply_count}
                      </p>
                    </div>
                  </div>

                  {discussion.can_manage_status ? (
                    <button
                      type="button"
                      onClick={handleStatusChange}
                      disabled={submitting}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Mark as {discussion.status === 'open' ? 'Closed' : 'Open'}
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[32px] border border-slate-200/70 bg-[color:var(--card-bg)] p-6 shadow-[0_20px_70px_-40px_rgba(15,23,42,0.45)] sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Replies</h2>
                    <p className="mt-1 text-sm text-slate-600">Join the conversation with thoughtful, relevant answers.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {discussion.replies.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                      No replies yet. Be the first person to respond.
                    </div>
                  ) : (
                    discussion.replies.map((reply) => (
                      <article key={reply.id} className={`rounded-[24px] border shadow-sm p-5 ${reply.is_best_answer ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}>
                        {reply.is_best_answer && (
                          <div className="mb-3 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-green-700">
                            ✓ Best Answer
                          </div>
                        )}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              {reply.author.full_name || reply.author.email}
                              {reply.author.role === 'instructor' && (
                                <span className="ml-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-amber-700">
                                  Instructor
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-slate-500">{new Date(reply.created_at).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {reply.can_mark_best_answer ? (
                              <button
                                type="button"
                                onClick={() => handleMarkBestAnswer(reply)}
                                disabled={submitting}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  reply.is_best_answer
                                    ? 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                                    : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {reply.is_best_answer ? '✓ Best Answer' : 'Mark Best Answer'}
                              </button>
                            ) : null}
                            {reply.can_edit ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReplyId(reply.id);
                                  setEditingMessage(reply.message);
                                }}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Edit
                              </button>
                            ) : null}
                            {reply.can_delete ? (
                              <button
                                type="button"
                                onClick={() => handleReplyDelete(reply)}
                                className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {editingReplyId === reply.id ? (
                          <div className="mt-4 space-y-3">
                            <textarea
                              value={editingMessage}
                              onChange={(event) => setEditingMessage(event.target.value)}
                              rows={4}
                              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                            />
                            <div className="flex justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReplyId(null);
                                  setEditingMessage('');
                                }}
                                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReplyUpdate(reply)}
                                disabled={submitting}
                                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{reply.message}</p>
                        )}
                      </article>
                    ))
                  )}
                </div>

                <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-lg font-semibold text-slate-900">Add reply</h3>
                  {discussion.status === 'closed' ? (
                    <p className="mt-3 text-sm text-slate-500">This discussion is closed, so new replies are disabled.</p>
                  ) : (
                    <>
                      <textarea
                        value={replyMessage}
                        onChange={(event) => setReplyMessage(event.target.value)}
                        rows={5}
                        className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                        placeholder="Share your answer or ask a follow-up question"
                      />
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleReplySubmit}
                          disabled={submitting || !replyMessage.trim()}
                          className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submitting ? 'Posting...' : 'Post Reply'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
