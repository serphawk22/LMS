'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchAdminDailyLearningVideos } from '@/services/dashboard';
import type { DailyLearningVideo } from '@/types/dashboard';

export default function AdminDailyVideosPage() {
  const [videos, setVideos] = useState<DailyLearningVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadVideos() {
      try {
        const data = await fetchAdminDailyLearningVideos();
        setVideos(data);
      } catch (err) {
        setError('Unable to load daily video submissions.');
      } finally {
        setLoading(false);
      }
    }

    loadVideos();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Admin dashboard</p>
              <h1 className="mt-3 text-3xl font-semibold">Daily learning videos</h1>
              <p className="mt-2 text-slate-600">Review video files and Vimeo submissions shared by students.</p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Back to admin dashboard
            </Link>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Loading videos…</div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-700">{error}</div>
        ) : videos.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-slate-600 shadow-sm shadow-slate-200/40">
            No daily learning videos have been uploaded yet.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {videos.map((video) => (
              <div key={video.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{video.title}</p>
                    <p className="text-sm text-slate-500">Uploaded by {video.user_name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-400">{video.video_type === 'vimeo' ? 'Vimeo link' : 'Uploaded file'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">{new Date(video.uploaded_at).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-400">{new Date(video.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-600">{video.description}</p>

                <div className="mt-5 overflow-hidden rounded-3xl bg-slate-950">
                  {video.video_type === 'vimeo' ? (
                    <iframe
                      src={video.video_url}
                      width="100%"
                      height="260"
                      allow="autoplay; fullscreen"
                      className="aspect-video w-full"
                      title={`Vimeo video submitted by ${video.user_name}`}
                    />
                  ) : (
                    <video controls className="h-64 w-full bg-black">
                      <source src={video.video_url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
