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
  const courseId = Array.isArray(params.courseId) ? params.courseId[0] : params.courseId;
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

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-8">
        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Loading course details…</div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-rose-700">{error}</div>
        ) : course ? (
          <>
            <div className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
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
                <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
                  <img src={course.thumbnail_url} alt={course.title} className="h-72 w-full object-cover" />
                </div>
              ) : null}

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <p className="text-sm text-slate-500">Category</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{courseCategory}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <p className="text-sm text-slate-500">Instructor</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{instructorName}</p>
                </div>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-6">
                  {/* Course content moved to tabs */}
                </div>

                <aside className="space-y-6">
                  {course.requirements?.length ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                      <h2 className="text-xl font-semibold text-slate-900">Requirements</h2>
                      <ul className="mt-4 space-y-2 text-slate-600 list-disc list-inside">
                        {course.requirements.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                    <h2 className="text-xl font-semibold text-slate-900">Course details</h2>
                    <div className="mt-4 space-y-2 text-slate-600">
                      <p>{course.level ? `Level: ${course.level}` : 'Level not specified'}</p>
                      {course.price ? <p>Price: ${course.price.toFixed(2)}</p> : <p>Free to enroll</p>}
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

            {enrollment ? (
              <div className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Your learning path</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-900">Continue your course</h2>
                    <p className="mt-2 text-sm text-slate-600">Access lessons, assignments, and quizzes after enrolling.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      Progress: {Math.round(enrollment.progress)}%
                    </div>
                    <Link
                      href={`/courses/${courseId}/learn`}
                      className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Start Learning
                    </Link>
                  </div>
                </div>

                {/* Tab Navigation Grid */}
                <div className="mt-8 grid grid-cols-4 gap-4">
                  {[
                    { id: 'overview', label: 'Overview', icon: '📋' },
                    { id: 'lesson', label: 'Lesson Plan', icon: '📚' },
                    { id: 'content', label: 'Course Content', icon: '📖' },
                    { id: 'assignment', label: 'Assignments', icon: '📝' },
                    { id: 'quiz', label: 'Quiz', icon: '❓' },
                    { id: 'announcement', label: 'Announcements', icon: '📢' },
                    { id: 'live_class', label: 'Join Class', icon: '🎥' },
                    { id: 'marks', label: 'Marks', icon: '🎯' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`bg-white shadow-md rounded-xl hover:bg-blue-100 p-4 transition-colors ${
                        activeTab === tab.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">{tab.icon}</span>
                        <span className="text-sm font-medium text-slate-700">{tab.label}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="mt-8">
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                        <div className="space-y-6">
                          {/* Course content sections moved here */}
                        </div>

                        <aside className="space-y-6">
                          {course.requirements?.length ? (
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                              <h2 className="text-xl font-semibold text-slate-900">Requirements</h2>
                              <ul className="mt-4 space-y-2 text-slate-600 list-disc list-inside">
                                {course.requirements.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                            <h2 className="text-xl font-semibold text-slate-900">Course details</h2>
                            <div className="mt-4 space-y-2 text-slate-600">
                              <p>{course.level ? `Level: ${course.level}` : 'Level not specified'}</p>
                              {course.price ? <p>Price: ${course.price.toFixed(2)}</p> : <p>Free to enroll</p>}
                            </div>
                          </div>
                        </aside>
                      </div>
                    </div>
                  )}

                  {activeTab === 'lesson' && (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">Course contents</h3>
                            <p className="mt-2 text-sm text-slate-600">Browse the lessons currently published.</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            {lessonCount} lessons
                          </span>
                        </div>

                        {course?.lessons && course.lessons.length > 0 ? (
                          <div className="mt-6 space-y-4">
                            {course.lessons.map((lesson) => (
                              <div key={lesson.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <button
                                  onClick={() => setOpenLessonId(openLessonId === lesson.id ? null : lesson.id)}
                                  className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">
                                      {openLessonId === lesson.id ? '▼' : '▶'}
                                    </span>
                                    <div>
                                      <span className="font-medium text-slate-900">{lesson.title}</span>
                                      {lesson.description && (
                                        <p className="mt-1 text-xs text-slate-600 line-clamp-2">{lesson.description}</p>
                                      )}
                                    </div>
                                  </div>
                                </button>
                                {openLessonId === lesson.id && lesson.video_url && (
                                  <div className="px-4 pb-4 space-y-4">
                                    {lesson.video_url.includes('vimeo.com') ? (
                                      <iframe
                                        src={lesson.video_url}
                                        width="100%"
                                        height="400"
                                        allow="autoplay; fullscreen"
                                        allowFullScreen
                                        title={lesson.title}
                                        className="rounded-lg"
                                      />
                                    ) : (
                                      <div className="rounded-lg bg-slate-100 px-4 py-8 text-center">
                                        <p className="text-sm text-slate-600 mb-3">Preview not available for this lesson type</p>
                                        <Link
                                          href={`/courses/${courseId}/lessons/${lesson.id}`}
                                          className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                                        >
                                          Open full lesson
                                        </Link>
                                      </div>
                                    )}

                                    {/* Study Materials */}
                                    {lesson.content_payload && (
                                      <div>
                                        {Array.isArray((lesson.content_payload as any)?.resources) && (lesson.content_payload as any).resources.length > 0 && (
                                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <h4 className="text-sm font-semibold text-slate-900 mb-3">📂 Study Materials</h4>
                                            <div className="space-y-2">
                                              {((lesson.content_payload as any).resources as any[]).map((resource, idx) => (
                                                <button
                                                  key={idx}
                                                  type="button"
                                                  onClick={() => window.open(resource.url, '_blank')}
                                                  className="w-full inline-flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 font-medium"
                                                >
                                                  <span className="line-clamp-1">{resource.title || 'Study Material'}</span>
                                                  <span className="text-sky-600 ml-2 flex-shrink-0">Open →</span>
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : loadingStructure ? (
                          <p className="mt-4 text-sm text-slate-600">Loading lessons…</p>
                        ) : (
                          <p className="mt-4 text-sm text-slate-600">No lessons available yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'content' && (
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                        <h2 className="text-xl font-semibold text-slate-900">What you'll learn</h2>
                        {course.syllabus ? (
                          <p className="mt-4 text-slate-600">{course.syllabus}</p>
                        ) : course.objectives?.length ? (
                          <ul className="mt-4 space-y-2 text-slate-600 list-disc list-inside">
                            {course.objectives.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-4 text-slate-600">{course.description ?? 'Skills, lessons, and outcomes will be available once this course is published.'}</p>
                        )}
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                        <h2 className="text-xl font-semibold text-slate-900">About this course</h2>
                        <p className="mt-4 text-slate-600">{course.description ?? 'No full description available.'}</p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'assignment' && (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">Assignments</h3>
                            <p className="mt-2 text-sm text-slate-600">Complete your assignments and track your progress.</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            {dashboard?.assignments?.length || 0} assignments
                          </span>
                        </div>

                        {loadingDashboard ? (
                          <p className="mt-4 text-sm text-slate-600">Loading assignments…</p>
                        ) : dashboard?.assignments && dashboard.assignments.length > 0 ? (
                          <div className="mt-6 space-y-4">
                            {dashboard.assignments.map((assignment) => (
                              <div key={assignment.id} className="rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-sky-300 hover:shadow-md">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <h4 className="text-lg font-semibold text-slate-900">{assignment.title}</h4>
                                    {assignment.instructions && (
                                      <p className="mt-2 text-sm text-slate-600">{assignment.instructions}</p>
                                    )}
                                  </div>
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                                    assignment.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {assignment.published ? 'Published' : 'Draft'}
                                  </span>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                                  <span>Max Score: {assignment.max_score}</span>
                                  {assignment.due_date && <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-slate-600">No assignments available yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'quiz' && (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">Quizzes</h3>
                            <p className="mt-2 text-sm text-slate-600">Test your knowledge with these quizzes.</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            {dashboard?.quizzes?.length || 0} quizzes
                          </span>
                        </div>

                        {loadingDashboard ? (
                          <p className="mt-4 text-sm text-slate-600">Loading quizzes…</p>
                        ) : dashboard?.quizzes && dashboard.quizzes.length > 0 ? (
                          <div className="mt-6 space-y-4">
                            {dashboard.quizzes.map((quiz) => {
                              const startTime = quiz.start_time ? new Date(quiz.start_time) : null;
                              const dueDate = quiz.due_date ? new Date(quiz.due_date) : null;
                              const now = new Date();
                              const hasStarted = !startTime || startTime <= now;
                              const isPastDue = dueDate && dueDate < now;
                              const formattedStartTime = startTime?.toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                              const formattedDueDate = dueDate?.toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                              return (
                                <Link
                                  key={quiz.id}
                                  href={hasStarted && !isPastDue ? `/courses/${courseId}/quiz` : '#'}
                                  onClick={(e) => {
                                    if (!hasStarted || isPastDue) {
                                      e.preventDefault();
                                    }
                                  }}
                                  className={`block rounded-3xl border border-slate-200 bg-white p-6 transition ${
                                    hasStarted && !isPastDue ? 'hover:border-sky-300 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <h4 className="text-lg font-semibold text-slate-900">{quiz.title}</h4>
                                      {quiz.description && (
                                        <p className="mt-2 text-sm text-slate-600">{quiz.description}</p>
                                      )}
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                                      isPastDue ? 'bg-red-100 text-red-700' :
                                      !hasStarted ? 'bg-yellow-100 text-yellow-700' :
                                      quiz.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {isPastDue ? 'Past Due' :
                                       !hasStarted ? 'Not Started' :
                                       quiz.published ? 'Available' : 'Draft'}
                                    </span>
                                  </div>
                                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                                    <span>{quiz.total_points} points</span>
                                    {quiz.time_limit_minutes > 0 && <span>{quiz.time_limit_minutes} min timer</span>}
                                    <span>{quiz.pass_percentage}% pass rate</span>
                                  </div>
                                  {formattedStartTime && (
                                    <div className="mt-3 text-xs text-slate-500">
                                      Starts: {formattedStartTime}
                                      {formattedDueDate && <div>Due: {formattedDueDate}</div>}
                                    </div>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-slate-600">No quizzes available yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'announcement' && (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">Announcements</h3>
                            <p className="mt-2 text-sm text-slate-600">Stay updated with the latest course announcements.</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            {dashboard?.announcements?.length || 0} announcements
                          </span>
                        </div>

                        {loadingDashboard ? (
                          <p className="mt-4 text-sm text-slate-600">Loading announcements…</p>
                        ) : dashboard?.announcements && dashboard.announcements.length > 0 ? (
                          <div className="mt-6 space-y-4">
                            {dashboard.announcements.map((announcement) => (
                              <div key={announcement.id} className="rounded-3xl border border-slate-200 bg-white p-6">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <h4 className="text-lg font-semibold text-slate-900">{announcement.title}</h4>
                                    <p className="mt-2 text-sm text-slate-600">{announcement.content}</p>
                                  </div>
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                                    announcement.priority === 'high' ? 'bg-red-100 text-red-700' :
                                    announcement.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {announcement.priority || 'normal'}
                                  </span>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                                  <span>Published: {new Date(announcement.published_at || announcement.created_at).toLocaleDateString()}</span>
                                  {announcement.expires_at && <span>Expires: {new Date(announcement.expires_at).toLocaleDateString()}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-slate-600">No announcements available yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'live_class' && (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                        <div className="flex items-center justify-between gap-4 mb-6">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">Live Classes</h3>
                            <p className="mt-2 text-sm text-slate-600">Join live sessions with your instructor and classmates.</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            {liveClasses.length} classes
                          </span>
                        </div>

                        {loadingLiveClasses ? (
                          <p className="text-sm text-slate-600">Loading live classes…</p>
                        ) : liveClasses.length > 0 ? (
                          <div className="space-y-4">
                            {liveClasses.map((liveClass) => {
                              const scheduledTime = new Date(liveClass.scheduled_at);
                              const now = currentTime;
                              const durationMs = (liveClass.duration_minutes ?? 0) * 60_000;
                              const classEndTime = new Date(scheduledTime.getTime() + durationMs);
                              const isBeforeClass = now < scheduledTime;
                              const isDuringClass = now >= scheduledTime && now < classEndTime;
                              const isAfterClass = now >= classEndTime;
                              const formattedTime = scheduledTime.toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                              const formattedStartTime = scheduledTime.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              });

                              return (
                                <div key={liveClass.id} className="rounded-3xl border border-slate-200 bg-white p-6">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <h4 className="text-lg font-semibold text-slate-900">{liveClass.title}</h4>
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                                          isBeforeClass ? 'bg-blue-100 text-blue-700' : isDuringClass ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                          {isBeforeClass ? 'Upcoming' : isDuringClass ? 'Live' : 'Ended'}
                                        </span>
                                      </div>
                                      {liveClass.description && (
                                        <p className="mt-2 text-sm text-slate-600">{liveClass.description}</p>
                                      )}
                                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                                        <span>📅 {formattedTime}</span>
                                        {liveClass.duration_minutes && <span>⏱️ {liveClass.duration_minutes} minutes</span>}
                                        {liveClass.instructor?.full_name && <span>👤 {liveClass.instructor.full_name}</span>}
                                      </div>
                                    </div>
                                    {isDuringClass ? (
                                      <button
                                        onClick={() => {
                                          setJoiningClassId(liveClass.id);
                                          window.location.href = `/live-class/${liveClass.id}`;
                                        }}
                                        disabled={joiningClassId === liveClass.id}
                                        className="rounded-full bg-sky-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
                                      >
                                        {joiningClassId === liveClass.id ? 'Joining...' : 'Join Class'}
                                      </button>
                                    ) : (
                                      <div className="rounded-full bg-slate-100 px-6 py-2 text-sm font-semibold text-slate-700">
                                        {isBeforeClass ? `Starts at ${formattedStartTime}` : 'Class Ended'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">No live classes scheduled yet. Check back soon!</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'marks' && (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Your Scores</h3>

                        {loadingScores ? (
                          <p className="text-sm text-slate-600">Loading scores...</p>
                        ) : scores ? (
                          <div className="space-y-6">
                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="mb-4 flex items-center justify-between">
                                <h4 className="text-base font-semibold text-slate-900">📘 Assignments</h4>
                                <span className="text-sm text-slate-500">{scores.assignments.length} items</span>
                              </div>
                              {scores.assignments.length === 0 ? (
                                <p className="text-sm text-slate-600">No scores available yet.</p>
                              ) : (
                                <div className="space-y-3">
                                  {scores.assignments.map((assignment, index) => (
                                    <div key={index} className={`rounded-3xl border p-4 ${assignment.reviewed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                                      <div className="flex items-center justify-between gap-4">
                                        <p className="font-semibold text-slate-900">{assignment.title}</p>
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${assignment.reviewed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                          {assignment.reviewed ? 'Graded' : 'Pending'}
                                        </span>
                                      </div>
                                      <div className="mt-3 text-sm text-slate-700 space-y-1">
                                        <p>
                                          Grade: {assignment.score !== null ? `${assignment.score}/${assignment.total}` : 'Not graded yet'}
                                        </p>
                                        <p>
                                          Feedback: {assignment.feedback ? assignment.feedback : 'Not available yet'}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="mb-4 flex items-center justify-between">
                                <h4 className="text-base font-semibold text-slate-900">📝 Quizzes</h4>
                                <span className="text-sm text-slate-500">{scores.quizzes.length} items</span>
                              </div>
                              {scores.quizzes.length === 0 ? (
                                <p className="text-sm text-slate-600">No scores available yet.</p>
                              ) : (
                                <div className="space-y-3">
                                  {scores.quizzes.map((quiz, index) => (
                                    <div key={index} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                      <div className="flex items-center justify-between gap-4">
                                        <p className="font-semibold text-slate-900">{quiz.title}</p>
                                        <span className="text-sm font-medium text-slate-900">
                                          {quiz.score !== null ? `${quiz.score}/${quiz.total}` : 'Not taken'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </section>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">No scores available yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
