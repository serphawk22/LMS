'use client';

import { useEffect, useState } from 'react';
import { createAdminComment, fetchAdminComments } from '@/services/dashboard';
import type { AdminComment } from '@/types/dashboard';

interface AdminCommentSectionProps {
  commentType: string;
  relatedId: number;
  title?: string;
  compact?: boolean;
  existingComment?: AdminComment | null;
  onCommentAdd?: (commentType: string, relatedId: number, content: string) => Promise<void>;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

export default function AdminCommentSection({
  commentType,
  relatedId,
  title,
  compact = false,
  existingComment = null,
  onCommentAdd
}: AdminCommentSectionProps) {
  const [comments, setComments] = useState<AdminComment[]>(existingComment ? [existingComment] : []);
  const [loading, setLoading] = useState(!existingComment);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (existingComment) {
      setComments([existingComment]);
      setLoading(false);
      return;
    }

    async function loadComments() {
      try {
        const data = await fetchAdminComments(commentType, relatedId);
        setComments(data);
      } catch (err: any) {
        setError(err?.message || 'Unable to load comments.');
      } finally {
        setLoading(false);
      }
    }

    loadComments();
  }, [commentType, relatedId, existingComment]);

  async function handlePostComment() {
    if (!newComment.trim()) {
      setPostError('Comment cannot be empty.');
      return;
    }

    setPosting(true);
    setPostError('');

    try {
      if (onCommentAdd) {
        await onCommentAdd(commentType, relatedId, newComment);
        // Refresh comments if we have an external handler
        if (!existingComment) {
          const data = await fetchAdminComments(commentType, relatedId);
          setComments(data);
        } else {
          // For existing comment case, we need to reload
          const data = await fetchAdminComments(commentType, relatedId);
          setComments(data);
        }
      } else {
        const posted = await createAdminComment(commentType, relatedId, newComment);
        setComments([posted, ...comments]);
      }
      setNewComment('');
      setShowForm(false);
    } catch (err: any) {
      setPostError(err?.message || 'Unable to post comment.');
    } finally {
      setPosting(false);
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {comments.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-700"
          >
            {showForm ? 'Cancel' : 'Edit Comment'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center rounded-full bg-slate-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            Add Comment
          </button>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <h4 className="mb-4 text-lg font-semibold text-slate-900">
                {comments.length > 0 ? 'Edit Comment' : 'Add Comment'}
              </h4>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Enter your comment..."
                maxLength={2000}
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
              {postError && <p className="mt-2 text-xs text-rose-600">{postError}</p>}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">{newComment.length}/2000</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setNewComment('');
                      setPostError('');
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePostComment}
                    disabled={posting || !newComment.trim()}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {posting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      {title && <h3 className="mb-4 text-lg font-semibold text-slate-900">Admin Comments: {title}</h3>}

      {/* Post Comment Section */}
      <div className="mb-6 space-y-2 rounded-lg bg-slate-50 p-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Leave an admin comment..."
          maxLength={2000}
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
        />
        {postError && <p className="text-xs text-rose-600">{postError}</p>}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{newComment.length}/2000</p>
          <button
            onClick={handlePostComment}
            disabled={posting || !newComment.trim()}
            className="inline-block rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {posting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading comments…</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-500">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{comment.admin_name}</p>
                <p className="text-xs text-slate-500">{formatDate(comment.created_at)}</p>
              </div>
              <p className="text-sm text-slate-700">{comment.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
