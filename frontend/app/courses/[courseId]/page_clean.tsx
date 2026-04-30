'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { fetchCourse, fetchCourseStructure, fetchStudentCourseScores, fetchStudentCourseDashboard } from '@/services/courses';
import { enrollInCourse, unenrollFromCourse, getEnrollment } from '@/services/instructor';
import { fetchCourseQuizzes } from '@/services/quiz';
import { listLiveClasses, LiveClass } from '@/services/live_classes';
import type { CourseDetails, CourseStructure, StudentCourseScores, StudentCourseDashboard } from '@/types/course';
import type { Quiz } from '@/types/quiz';
import type { EnrollmentData } from '@/services/instructor';

export default function CourseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId ? (Array.isArray(params.courseId) ? params.courseId[0] : params.courseId) : null;
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [structure, setStructure] = useState<CourseStructure | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [error, setError] = useState('');
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [scores, setScores] = useState<StudentCourseScores | null>(null);
  const [loadingScores, setLoadingScores] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState<StudentCourseDashboard | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [loadingLiveClasses, setLoadingLiveClasses] = useState(false);
  const [joiningClassId, setJoiningClassId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const courseCategory =
    typeof course?.category === 'object'
      ? course.category?.name ?? 'General'
      : course?.category ?? 'General';

  const instructorName =
    course?.instructor_name ||
    course?.instructors?.[0]?.full_name ||
    'Staff';

  useEffect(() => {
    if (!courseId) {
      router.push('/courses');
      return;
    }

    async function loadCourse() {
      try {
        const result = await fetchCourse(courseId);
        setCourse(result);
        const enrollmentData = await getEnrollment(parseInt(courseId, 10));
        setEnrollment(enrollmentData);
      } catch (err) {
        setError('Course not found or unavailable.');
      } finally {
        setLoading(false);
      }
    }

    loadCourse();
  }, [courseId, router]);

  useEffect(() => {
    if (!courseId || !enrollment) {
      setStructure(null);
      setQuizzes([]);
      setScores(null);
      setDashboard(null);
      return;
    }

    const loadScores = async () => {
      setLoadingScores(true);
      try {
        const data = await fetchStudentCourseScores(courseId);
        console.log('Scores Data:', data);
        setScores(data);
      } catch (err) {
        console.error('Failed to load scores:', err);
        setScores(null);
      } finally {
        setLoadingScores(false);
      }
    };

    const loadDashboard = async () => {
      setLoadingDashboard(true);
      try {
        const data = await fetchStudentCourseDashboard(courseId);
        console.log('Dashboard Data:', data);
        setDashboard(data);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        setDashboard(null);
      } finally {
        setLoadingDashboard(false);
      }
    };

    setLoadingStructure(true);
    setLoadingQuizzes(true);

    fetchCourseStructure(courseId)
      .catch(() => {
        // keep course page available even if structure cannot load
      })
      .finally(() => setLoadingStructure(false));

    fetchCourseQuizzes(parseInt(courseId, 10))
      .then(setQuizzes)
      .catch(() => {
        setQuizzes([]);
      })
      .finally(() => setLoadingQuizzes(false));

    loadScores();
    loadDashboard();
    
    const loadCourseLiveClasses = async () => {
      setLoadingLiveClasses(true);
      try {
        if (course?.title) {
          const classes = await listLiveClasses(course.title, undefined, true);
          setLiveClasses(classes);
        }
      } catch (err) {
        console.error('Failed to load live classes:', err);
        setLiveClasses([]);
      } finally {
        setLoadingLiveClasses(false);
      }
    };
    
    if (course?.title) {
      loadCourseLiveClasses();
    }
    
    const interval = window.setInterval(loadScores, 30000);
    const timeInterval = window.setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(timeInterval);
    };
  }, [courseId, enrollment]);

  const handleEnrollment = async () => {
    if (!courseId) return;

    setEnrolling(true);
    try {
      if (enrollment) {
        await unenrollFromCourse(parseInt(courseId, 10));
        setEnrollment(null);
        setStructure(null);
      } else {
        const enrollmentData = await enrollInCourse(parseInt(courseId, 10));
        setEnrollment(enrollmentData);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update enrollment');
    } finally {
      setEnrolling(false);
    }
  };

  const firstLessonId = structure?.modules?.[0]?.lessons?.[0]?.id;
  const lessonCount = course?.lessons?.length ?? structure?.modules.reduce((count, module) => count + module.lessons.length, 0) ?? 0;
  const overallProgress = Number.isFinite(enrollment?.progress ?? NaN) ? Math.round(enrollment?.progress ?? 0) : 0;

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isLiveClassOngoing = (liveClass: LiveClass) => {
    const start = new Date(liveClass.scheduled_at);
    if (Number.isNaN(start.getTime())) return false;
    const durationMinutes = liveClass.duration_minutes ?? 0;
    const end = new Date(start.getTime() + durationMinutes * 60000);
    return currentTime >= start && (durationMinutes <= 0 || currentTime <= end);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-8">
        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Loading course details…</div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-rose-700">{error}</div>
        ) : course ? (
          <>
            {/* Non-Enrolled Section - Course Preview */}
            {!enrollment && (
              <div className="rounded-2xl bg-white p-8 shadow-sm shadow-slate-200/40">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between mb-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Course overview</p>
                      <h1 className="mt-3 text-3xl font-semibold">{course.title}</h1>
                    </div>
                    {course.short_description ? (
                      <p className="text-lg leading-8 text-slate-600">{course.short_description}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2 text-right">
                    {course.average_rating ? <p className="text-sm font-semibold text-slate-900">Rating {course.average_rating.toFixed(1)} ★</p> : null}
                    {course.level ? <p className="text-sm text-slate-600">Level: {course.level}</p> : null}
                  </div>
                </div>

                {course.thumbnail_url ? (
                  <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    <img src={course.thumbnail_url} alt={course.title} className="h-72 w-full object-cover" />
                  </div>
                ) : null}

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm text-slate-500">Category</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{courseCategory}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm text-slate-500">Instructor</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{instructorName}</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
                  <div className="space-y-6">
                    {course.description && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">About This Course</h3>
                        <p className="text-slate-600 text-sm leading-relaxed">{course.description}</p>
                      </div>
                    )}
                  </div>

                  <aside className="space-y-6">
                    {course.requirements?.length ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <h2 className="text-lg font-semibold text-slate-900 mb-3">Requirements</h2>
                        <ul className="space-y-2">
                          {course.requirements.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-sky-600 mt-1 flex-shrink-0 text-xs">✓</span>
                              <span className="text-slate-600 text-sm">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      <h2 className="text-lg font-semibold text-slate-900 mb-3">Course Details</h2>
                      <div className="space-y-2 text-sm">
                        <p><span className="text-slate-500">Level:</span> <span className="font-semibold text-slate-900">{course.level || 'Not specified'}</span></p>
                        <p><span className="text-slate-500">Price:</span> <span className="font-semibold text-slate-900">{course.price ? `$${course.price.toFixed(2)}` : 'Free'}</span></p>
                      </div>
                    </div>
                  </aside>
                </div>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <Link href="/courses" className="text-sm font-semibold text-sky-600 hover:text-sky-700">Back to courses</Link>
                  <button
                    onClick={handleEnrollment}
                    disabled={enrolling}
                    className={`rounded-full px-6 py-3 text-sm font-semibold text-white transition ${
                      enrollment
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-sky-600 hover:bg-sky-700'
                    } disabled:opacity-50`}
                  >
                    {enrolling ? 'Processing...' : enrollment ? 'Unenroll' : 'Enroll now'}
                  </button>
                </div>
              </div>
            )}

            {/* Enrolled Section - Full Course View */}
            {enrollment && (
              <div className="rounded-2xl bg-white p-8 shadow-sm shadow-slate-200/40">
                {/* Top: Image + Course Info (Horizontal Layout) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 pb-8 border-b border-slate-200">
                  {/* Left: Course Image */}
                  <div className="md:col-span-1">
                    {course.thumbnail_url ? (
                      <div className="overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                        <img src={course.thumbnail_url} alt={course.title} className="h-56 w-full object-cover" />
                      </div>
                    ) : (
                      <div className="rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 h-56 flex items-center justify-center">
                        <span className="text-4xl">📚</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Course Details */}
                  <div className="md:col-span-2 flex flex-col justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-widest text-sky-600 font-semibold">Course Overview</p>
                      <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900">{course.title}</h1>
                      {course.short_description && (
                        <p className="mt-3 text-base text-slate-600 leading-relaxed">{course.short_description}</p>
                      )}
                      
                      {/* Instructor & Category */}
                      <div className="mt-5 flex flex-wrap gap-6 text-sm">
                        <div>
                          <p className="text-xs uppercase text-slate-500 font-semibold">Instructor</p>
                          <p className="mt-1 font-semibold text-slate-900">{instructorName}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500 font-semibold">Category</p>
                          <p className="mt-1 font-semibold text-slate-900">{courseCategory}</p>
                        </div>
                        {course.level && (
                          <div>
                            <p className="text-xs uppercase text-slate-500 font-semibold">Level</p>
                            <p className="mt-1 font-semibold text-slate-900 capitalize">{course.level}</p>
                          </div>
                        )}
                        {course.average_rating && (
                          <div>
                            <p className="text-xs uppercase text-slate-500 font-semibold">Rating</p>
                            <p className="mt-1 font-semibold text-slate-900">{course.average_rating.toFixed(1)} ★</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-6 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Progress</span>
                        <span className="font-semibold text-sky-600">{Math.round(enrollment.progress)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-sky-600 h-2 rounded-full transition-all" style={{ width: `${enrollment.progress}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tab Navigation - Proper Horizontal Tabs */}
                <div className="mt-8">
                  <div className="flex items-center gap-8 border-b border-slate-200 overflow-x-auto pb-0">
                    {[
                      { id: 'overview', label: 'Overview', icon: '📋' },
                      { id: 'lesson', label: 'Lessons', icon: '📚' },
                      { id: 'assignment', label: 'Assignments', icon: '📝' },
                      { id: 'quiz', label: 'Quizzes', icon: '❓' },
                      { id: 'announcement', label: 'Announcements', icon: '📢' },
                      { id: 'live-class', label: 'Live Class', icon: '📺' },
                      { id: 'marks', label: 'Marks', icon: '📊' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-4 text-sm font-semibold whitespace-nowrap transition border-b-2 ${
                          activeTab === tab.id
                            ? 'text-sky-600 border-sky-600'
                            : 'text-slate-600 border-transparent hover:text-slate-900'
                        }`}
                      >
                        <span className="mr-2">{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content Area */}
                <div className="mt-8 space-y-6">
                  {/* OVERVIEW TAB */}
                  {activeTab === 'overview' && (
                    <>
                      {/* Side-by-side Requirements and Course Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Requirements */}
                        {course.requirements?.length ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Requirements</h3>
                            <ul className="space-y-2">
                              {course.requirements.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-3">
                                  <span className="text-sky-600 mt-1 flex-shrink-0">✓</span>
                                  <span className="text-slate-600 text-sm">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {/* Course Details */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                          <h3 className="text-lg font-semibold text-slate-900 mb-4">Course Details</h3>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Level</span>
                              <span className="font-semibold text-slate-900 capitalize">{course.level || 'Not specified'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Price</span>
                              <span className="font-semibold text-slate-900">
                                {course.price ? `$${course.price.toFixed(2)}` : 'Free'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Duration</span>
                              <span className="font-semibold text-slate-900">
                                {course.duration_minutes ? `${Math.round(course.duration_minutes / 60)}h` : 'Self-paced'}
                              </span>
                            </div>
                            {lessonCount > 0 && (
                              <div className="flex justify-between">
                                <span className="text-slate-600">Lessons</span>
                                <span className="font-semibold text-slate-900">{lessonCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Course Description */}
                      {course.description && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                          <h3 className="text-lg font-semibold text-slate-900 mb-3">About This Course</h3>
                          <p className="text-slate-600 text-sm leading-relaxed">{course.description}</p>
                        </div>
                      )}

                      {/* Learning Objectives */}
                      {course.objectives?.length ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                          <h3 className="text-lg font-semibold text-slate-900 mb-4">What You'll Learn</h3>
                          <ul className="space-y-2">
                            {course.objectives.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-3">
                                <span className="text-sky-600 mt-1 flex-shrink-0">★</span>
                                <span className="text-slate-600 text-sm">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  )}

                  {/* LESSONS TAB */}
                  {activeTab === 'lesson' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Course Lessons</h3>
                          <p className="mt-1 text-sm text-slate-600">Browse and explore all course lessons</p>
                        </div>
                        <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700">
                          {lessonCount} lessons
                        </span>
                      </div>

                      {course?.lessons && course.lessons.length > 0 ? (
                        <div className="space-y-2">
                          {course.lessons.map((lesson) => (
                            <div key={lesson.id} className="rounded-lg border border-slate-200 bg-white hover:shadow-md transition overflow-hidden">
                              <button
                                onClick={() => setOpenLessonId(openLessonId === lesson.id ? null : lesson.id)}
                                className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50"
                              >
                                <div className="flex items-center gap-4 flex-1">
                                  <span className="text-lg">
                                    {openLessonId === lesson.id ? '▼' : '▶'}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 truncate">{lesson.title}</p>
                                    {lesson.description && (
                                      <p className="mt-1 text-xs text-slate-600 line-clamp-1">{lesson.description}</p>
                                    )}
                                  </div>
                                </div>
                                {lesson.duration_minutes && (
                                  <span className="text-xs text-slate-500 ml-2 flex-shrink-0">{lesson.duration_minutes}m</span>
                                )}
                              </button>

                              {openLessonId === lesson.id && lesson.video_url && (
                                <div className="px-4 pb-4 pt-0 border-t border-slate-200 bg-slate-50">
                                  {lesson.video_url.includes('vimeo.com') ? (
                                    <iframe
                                      src={lesson.video_url}
                                      width="100%"
                                      height="300"
                                      allow="autoplay; fullscreen"
                                      allowFullScreen
                                      title={lesson.title}
                                      className="rounded-lg mt-4"
                                    />
                                  ) : (
                                    <div className="rounded-lg bg-white px-4 py-8 text-center mt-4">
                                      <p className="text-sm text-slate-600 mb-3">Preview not available for this lesson type</p>
                                      <Link
                                        href={`/courses/${courseId}/lessons/${lesson.id}`}
                                        className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                                      >
                                        Open Full Lesson →
                                      </Link>
                                    </div>
                                  )}

                                  {/* Study Materials */}
                                  {lesson.content_payload && Array.isArray((lesson.content_payload as any)?.resources) && (lesson.content_payload as any).resources.length > 0 && (
                                    <div className="rounded-lg border border-slate-200 bg-white p-4 mt-4">
                                      <h4 className="text-sm font-semibold text-slate-900 mb-3">📂 Study Materials</h4>
                                      <div className="space-y-2">
                                        {((lesson.content_payload as any).resources as any[]).map((resource, idx) => (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => window.open(resource.url, '_blank')}
                                            className="w-full inline-flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 font-medium"
                                          >
                                            <span className="line-clamp-1">{resource.title || 'Study Material'}</span>
                                            <span className="text-sky-600 ml-2 flex-shrink-0">→</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : loadingStructure ? (
                        <p className="text-sm text-slate-600">Loading lessons…</p>
                      ) : (
                        <p className="text-sm text-slate-600">No lessons available yet.</p>
                      )}
                    </>
                  )}

                  {/* ASSIGNMENTS TAB */}
                  {activeTab === 'assignment' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Assignments</h3>
                          <p className="mt-1 text-sm text-slate-600">Complete assignments and track your progress</p>
                        </div>
                        <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700">
                          {dashboard?.assignments?.length || 0}
                        </span>
                      </div>

                      {loadingDashboard ? (
                        <p className="text-sm text-slate-600">Loading assignments…</p>
                      ) : dashboard?.assignments && dashboard.assignments.length > 0 ? (
                        <div className="space-y-2">
                          {dashboard.assignments.map((assignment) => (
                            <div key={assignment.id} className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-slate-900">{assignment.title}</h4>
                                  {assignment.instructions && (
                                    <p className="mt-2 text-xs text-slate-600 line-clamp-2">{assignment.instructions}</p>
                                  )}
                                </div>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                                  assignment.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {assignment.published ? 'Published' : 'Draft'}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                                <span>Max Score: {assignment.max_score}</span>
                                {assignment.due_date && <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">No assignments available yet.</p>
                      )}
                    </>
                  )}

                  {/* QUIZZES TAB */}
                  {activeTab === 'quiz' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Quizzes</h3>
                          <p className="mt-1 text-sm text-slate-600">Test your knowledge with quizzes</p>
                        </div>
                        <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700">
                          {dashboard?.quizzes?.length || 0}
                        </span>
                      </div>

                      {loadingDashboard ? (
                        <p className="text-sm text-slate-600">Loading quizzes…</p>
                      ) : dashboard?.quizzes && dashboard.quizzes.length > 0 ? (
                        <div className="space-y-2">
                          {dashboard.quizzes.map((quiz) => {
                            const startTime = quiz.start_time ? new Date(quiz.start_time) : null;
                            const dueDate = quiz.due_date ? new Date(quiz.due_date) : null;
                            const now = new Date();
                            const hasStarted = !startTime || startTime <= now;
                            const isPastDue = dueDate && dueDate < now;

                            return (
                              <Link
                                key={quiz.id}
                                href={hasStarted && !isPastDue ? `/courses/${courseId}/quiz` : '#'}
                                onClick={(e) => {
                                  if (!hasStarted || isPastDue) {
                                    e.preventDefault();
                                  }
                                }}
                                className={`block rounded-lg border border-slate-200 bg-white p-4 transition ${
                                  hasStarted && !isPastDue ? 'hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-slate-900">{quiz.title}</h4>
                                    {quiz.description && (
                                      <p className="mt-2 text-xs text-slate-600 line-clamp-1">{quiz.description}</p>
                                    )}
                                  </div>
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                                    isPastDue ? 'bg-red-100 text-red-700' :
                                    !hasStarted ? 'bg-yellow-100 text-yellow-700' :
                                    quiz.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {isPastDue ? 'Past Due' :
                                     !hasStarted ? 'Not Started' :
                                     quiz.published ? 'Available' : 'Draft'}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                                  <span>{quiz.total_points} points</span>
                                  {quiz.time_limit_minutes > 0 && <span>{quiz.time_limit_minutes}m timer</span>}
                                  <span>{quiz.pass_percentage}% pass rate</span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">No quizzes available yet.</p>
                      )}
                    </>
                  )}

                  {/* ANNOUNCEMENTS TAB */}
                  {activeTab === 'announcement' && (
                    <div className="text-center py-8">
                      <p className="text-slate-600">📢 No announcements yet. Check back later for updates!</p>
                    </div>
                  )}

                  {/* LIVE CLASS TAB */}
                  {activeTab === 'live-class' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Live Classes</h3>
                          <p className="mt-1 text-sm text-slate-600">View scheduled live sessions and join when they are live.</p>
                        </div>
                        <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700">
                          {loadingLiveClasses ? 'Loading…' : `${liveClasses.length} class${liveClasses.length === 1 ? '' : 'es'}`}
                        </span>
                      </div>

                      {loadingLiveClasses ? (
                        <p className="text-sm text-slate-600">Loading live classes…</p>
                      ) : liveClasses.length > 0 ? (
                        <div className="space-y-3">
                          {liveClasses.map((live) => {
                            const start = new Date(live.scheduled_at);
                            const isLive = isLiveClassOngoing(live);
                            const timeLabel = formatDateTime(live.scheduled_at);
                            const duration = live.duration_minutes ? `${live.duration_minutes} min` : 'TBD';

                            return (
                              <div key={live.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <h4 className="text-base font-semibold text-slate-900">{live.title}</h4>
                                    <p className="mt-2 text-sm text-slate-600">{timeLabel} · {duration}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                      {isLive ? 'Live now' : 'Scheduled'}
                                    </span>
                                    <a
                                      href={live.provider_join_url ?? '#'}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                                        isLive && live.provider_join_url ? 'bg-sky-600 text-white hover:bg-sky-700' : 'cursor-not-allowed bg-slate-100 text-slate-500'
                                      }`}
                                      onClick={(event) => {
                                        if (!isLive || !live.provider_join_url) {
                                          event.preventDefault();
                                        }
                                      }}
                                    >
                                      Join
                                    </a>
                                  </div>
                                </div>
                                {live.description && <p className="mt-3 text-sm text-slate-600">{live.description}</p>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                          <p className="text-sm text-slate-600">No live classes scheduled yet. Check back soon for updates.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MARKS TAB */}
                  {activeTab === 'marks' && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">Marks & Progress</h3>
                            <p className="mt-1 text-sm text-slate-600">Review your assignment and quiz scores alongside overall progress.</p>
                          </div>
                          <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700">{overallProgress}% complete</span>
                        </div>
                        <div className="mt-4 w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                          <div className="h-3 bg-sky-600 transition-all" style={{ width: `${overallProgress}%` }} />
                        </div>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <h4 className="text-base font-semibold text-slate-900 mb-4">Assignment Scores</h4>
                          {loadingScores ? (
                            <p className="text-sm text-slate-600">Loading assignment scores…</p>
                          ) : scores?.assignments?.length ? (
                            <div className="space-y-3">
                              {scores.assignments.map((assignment, idx) => (
                                <div key={`${assignment.title}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold text-slate-900">{assignment.title}</span>
                                    <span className="text-sm text-slate-600">{assignment.score ?? '—'} / {assignment.total}</span>
                                  </div>
                                  <p className="mt-2 text-xs text-slate-500">{assignment.status ? assignment.status : 'Not graded yet'}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-600">No assignment scores available yet.</p>
                          )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <h4 className="text-base font-semibold text-slate-900 mb-4">Quiz Scores</h4>
                          {loadingScores ? (
                            <p className="text-sm text-slate-600">Loading quiz scores…</p>
                          ) : scores?.quizzes?.length ? (
                            <div className="space-y-3">
                              {scores.quizzes.map((quiz, idx) => (
                                <div key={`${quiz.title}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold text-slate-900">{quiz.title}</span>
                                    <span className="text-sm text-slate-600">{quiz.score ?? '—'} / {quiz.total}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-600">No quiz scores available yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Continue Learning Button at Bottom */}
                <div className="mt-8 flex justify-center pt-6 border-t border-slate-200">
                  <Link
                    href={`/courses/${courseId}/learn`}
                    className="rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 px-8 py-3 text-sm font-semibold text-white transition hover:shadow-lg hover:from-sky-700 hover:to-indigo-700"
                  >
                    Continue Learning →
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
