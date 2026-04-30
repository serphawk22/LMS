'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lesson, Module, LessonResource, LessonSubtitle } from '@/types/course';

interface CoursePlayerProps {
  lesson: Lesson;
  modules: Module[];
  courseTitle: string;
  onNavigateLesson: (lessonId: number) => void;
}

const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

function getResumeKey(lessonId: number) {
  return `lms-lesson-resume-${lessonId}`;
}

function getNotesKey(lessonId: number) {
  return `lms-lesson-notes-${lessonId}`;
}

function getBookmarkKey(lessonId: number) {
  return `lms-lesson-bookmark-${lessonId}`;
}

export default function CoursePlayer({ lesson, modules, courseTitle, onNavigateLesson }: CoursePlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [resumeTime, setResumeTime] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [notes, setNotes] = useState('');
  const [subtitle, setSubtitle] = useState<LessonSubtitle | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const lastSavedTimeRef = useRef(0);

  const allLessons = useMemo(() => {
    return modules.flatMap((module) => module.lessons || []);
  }, [modules]);

  const currentLessonIndex = useMemo(() => {
    return allLessons.findIndex((item) => item.id === lesson.id);
  }, [allLessons, lesson.id]);

  const totalLessons = allLessons.length;
  const progressPercent = totalLessons > 0 && currentLessonIndex >= 0 ? Math.round(((currentLessonIndex + 1) / totalLessons) * 100) : 0;
  const lessonNumber = currentLessonIndex >= 0 ? currentLessonIndex + 1 : 0;

  const currentLesson = useMemo(() => {
    if (currentLessonIndex < 0) {
      return null;
    }
    return allLessons[currentLessonIndex];
  }, [allLessons, currentLessonIndex]);

  const previousLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < totalLessons - 1 ? allLessons[currentLessonIndex + 1] : null;

  const resourceLinks: LessonResource[] = useMemo(() => {
    return Array.isArray(lesson.content_payload?.resources)
      ? lesson.content_payload.resources
      : [];
  }, [lesson.content_payload]);

  const studyMaterials = useMemo(() => {
    const payload = lesson.content_payload as any;
    const rawMaterials = Array.isArray(payload?.resources)
      ? payload.resources
      : Array.isArray(payload?.materials)
      ? payload.materials
      : [];

    return rawMaterials
      .filter((resource: any) => resource && (resource.url || typeof resource === 'string'))
      .map((resource: any) => {
        if (typeof resource === 'string') {
          return {
            url: resource,
            title: resource.includes('docs.google.com') ? 'Google Drive Material' : 'Study Material',
          };
        }
        return {
          url: resource.url,
          title: resource.title || (resource.url?.includes('docs.google.com') ? 'Google Drive Material' : 'Study Material'),
        };
      });
  }, [lesson.content_payload]);

  const subtitleTracks: LessonSubtitle[] = useMemo(() => {
    return Array.isArray(lesson.content_payload?.subtitles)
      ? lesson.content_payload.subtitles
      : [];
  }, [lesson.content_payload]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedTime = Number(localStorage.getItem(getResumeKey(lesson.id)) ?? 0);
    setResumeTime(savedTime > 1 ? savedTime : 0);

    const savedNotes = localStorage.getItem(getNotesKey(lesson.id)) ?? '';
    setNotes(savedNotes);

    const savedBookmark = localStorage.getItem(getBookmarkKey(lesson.id)) === 'true';
    setBookmarked(savedBookmark);

    if (subtitleTracks.length > 0) {
      setSubtitle(subtitleTracks[0]);
    } else {
      setSubtitle(null);
    }
  }, [lesson.id, subtitleTracks]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      if (resumeTime > 1 && video.duration > resumeTime) {
        video.currentTime = resumeTime;
      }
      video.playbackRate = playbackRate;
    };

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      if (currentTime - lastSavedTimeRef.current >= 5) {
        localStorage.setItem(getResumeKey(lesson.id), String(currentTime));
        lastSavedTimeRef.current = currentTime;
        setResumeTime(currentTime);
      }
    };

    const handleTextTracks = () => {
      if (!video.textTracks) {
        return;
      }
      for (const track of Array.from(video.textTracks)) {
        track.mode = subtitle && track.language === subtitle.language ? 'showing' : 'disabled';
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);

    if (subtitle) {
      handleTextTracks();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [lesson.id, playbackRate, resumeTime, subtitle]);

  const handleToggleBookmark = () => {
    const next = !bookmarked;
    setBookmarked(next);
    localStorage.setItem(getBookmarkKey(lesson.id), String(next));
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      localStorage.setItem(getNotesKey(lesson.id), notes);
    } finally {
      setSavingNotes(false);
    }
  };

  const isVimeoVideo = lesson.content_type === 'vimeo_embed' && (lesson.content_payload as any)?.vimeo_id;
  let vimeoId = isVimeoVideo ? (lesson.content_payload as any)?.vimeo_id : null;
  
  // Extract just the video ID if the full URL was stored instead
  if (vimeoId && vimeoId.includes('vimeo.com/video/')) {
    const match = vimeoId.match(/vimeo\.com\/video\/(\d+)/);
    vimeoId = match ? match[1] : vimeoId;
  }
  
  const vimeoUrl = vimeoId ? `https://player.vimeo.com/video/${vimeoId}` : null;

  const getAbsoluteAssetUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:8000';
    if (url.startsWith('/')) {
      return `${apiBase}${url}`;
    }
    return `${apiBase}/${url}`;
  };

  const lessonMediaUrl = getAbsoluteAssetUrl(
    isVimeoVideo
      ? null
      : lesson.content_type === 'external_link'
      ? (lesson.content_payload as any)?.url
      : lesson.content_payload?.file_url || lesson.content_payload?.video_url,
  );

  const isPdfLesson = lesson.content_type === 'pdf' && lessonMediaUrl;
  const isAudioLesson = lesson.content_type === 'audio' && lessonMediaUrl;
  const isVideoUploadLesson = lesson.content_type === 'video_upload' && lessonMediaUrl;
  const isDocumentLesson = ['ppt', 'doc'].includes(lesson.content_type) && lessonMediaUrl;
  const isExternalLinkLesson = lesson.content_type === 'external_link' && lessonMediaUrl;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{courseTitle}</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{lesson.title}</h1>
            <p className="mt-3 text-sm text-slate-600">Lesson {lessonNumber} of {totalLessons} • {lesson.duration_minutes ? `${lesson.duration_minutes} min` : 'No duration set'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleToggleBookmark}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${bookmarked ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {bookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
              {progressPercent}% complete
            </div>
          </div>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-sky-600" style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            {isVimeoVideo && vimeoUrl ? (
              <div className="aspect-video overflow-hidden rounded-3xl bg-black">
                <iframe
                  src={vimeoUrl}
                  width="100%"
                  height="100%"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={lesson.title}
                  className="h-full w-full"
                />
              </div>
            ) : isPdfLesson ? (
              <div className="rounded-3xl overflow-hidden bg-white">
                <iframe
                  src={lessonMediaUrl}
                  title={lesson.title}
                  className="min-h-[600px] w-full"
                />
                <p className="mt-4 text-sm text-slate-500">
                  If the PDF does not display,{' '}
                  <a href={lessonMediaUrl} target="_blank" rel="noreferrer" className="font-semibold text-sky-600 hover:text-sky-700">
                    open it in a new tab
                  </a>
                  .
                </p>
              </div>
            ) : isAudioLesson ? (
              <div className="rounded-3xl border border-slate-200 bg-black p-6">
                <audio controls src={lessonMediaUrl ?? undefined} className="w-full" />
              </div>
            ) : isDocumentLesson ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-100 px-6 py-20 text-center text-slate-500">
                <p className="mb-3">Open this document in a new tab to view it.</p>
                <a href={lessonMediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Open document
                </a>
              </div>
            ) : isExternalLinkLesson ? (
              <>
                <div className="aspect-video overflow-hidden rounded-3xl bg-black">
                  <iframe
                    src={lessonMediaUrl}
                    width="100%"
                    height="100%"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={lesson.title}
                    className="h-full w-full"
                  />
                </div>
                {/* Show Google Drive link as a button below the player */}
                {lessonMediaUrl && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => window.open(lessonMediaUrl, '_blank')}
                      className="inline-flex items-center rounded-2xl border border-sky-200 bg-sky-50 px-6 py-3 text-base font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                    >
                      Open Google Drive Link in New Tab
                    </button>
                  </div>
                )}
              </>
            ) : lessonMediaUrl ? (
              <div className="aspect-video overflow-hidden rounded-3xl bg-black">
                <video
                  ref={videoRef}
                  controls
                  className="h-full w-full bg-black"
                  preload="metadata"
                  controlsList="nodownload"
                >
                  <source src={lessonMediaUrl} type="video/mp4" />
                  {subtitleTracks.map((track) => (
                    <track
                      key={track.language}
                      src={track.url}
                      kind="subtitles"
                      srcLang={track.language}
                      label={track.label}
                    />
                  ))}
                  Your browser does not support the HTML5 video element.
                </video>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-100 px-6 py-20 text-center text-slate-500">
                No video source available for this lesson.
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4">
              {!isVimeoVideo && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <span>Speed</span>
                    <select
                      value={playbackRate}
                      onChange={(event) => setPlaybackRate(Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    >
                      {speedOptions.map((speed) => (
                        <option key={speed} value={speed}>{speed}x</option>
                      ))}
                    </select>
                  </label>

                  {resumeTime > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = resumeTime;
                          videoRef.current.play();
                        }
                      }}
                      className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      Resume at {formatDuration(resumeTime)}
                    </button>
                  ) : null}

                  {subtitleTracks.length > 0 ? (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <span>Subtitles</span>
                      <select
                        value={subtitle?.language ?? ''}
                        onChange={(event) => {
                          const next = subtitleTracks.find((track) => track.language === event.target.value) ?? null;
                          setSubtitle(next);
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      >
                        <option value="">Off</option>
                        {subtitleTracks.map((track) => (
                          <option key={track.language} value={track.language}>{track.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              )}
              {isVimeoVideo && (
                <p className="text-xs text-slate-500">Vimeo player controls available in the video above</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Lesson details</h2>
                <p className="mt-2 text-sm text-slate-600">Track progress, review the lesson outline, and access resources.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">{lesson.content_type.replace('_', ' ')}</span>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
              {lesson.content ? <p>{lesson.content}</p> : <p>No additional lesson text is available.</p>}
              {lesson.is_locked ? <p className="text-rose-600">This lesson is locked until prerequisites are complete.</p> : null}
              {lesson.drip_enabled ? <p>Drip release is enabled for this lesson.</p> : null}
            </div>

            {resourceLinks.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-900">Download resources</h3>
                <ul className="mt-3 space-y-3">
                  {resourceLinks.map((resource) => (
                    <li key={resource.id}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <span>{resource.title}</span>
                        <span className="text-slate-500">Download</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {studyMaterials.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-900">Study materials</h3>
                <ul className="mt-3 space-y-3">
                  {studyMaterials.map((material: any, index: number) => (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => window.open(material.url, '_blank')}
                        className="w-full inline-flex items-center justify-between rounded-2xl border border-slate-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 font-medium"
                      >
                        <span>{material.title}</span>
                        <span className="text-sky-600">Open in new tab</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
                <p className="mt-2 text-sm text-slate-600">Write quick notes for this lesson and save them to your browser.</p>
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={8}
              className="mt-4 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">Your notes are saved locally to this browser.</p>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {savingNotes ? 'Saving…' : 'Save notes'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40">
            <h2 className="text-lg font-semibold text-slate-900">Navigation</h2>
            <p className="mt-2 text-sm text-slate-600">Jump quickly to lessons around this topic.</p>

            <div className="mt-6 space-y-4">
              <button
                type="button"
                onClick={() => previousLesson && onNavigateLesson(previousLesson.id)}
                disabled={!previousLesson}
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous lesson
              </button>
              <button
                type="button"
                onClick={() => nextLesson && onNavigateLesson(nextLesson.id)}
                disabled={!nextLesson}
                className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Next lesson
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-base font-semibold text-slate-900">Lesson progress</h3>
            <div className="mt-4 rounded-full bg-slate-200 p-1">
              <div className="h-3 rounded-full bg-sky-600" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="mt-3 text-sm text-slate-600">You are on lesson {lessonNumber} of {totalLessons}. Keep going to finish the course.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
