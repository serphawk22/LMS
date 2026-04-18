'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser } from '@/services/auth';
import { fetchDashboardOverview, fetchWeeklyStats, fetchDailyLearningVideos } from '@/services/dashboard';
import { fetchQuizAttempts, fetchQuizzes } from '@/services/quiz';
import { fetchStudentAssignments } from '@/services/assignments';
import { useAuth } from '@/hooks/useAuth';
import { clearAuthToken, getUserProfile } from '@/lib/auth';
import { ModernHeader } from '@/components/ModernHeader';
import { CourseCard } from '@/components/CourseCard';
import { AssignmentCard } from '@/components/AssignmentCard';
import { AnnouncementsSection } from '@/components/AnnouncementsSection';
import type { Course } from '@/types/course';
import type { DashboardOverview, DashboardCourseItem, DailyLearningVideo, WeeklyStats } from '@/types/dashboard';
import type { Quiz } from '@/types/quiz';
import type { QuizAttemptRead } from '@/types/quiz';
import type { UserProfile } from '@/types/auth';
import type { Assignment } from '@/types/assignment';

export default function DashboardPage() {
  const { authenticated, initialized, role, userId } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [dashboardOverview, setDashboardOverview] = useState<DashboardOverview | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [dailyVideos, setDailyVideos] = useState<DailyLearningVideo[]>([]);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [recordingError, setRecordingError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptRead[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const courseCount = useMemo(
    () => dashboardOverview?.enrolled_courses?.length ?? 0,
    [dashboardOverview],
  );
  const welcomeName = user?.full_name ? user.full_name.split(' ')[0] : 'Learner';
  const userInitials = user?.full_name
    ? user.full_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
    : 'U';

  useEffect(() => {
    if (initialized && !authenticated) {
      router.push('/login');
      return;
    }

    if (!initialized) {
      return;
    }

    async function loadDashboard() {
      try {
        // Try to load user from localStorage cache first for instant UI update
        const cachedUser = getUserProfile();
        if (cachedUser) {
          setUser(cachedUser);
        }

        // Load all data in parallel - failures in one don't block others
        const [userResult, dashboardResult, weeklyResult, quizResult, attemptsResult, assignmentResult, dailyVideosResult] = await Promise.allSettled([
          fetchCurrentUser(),
          fetchDashboardOverview(),
          fetchWeeklyStats(),
          fetchQuizzes(),
          fetchQuizAttempts(5, 0),
          fetchStudentAssignments(),
          fetchDailyLearningVideos(),
        ]);

        // Check if critical data loaded
        let hasCriticalError = false;

        if (userResult.status === 'fulfilled') {
          setUser(userResult.value);
        } else {
          const status = (userResult.reason as { response?: { status?: number } })?.response?.status;
          if (status === 401 || status === 403) {
            clearAuthToken();
            router.push('/login');
            return;
          }
          hasCriticalError = true;
        }

        if (dashboardResult.status === 'fulfilled') {
          setDashboardOverview(dashboardResult.value);
        } else {
          hasCriticalError = true;
        }

        if (weeklyResult.status === 'fulfilled') {
          setWeeklyStats(weeklyResult.value);
        }

        // Secondary data - failures here don't matter
        if (quizResult.status === 'fulfilled') {
          setQuizzes(quizResult.value);
        }
        if (attemptsResult.status === 'fulfilled') {
          setQuizAttempts(attemptsResult.value);
        }
        if (assignmentResult.status === 'fulfilled') {
          setAssignments(assignmentResult.value);
        }

        if (dailyVideosResult.status === 'fulfilled') {
          setDailyVideos(dailyVideosResult.value);
        }

        // Only show error if critical primary data failed
        if (hasCriticalError) {
          setError('Unable to load dashboard data. Please refresh the page.');
        } else {
          setError('');
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          clearAuthToken();
          router.push('/login');
          return;
        }
        setError('Unable to load dashboard. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [authenticated, initialized, router]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (screenVideoRef.current) {
        screenVideoRef.current.pause();
        screenVideoRef.current.srcObject = null;
        screenVideoRef.current.remove();
        screenVideoRef.current = null;
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.pause();
        cameraVideoRef.current.srcObject = null;
        cameraVideoRef.current.remove();
        cameraVideoRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current = null;
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') {
      return '';
    }
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      return 'video/webm;codecs=vp9';
    }
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      return 'video/webm;codecs=vp8';
    }
    if (MediaRecorder.isTypeSupported('video/webm')) {
      return 'video/webm';
    }
    return '';
  };

  const downloadRecording = (chunks: BlobPart[]) => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'class-recording.webm';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    recordingChunksRef.current = [];
  };

  const stopDrawLoop = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const cleanupHiddenMedia = () => {
    if (screenVideoRef.current) {
      screenVideoRef.current.pause();
      screenVideoRef.current.srcObject = null;
      screenVideoRef.current.remove();
      screenVideoRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.pause();
      cameraVideoRef.current.srcObject = null;
      cameraVideoRef.current.remove();
      cameraVideoRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    stopDrawLoop();
  };

  const createHiddenVideo = (stream: MediaStream): HTMLVideoElement => {
    const video = document.createElement('video');
    video.style.position = 'fixed';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    document.body.appendChild(video);
    return video;
  };

  const drawCanvasFrame = (canvas: HTMLCanvasElement, screenVideo: HTMLVideoElement, cameraVideo: HTMLVideoElement) => {
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const draw = () => {
      // Draw screen stream at full canvas size
      if (screenVideo.readyState === screenVideo.HAVE_ENOUGH_DATA) {
        canvas.width = screenVideo.videoWidth;
        canvas.height = screenVideo.videoHeight;
        context.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
      }

      // Draw camera overlay at bottom-right (180px width, aspect ratio maintained)
      if (cameraVideo.readyState === cameraVideo.HAVE_ENOUGH_DATA && canvas.width > 0 && canvas.height > 0) {
        const cameraWidth = 180;
        const cameraHeight = Math.round((cameraVideo.videoHeight / cameraVideo.videoWidth) * cameraWidth);
        const padding = 16;
        const x = canvas.width - cameraWidth - padding;
        const y = canvas.height - cameraHeight - padding;

        // Draw background for camera (slight transparency)
        context.save();
        context.fillStyle = 'rgba(0, 0, 0, 0.35)';
        context.fillRect(x - 8, y - 8, cameraWidth + 16, cameraHeight + 16);
        context.restore();

        // Draw camera video on canvas
        context.drawImage(cameraVideo, x, y, cameraWidth, cameraHeight);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    stopDrawLoop();
    animationFrameRef.current = requestAnimationFrame(draw);
  };

  const stopCurrentRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    setRecordingError('');
    setRecordingStatus('Preparing recorder...');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !navigator.mediaDevices.getUserMedia) {
      setRecordingError('Media devices are not available in this browser.');
      setRecordingStatus('');
      return;
    }

    cleanupHiddenMedia();

    try {
      let screenStream: MediaStream;
      let cameraStream: MediaStream;

      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } catch (err) {
        if ((err as DOMException).name === 'NotAllowedError') {
          setRecordingError('Screen share permission denied. Please allow screen sharing and try again.');
        } else {
          setRecordingError(`Failed to get screen share: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        setRecordingStatus('');
        return;
      }

      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        screenStream.getTracks().forEach((track) => track.stop());
        if ((err as DOMException).name === 'NotAllowedError') {
          setRecordingError('Camera/microphone permission denied. Please allow access and try again.');
        } else {
          setRecordingError(`Failed to get camera: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        setRecordingStatus('');
        return;
      }

      screenStreamRef.current = screenStream;
      cameraStreamRef.current = cameraStream;
      recordingChunksRef.current = [];

      const screenVideo = createHiddenVideo(screenStream);
      screenVideoRef.current = screenVideo;
      const cameraVideo = createHiddenVideo(cameraStream);
      cameraVideoRef.current = cameraVideo;

      try {
        await Promise.all([screenVideo.play(), cameraVideo.play()]);
      } catch (err) {
        setRecordingError(`Failed to start video playback: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setRecordingStatus('');
        cleanupHiddenMedia();
        return;
      }

      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;
      drawCanvasFrame(canvas, screenVideo, cameraVideo);

      const canvasStream = canvas.captureStream(30);
      const outputStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...screenStream.getAudioTracks(),
        ...cameraStream.getAudioTracks(),
      ]);

      mediaStreamRef.current = outputStream;
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        throw new Error('Browser does not support video/webm recording.');
      }

      const recorder = new MediaRecorder(outputStream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        setRecordingError(`Recording failed: ${event.error?.message ?? 'Unknown error'}`);
      };

      recorder.onstop = () => {
        setIsRecording(false);
        setRecordingStatus('Download ready. File saved as class-recording.webm');
        downloadRecording(recordingChunksRef.current);
        cleanupHiddenMedia();
        setTimeout(() => setRecordingStatus(''), 5000);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingStatus('Recording... Screen + Camera');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start recording.';
      setRecordingError(message);
      setRecordingStatus('');
      cleanupHiddenMedia();
    }
  };

  const stopRecording = () => {
    setRecordingStatus('Stopping recording...');
    stopCurrentRecording();
  };

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <ModernHeader />
        <main className="px-4 sm:px-6 lg:px-8 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="modern-card p-10 text-center spark">
              <p className="text-slate-600 font-medium">Loading your dashboard...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white via-purple-50 to-pink-50 relative">
      {/* Decorative background elements */}
      <div className="fixed top-0 right-0 -z-10 opacity-40">
        <div className="w-96 h-96 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full blur-3xl"></div>
      </div>
      <div className="fixed bottom-0 left-0 -z-10 opacity-30">
        <div className="w-96 h-96 bg-gradient-to-tr from-pink-300 to-purple-300 rounded-full blur-3xl"></div>
      </div>
      <ModernHeader showNav={true} userName={user?.full_name || 'User'} userInitials={userInitials} userImageUrl={user?.avatar_url || undefined} />

      <main className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="mx-auto max-w-7xl space-y-12">
          {/* Error Alert */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 sm:p-6">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-900">Unable to load dashboard</h3>
                  <p className="text-sm text-red-800 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Welcome Section */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 p-8 sm:p-12">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16" />

            <div className="relative">
              <p className="text-blue-100 text-sm font-semibold uppercase tracking-wide mb-2">Welcome back</p>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">
                Hey, {welcomeName}! 👋
              </h1>
              <p className="text-blue-50 text-lg max-w-2xl">
                {loading ? 'Loading your learning journey...' : `You're making great progress. Keep learning and growing!`}
              </p>

              {!loading && weeklyStats && (
                <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                  <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                    <p className="text-blue-100 text-sm font-medium">This Week</p>
                    <p className="text-3xl font-bold text-white mt-1">{weeklyStats.courses_completed}</p>
                    <p className="text-blue-100 text-xs">Courses Completed</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                    <p className="text-blue-100 text-sm font-medium">Quizzes</p>
                    <p className="text-3xl font-bold text-white mt-1">{weeklyStats.quizzes_attempted}</p>
                    <p className="text-blue-100 text-xs">Attempted</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                    <p className="text-blue-100 text-sm font-medium">Assignments</p>
                    <p className="text-3xl font-bold text-white mt-1">{weeklyStats.assignments_submitted}</p>
                    <p className="text-blue-100 text-xs">Submitted</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                    <p className="text-blue-100 text-sm font-medium">Lessons</p>
                    <p className="text-3xl font-bold text-white mt-1">{weeklyStats.lessons_completed}</p>
                    <p className="text-blue-100 text-xs">Completed</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!loading && (
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-12">
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900">📚 My Courses</h2>
                      <p className="text-slate-600 mt-2">Continue learning where you left off</p>
                    </div>
                    <Link
                      href="/courses"
                      className="text-blue-600 hover:text-blue-700 font-semibold transition-colors flex items-center gap-2"
                    >
                      View All
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>

                  {((dashboardOverview?.continue_learning?.length ?? 0) || (dashboardOverview?.enrolled_courses?.length ?? 0)) > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {(dashboardOverview?.continue_learning?.length ? dashboardOverview.continue_learning : dashboardOverview?.enrolled_courses || [])
                        .slice(0, 4)
                        .map((item) => (
                          <CourseCard
                            key={item.course_id}
                            course={{
                              id: item.course_id,
                              title: item.title,
                              slug: item.slug,
                              thumbnail_url: item.thumbnail_url,
                            }}
                            enrolled={true}
                            progress={item.progress}
                          />
                        ))}
                    </div>
                  ) : (
                    <div className="modern-card p-12 text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C6.5 6.253 2 10.998 2 17s4.5 10.747 10 10.747c5.523 0 10-4.998 10-10.747 0-6.002-4.477-10.747-10-10.747z" />
                      </svg>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">No courses yet</h3>
                      <p className="text-slate-600 mb-6">Explore our course catalog to get started learning</p>
                      <Link href="/courses" className="btn-primary inline-flex">
                        Browse Courses
                      </Link>
                    </div>
                  )}
                </section>

                {assignments.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-3xl font-bold text-slate-900">📋 Assignments</h2>
                        <p className="text-slate-600 mt-2">Assignments for your enrolled courses</p>
                      </div>
                      <Link
                        href="/assignments"
                        className="text-blue-600 hover:text-blue-700 font-semibold transition-colors flex items-center gap-2"
                      >
                        View All
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {assignments.slice(0, 4).map((assignment) => (
                        <div key={assignment.id} className="modern-card p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="font-semibold text-slate-900 mb-1">{assignment.title}</h4>
                              <p className="text-sm text-slate-600 mb-2">{assignment.course_name}</p>
                              {assignment.due_date && (
                                <p className="text-xs text-slate-500">
                                  Due: {new Date(assignment.due_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                assignment.submission ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {assignment.submission ? 'Submitted' : 'Not Submitted'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <Link
                              href={`/assignments/${assignment.id}`}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              {assignment.submission ? 'View Submission' : 'Submit Assignment'}
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {quizAttempts.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-3xl font-bold text-slate-900">📝 Recent Activity</h2>
                        <p className="text-slate-600 mt-2">Your latest quiz attempts and submissions</p>
                      </div>
                      <Link
                        href="/assignments"
                        className="text-blue-600 hover:text-blue-700 font-semibold transition-colors flex items-center gap-2"
                      >
                        View All
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>

                    <div className="space-y-3">
                      {quizAttempts.slice(0, 5).map((attempt) => (
                        <div key={attempt.id} className="modern-card p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="font-semibold text-slate-900">Quiz Attempt</h4>
                              <p className="text-sm text-slate-600 mt-1">
                                Status: <span className="font-medium">{attempt.status}</span>
                              </p>
                            </div>
                            {attempt.score !== null && (
                              <div className="text-right">
                                <p className="text-2xl font-bold text-green-600">{attempt.score}</p>
                                <p className="text-xs text-slate-500">Score</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="space-y-8">
                <AnnouncementsSection />

                <section className="modern-card p-6 bg-gradient-to-br from-purple-50 to-blue-50">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-xl">🎥 Daily 5-Min Learning</h3>
                      <p className="text-sm text-slate-700 mt-2">Share what you learned today in a short video</p>
                    </div>
                    <div className="space-x-2">
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                        🔥 Daily Learning
                      </span>
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                        ⏱ 5 Min Max
                      </span>
                    </div>
                  </div>

                  {role === 'student' ? (
                    <div className="rounded-xl bg-white shadow-sm p-4">
                      {showRecorder ? (
                        <div className="space-y-4">
                          <p className="text-slate-700">Your recorder is ready. Use the controls below to start and stop your learning capture.</p>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <button
                              type="button"
                              onClick={startRecording}
                              disabled={isRecording}
                              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-95"
                            >
                              ▶ Start Recording
                            </button>
                            <button
                              type="button"
                              onClick={stopRecording}
                              disabled={!isRecording}
                              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-100"
                            >
                              ■ Stop Recording
                            </button>
                          </div>
                          {(recordingStatus || recordingError) && (
                            <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                              {recordingError ? (
                                <p className="text-red-600">{recordingError}</p>
                              ) : (
                                <p>{recordingStatus}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-slate-700">Ready to share today’s learning? Use the button below to record your quick learning update.</p>
                          <button
                            type="button"
                            onClick={() => setShowRecorder(true)}
                            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:opacity-95"
                          >
                            🎥 Record Learning
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      Only students can share today&rsquo;s learning videos, but everyone can watch the latest uploads.
                    </div>
                  )}
                </section>

                <section className="modern-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">🎬 Today’s Learning Videos</h3>
                      <p className="text-sm text-slate-600">Latest student stories shared in short clips.</p>
                    </div>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Today
                    </span>
                  </div>

                  {dailyVideos.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {dailyVideos.map((video) => (
                        <div key={video.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <h4 className="font-semibold text-slate-900">{video.user_name}</h4>
                              <p className="text-sm text-slate-700 mt-1 font-medium">{video.title}</p>
                              <p className="text-xs text-slate-500 mt-1">Today</p>
                            </div>
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                              Today
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-4 line-clamp-3">{video.description}</p>
                          <div className="overflow-hidden rounded-3xl bg-slate-900">
                            {video.video_type === 'vimeo' ? (
                              <iframe
                                src={video.video_url}
                                width="300"
                                height="200"
                                allow="autoplay; fullscreen"
                                className="h-52 w-full"
                                title={`Vimeo video shared by ${video.user_name}`}
                              />
                            ) : (
                              <video controls className="h-52 w-full bg-black">
                                <source src={video.video_url} type="video/mp4" />
                                Your browser does not support the video tag.
                              </video>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
                      No learning videos uploaded today yet
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
