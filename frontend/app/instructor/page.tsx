'use client';

import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';
import {
  fetchInstructorCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  fetchCourseStructure,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson,
  uploadFile,
  fetchCategories,
  fetchTags,
  createQuiz,
  fetchQuizzes,
  updateQuiz,
  type CourseData,
  type CoursePayload,
  type ModuleData,
  type LessonData,
  type CategoryData,
  type TagData,
  type QuizCreatePayload,
  type QuizData,
  type QuizQuestionCreatePayload,
  type QuizQuestionType,
} from '@/services/instructor';
import type { CourseStructure } from '@/types/course';
import type { QuizAttemptRead } from '@/types/quiz';
import { fetchInstructorQuizResults } from '@/services/quiz';
import InstructorAssignmentsPage from '@/components/InstructorAssignmentsPage';
import { InstructorAnnouncementsPanel } from '@/components/InstructorAnnouncementsPanel';
import InstructorSubmissionsPage from '@/components/InstructorSubmissionsPage';
import InstructorLiveClassesList from '@/components/InstructorLiveClassesList';
import ThemeToggle from '@/components/ThemeToggle';
import { fetchCurrentUser, uploadAvatar } from '@/services/auth';

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail || error.response?.data?.message;
    return typeof detail === 'string' && detail ? detail : fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

/* ─── helpers ───────────────────────────────────────────────── */

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const VISIBILITY = ['public', 'private'] as const;

type Tab = 'courses' | 'create' | 'edit' | 'structure' | 'quizzes' | 'assignments' | 'results' | 'announcements' | 'submissions' | 'live_classes' | 'discussions';

/* ─── page ──────────────────────────────────────────────────── */

export default function InstructorPage() {
  const { authenticated, role, userId } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  // Profile state
  const [profile, setProfile] = useState<{ name: string; email: string; avatarUrl: string | null }>({ name: '', email: '', avatarUrl: null });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Fetch current user on mount
  useEffect(() => {
    fetchCurrentUser().then((user) => {
      setProfile({
        name: user.full_name || 'Instructor',
        email: user.email || '',
        avatarUrl: user.avatar_url || null,
      });
    }).catch(() => {
      // Fallback to role-based name if fetch fails
      setProfile({ name: 'Instructor', email: '', avatarUrl: null });
    });
  }, []);

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    try {
      const { url } = await uploadAvatar(file);
      setProfile((prev) => ({ ...prev, avatarUrl: url }));
    } catch (error) {
      console.error('Avatar upload failed:', error);
    } finally {
      setAvatarUploading(false);
    }
  };

  const [tab, setTab] = useState<Tab>('courses');
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ── form state ─────────────────────────────────────────── */
  const emptyForm: CoursePayload = {
    title: '', slug: '', short_description: '', description: '',
    thumbnail_url: '', objectives: [], requirements: [],
    level: 'beginner', duration_minutes: 0, visibility: 'private',
    status: 'draft', is_published: false, price: 0,
    category_id: null, tag_ids: [], instructor_ids: [],
    is_featured: false,
  };
  const [form, setForm] = useState<CoursePayload>({ ...emptyForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [objectiveInput, setObjectiveInput] = useState('');
  const [requirementInput, setRequirementInput] = useState('');



  /* ── structure state ────────────────────────────────────── */
  const [structure, setStructure] = useState<CourseStructure | null>(null);
  const [structureCourseId, setStructureCourseId] = useState<number | null>(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonModuleId, setLessonModuleId] = useState<number | null>(null);
  const [lessonContentType, setLessonContentType] = useState('video_upload');
  const [lessonContentUrl, setLessonContentUrl] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonMaterials, setLessonMaterials] = useState<string[]>([]);
  const [newLessonMaterial, setNewLessonMaterial] = useState('');
  const [lessonDuration, setLessonDuration] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  /* ── quiz state ─────────────────────────────────────────── */
  const [quizzes, setQuizzes] = useState<QuizData[]>([]);
  const [quizForm, setQuizForm] = useState<QuizCreatePayload>({
    course_id: 0,
    title: '',
    description: '',
    total_points: 0,
    passing_score: 0,
    pass_percentage: 0,
    time_limit_minutes: 0,
    randomize_questions: false,
    question_count: 0,
    max_attempts: 1,
    auto_grade_enabled: true,
    published: true,
    due_date: '',
    questions: [{
      text: '',
      question_type: 'multiple_choice',
      choices: [''],
      correct_answer: '',
      points: 1,
    }],
  });
  const [selectedCourseForQuiz, setSelectedCourseForQuiz] = useState<number | null>(null);

  /* ── quiz results state ─────────────────────────────────── */
  const [quizResults, setQuizResults] = useState<QuizAttemptRead[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  /* ── filter state ───────────────────────────────────────── */
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isInstructor = role && ['instructor', 'organization_admin', 'super_admin', 'admin'].includes(role);

  /* ── load data ──────────────────────────────────────────── */
  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, cats, t] = await Promise.all([
        fetchInstructorCourses(),
        fetchCategories().catch(() => []),
        fetchTags().catch(() => []),
      ]);
      setCourses(c);
      setCategories(cats);
      setTags(t);
    } catch {
      setError('Failed to load courses.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = await fetchQuizzes();
      setQuizzes(q);
    } catch {
      setError('Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQuizResults = useCallback(async () => {
    setLoadingResults(true);
    setError('');
    try {
      const results = await fetchInstructorQuizResults();
      setQuizResults(results);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load quiz results.'));
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated && isInstructor) {
      if (tab === 'discussions') {
        router.push('/discussions');
        return;
      }
      loadCourses();
      if (tab === 'quizzes') loadQuizzes();
      if (tab === 'results') loadQuizResults();
    }
  }, [authenticated, isInstructor, loadCourses, tab, loadQuizzes, loadQuizResults, router]);

  /* ── filtered courses ───────────────────────────────────── */
  const filteredCourses = useMemo(() => {
    let list = courses;
    if (filterStatus === 'draft') list = list.filter((c) => !c.is_published);
    if (filterStatus === 'published') list = list.filter((c) => c.is_published);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
    }
    return list;
  }, [courses, filterStatus, searchQuery]);

  /* ── handlers ───────────────────────────────────────────── */
  const handleTitleChange = (title: string) => {
    setForm((f) => ({ ...f, title, slug: slugify(title) }));
  };

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'course_videos');

      const response = await fetch('https://api.cloudinary.com/v1_1/defo0hmhp/video/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setVideoUrl(data.secure_url);
      setLessonFile(file); // Keep file reference for display
    } catch (error) {
      setError('Failed to upload video. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

    const handleSaveCourse = async () => {
    setSaving(true);
    setError('');
    try {
      const course = editId ? await updateCourse(editId, form) : await createCourse(form);

      if (editId) {
        flash('Course updated successfully.');
        setForm({ ...emptyForm });
        setEditId(null);
        setTab('courses');
        await loadCourses();
      } else {
        // For new courses, redirect to lesson management page
        flash('Course created successfully.');
        setForm({ ...emptyForm });
        setTab('courses');
        setEditId(null);
        await loadCourses();
        // Redirect to lesson management page
        router.push(`/instructor/courses/${course.id}/lessons`);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to save course.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (course: CourseData) => {
    setForm({
      title: course.title,
      slug: course.slug,
      short_description: course.short_description ?? '',
      description: course.description ?? '',
      thumbnail_url: course.thumbnail_url ?? '',
      objectives: course.objectives ?? [],
      requirements: course.requirements ?? [],
      level: course.level as any,
      duration_minutes: course.duration_minutes ?? 0,
      visibility: course.visibility as any,
      status: course.status,
      is_published: course.is_published,
      price: course.price,
      category_id: typeof course.category === 'object' ? course.category?.id ?? null : null,
      tag_ids: course.tags?.map((t) => t.id) ?? [],
      instructor_ids: course.instructors?.map((i) => i.id) ?? [],
      is_featured: course.is_featured,
    });
    setEditId(course.id);
    setTab('edit');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this course? This action cannot be undone.')) return;
    try {
      await deleteCourse(id);
      flash('Course deleted.');
      await loadCourses();
    } catch {
      setError('Failed to delete course.');
    }
  };

  const handleTogglePublish = async (course: CourseData) => {
    try {
      await updateCourse(course.id, { is_published: !course.is_published, status: course.is_published ? 'draft' : 'published' });
      flash(course.is_published ? 'Course unpublished.' : 'Course published.');
      await loadCourses();
    } catch {
      setError('Failed to toggle publish state.');
    }
  };

  /* ── structure handlers ─────────────────────────────────── */
  const openStructure = async (courseId: number) => {
    setStructureCourseId(courseId);
    setTab('structure');
    try {
      const s = await fetchCourseStructure(courseId);
      setStructure(s);
    } catch {
      setError('Failed to load course structure.');
    }
  };

  const handleAddModule = async () => {
    if (!moduleTitle.trim() || !structureCourseId) return;
    try {
      await createModule({ course_id: structureCourseId, title: moduleTitle.trim() });
      setModuleTitle('');
      const s = await fetchCourseStructure(structureCourseId);
      setStructure(s);
      flash('Module added.');
    } catch {
      setError('Failed to add module.');
    }
  };

  const handleDeleteModule = async (moduleId: number) => {
    if (!confirm('Delete this module?')) return;
    try {
      await deleteModule(moduleId);
      if (structureCourseId) {
        const s = await fetchCourseStructure(structureCourseId);
        setStructure(s);
      }
      flash('Module deleted.');
    } catch {
      setError('Failed to delete module.');
    }
  };

  const getLessonContentPayload = (): Record<string, unknown> => {
    const value = lessonContentUrl.trim();
    const hasVideo = videoUrl.trim() || value.trim();
    
    switch (lessonContentType) {
      case 'video_upload':
        // Only include file_url if there's actually a video URL
        return hasVideo ? { file_url: videoUrl || value } : {};
      case 'audio':
      case 'pdf':
      case 'ppt':
      case 'doc':
        return { file_url: value };
      case 'youtube_embed': {
        const youtubeId = extractYouTubeId(value);
        return { youtube_id: youtubeId ?? value };
      }
      case 'vimeo_embed': {
        const vimeoId = extractVimeoId(value);
        return { vimeo_id: vimeoId ?? value };
      }
      case 'text':
        return { body: value || lessonDescription || '' };
      case 'html':
        return { html: value || lessonDescription || '' };
      case 'external_link':
      case 'live_link':
        return { url: value };
      case 'iframe_embed':
        return { iframe_url: value };
      default:
        return { body: value || lessonDescription || '' };
    }
  };

  const isContentSourceRequired = ['video_upload', 'audio', 'pdf', 'ppt', 'doc', 'youtube_embed', 'vimeo_embed', 'external_link', 'live_link', 'iframe_embed'].includes(lessonContentType);

  const isValidUrl = (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const extractVimeoId = (value: string): string | null => {
    const trimmed = value.trim();
    const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/);
    return urlMatch ? urlMatch[1] : (trimmed.match(/^\d+$/) ? trimmed : null);
  };

  const extractYouTubeId = (value: string): string | null => {
    const trimmed = value.trim();
    const urlMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return urlMatch ? urlMatch[1] : (trimmed.match(/^[A-Za-z0-9_-]{11}$/) ? trimmed : null);
  };

  const addLessonMaterial = () => {
    const trimmedLink = newLessonMaterial.trim();
    if (!trimmedLink) {
      return;
    }
    if (!isValidUrl(trimmedLink)) {
      setError('Please enter a valid URL for study material.');
      return;
    }
    setLessonMaterials((current) => [...current, trimmedLink]);
    setNewLessonMaterial('');
  };

  const removeLessonMaterial = (index: number) => {
    setLessonMaterials((current) => current.filter((_, idx) => idx !== index));
  };

  const handleAddLesson = async () => {
    if (!lessonTitle.trim() || !lessonModuleId || !structureCourseId) return;

    // Validation: Allow if (video/file) OR (at least one study material)
    const pendingMaterial = newLessonMaterial.trim();
    const pendingMaterials = pendingMaterial ? [pendingMaterial] : [];
    const allMaterials = [...lessonMaterials, ...pendingMaterials];
    const validMaterials = allMaterials.map((link) => link.trim()).filter(Boolean);
    const hasVideo = lessonContentUrl.trim() || videoUrl.trim() || lessonFile;
    const hasMaterial = validMaterials.length > 0;
    if (!hasVideo && !hasMaterial) {
      setError('Please provide a video URL, upload a video file, or add at least one study material.');
      return;
    }
    const invalidMaterial = validMaterials.find((link) => !isValidUrl(link));
    if (invalidMaterial) {
      setError('One or more study material links are not valid URLs.');
      return;
    }

    let contentPayload = getLessonContentPayload();

    // For video_upload: allow either videoUrl OR lessonFile (not both required)
    if (lessonContentType === 'video_upload' && lessonFile && !videoUrl) {
      // Wait for upload to complete before proceeding
      setError('Please wait for the video upload to complete.');
      return;
    } else if (lessonContentType === 'video_upload' && videoUrl && lessonFile) {
      // Both provided - use videoUrl (already uploaded), ignore the new file selection
      // This is fine - user can update later with a new file
    } else if (['audio', 'pdf', 'ppt', 'doc'].includes(lessonContentType) && lessonFile) {
      try {
        const uploadResult = await uploadFile(lessonFile);
        contentPayload = {
          file_url: uploadResult.url,
          mime_type: uploadResult.content_type,
          file_size_bytes: uploadResult.size,
        };
      } catch {
        setError('Failed to upload the lesson file. Please try again.');
        return;
      }
    }

    if (validMaterials.length > 0) {
      contentPayload = {
        ...contentPayload,
        resources: validMaterials.map((url) => ({
          title: url.includes('docs.google.com') ? 'Google Drive Material' : 'Study Material',
          url,
        })),
      };
    }

    try {
      const lessonData = {
        course_id: structureCourseId,
        module_id: lessonModuleId,
        title: lessonTitle.trim(),
        content: lessonDescription || undefined,
        content_type: lessonContentType,
        duration_minutes: lessonDuration ?? undefined,
        content_payload: contentPayload,
      };
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const tenant = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;
      console.log('Creating lesson with token:', token, 'tenant:', tenant, 'payload:', lessonData);
      await createLesson(lessonData);
      setLessonTitle('');
      setLessonContentUrl('');
      setLessonFile(null);
      setLessonDescription('');
      setLessonMaterials([]);
      setNewLessonMaterial('');
      setLessonDuration(null);
      setVideoUrl('');
      const s = await fetchCourseStructure(structureCourseId);
      setStructure(s);
      flash('Lesson added.');
    } catch (err) {
      console.error('Lesson creation failed:', err);
      setError(getErrorMessage(err, 'Failed to add lesson.'));
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (!confirm('Delete this lesson?')) return;
    try {
      await deleteLesson(lessonId);
      if (structureCourseId) {
        const s = await fetchCourseStructure(structureCourseId);
        setStructure(s);
      }
      flash('Lesson deleted.');
    } catch {
      setError('Failed to delete lesson.');
    }
  };

  /* ── quiz handlers ─────────────────────────────────── */
  const handleCreateQuiz = async () => {
    if (!selectedCourseForQuiz) {
      setError('Please select a course for the quiz.');
      return;
    }
    if (!quizForm.title.trim()) {
      setError('Quiz title is required.');
      return;
    }
    if (quizForm.questions.length === 0 || quizForm.questions.some(q => !q.text.trim())) {
      setError('At least one question with text is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createQuiz({ ...quizForm, course_id: selectedCourseForQuiz });
      setQuizForm({
        course_id: 0,
        title: '',
        description: '',
        total_points: 0,
        passing_score: 0,
        pass_percentage: 0,
        time_limit_minutes: 0,
        randomize_questions: false,
        question_count: 0,
        max_attempts: 1,
        auto_grade_enabled: true,
        published: true,
        due_date: '',
        questions: [{
          text: '',
          question_type: 'multiple_choice',
          choices: [''],
          correct_answer: '',
          points: 1,
        }],
      });
      setSelectedCourseForQuiz(null);
      setTab('courses');
      flash('Quiz created successfully.');
      await loadQuizzes();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to create quiz.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuizQuestionChange = (index: number, field: keyof QuizQuestionCreatePayload, value: unknown) => {
    setQuizForm((current) => {
      const updated = [...current.questions];
      const question = { ...updated[index], [field]: value } as QuizQuestionCreatePayload;
      updated[index] = question;
      return { ...current, questions: updated };
    });
  };

  const handleQuizChoiceChange = (questionIndex: number, choiceIndex: number, value: string) => {
    setQuizForm((current) => {
      const updated = [...current.questions];
      const question = { ...updated[questionIndex] };
      question.choices = [...(question.choices || [])];
      question.choices[choiceIndex] = value;
      updated[questionIndex] = question;
      return { ...current, questions: updated };
    });
  };

  const addQuizChoice = (questionIndex: number) => {
    setQuizForm((current) => {
      const updated = [...current.questions];
      const question = { ...updated[questionIndex] };
      question.choices = [...(question.choices || []), ''];
      updated[questionIndex] = question;
      return { ...current, questions: updated };
    });
  };

  const removeQuizChoice = (questionIndex: number, choiceIndex: number) => {
    setQuizForm((current) => {
      const updated = [...current.questions];
      const question = { ...updated[questionIndex] };
      question.choices = [...(question.choices || [])];
      question.choices.splice(choiceIndex, 1);
      updated[questionIndex] = question;
      return { ...current, questions: updated };
    });
  };

  const addQuizQuestion = () => {
    setQuizForm((current) => ({ ...current, questions: [...current.questions, {
      text: '',
      question_type: 'multiple_choice',
      choices: [''],
      correct_answer: '',
      points: 1,
    }] }));
  };

  const removeQuizQuestion = (index: number) => {
    setQuizForm((current) => ({
      ...current,
      questions: current.questions.filter((_, questionIndex) => questionIndex !== index),
    }));
  };

  /* ── guard ──────────────────────────────────────────────── */
  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50 p-10 text-rose-700">
          Please sign in to access the instructor panel.
        </div>
      </main>
    );
  }

  if (!isInstructor) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-amber-200 bg-amber-50 p-10 text-amber-800">
          <p className="font-semibold">Access restricted</p>
          <p className="mt-2 text-sm">Only instructors and administrators can access this panel.</p>
        </div>
      </main>
    );
  }

  /* ──────────────────────────────────────────────────────────── */
  /* RENDER                                                       */
  /* ──────────────────────────────────────────────────────────── */

  // Helper to get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'I';
  };

  return (
    <main className="min-h-screen px-0 py-0 sm:px-0" style={{ backgroundColor: 'var(--surface-strong)', color: 'var(--text-color)' }}>
      <div className="flex min-h-screen">
        {/* Main content area (centered) */}
        <div className="flex-1 flex flex-col items-center justify-start py-10 px-4 sm:px-8">
          {/* Top Header with Theme Toggle and Profile */}
          <header className="w-full max-w-5xl flex items-center justify-between rounded-2xl bg-[var(--card-color)] px-6 py-4 shadow-sm border border-[var(--border-color)] mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-color)] text-sm font-bold text-white">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full rounded-full object-cover" />
                ) : (
                  getInitials(profile.name)
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-color)]">{profile.name || 'Instructor'}</p>
                <p className="text-xs text-[var(--muted-color)]">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center space-x-2 rounded-full p-2 transition hover:bg-[var(--surface-strong)]"
                >
                  <svg className="h-5 w-5 text-[var(--muted-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-50 bg-[var(--card-color)] border border-[var(--border-color)]">
                    <div className="px-4 py-2 border-b border-[var(--border-color)]">
                      <p className="text-sm font-medium text-[var(--text-color)]">{profile.name}</p>
                      <p className="text-xs text-[var(--muted-color)]">{profile.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        localStorage.removeItem('access_token');
                        router.push('/login');
                      }}
                      className="block w-full text-left px-4 py-2 text-sm hover:opacity-80 text-[var(--muted-color)]"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          {/* Main header */}
          <section className="w-full max-w-5xl overflow-hidden rounded-[2rem] px-8 py-10 shadow-2xl sm:px-12 mb-8" style={{ background: 'linear-gradient(to bottom right, var(--text-color), #1e293b, var(--text-color))', color: 'var(--bg-color)' }}>
            <p className="text-xs uppercase tracking-[0.35em]" style={{ color: 'var(--primary-color)' }}>Instructor panel</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Course management</h1>
            <p className="mt-4 max-w-xl text-sm sm:text-base" style={{ color: 'rgba(255,255,255,0.7)' }}>Create, edit, publish and organise your courses, modules and lessons from one place.</p>
          </section>
          {/* Alerts */}
          {error && (
            <div className="w-full max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700 mb-4">
              {error}
              <button type="button" onClick={() => setError('')} className="ml-4 font-semibold underline">Dismiss</button>
            </div>
          )}
          {success && (
            <div className="w-full max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700 mb-4">
              {success}
            </div>
          )}
          {/* Main content (tab content) */}
          <div className="w-full max-w-5xl">
            {/* TAB: COURSES LIST */}
            {tab === 'courses' && (
                ) : (
                  getInitials(profile.name)
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-color)]">{profile.name || 'Instructor'}</p>
                <p className="text-xs text-[var(--muted-color)]">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center space-x-2 rounded-full p-2 transition hover:bg-[var(--surface-strong)]"
                >
                  <svg className="h-5 w-5 text-[var(--muted-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-50 bg-[var(--card-color)] border border-[var(--border-color)]">
                    <div className="px-4 py-2 border-b border-[var(--border-color)]">
                      <p className="text-sm font-medium text-[var(--text-color)]">{profile.name}</p>
                      <p className="text-xs text-[var(--muted-color)]">{profile.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        localStorage.removeItem('access_token');
                        router.push('/login');
                      }}
                      className="block w-full text-left px-4 py-2 text-sm hover:opacity-80 text-[var(--muted-color)]"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          {/* Main header */}
          <section className="w-full max-w-5xl overflow-hidden rounded-[2rem] px-8 py-10 shadow-2xl sm:px-12 mb-8" style={{ background: 'linear-gradient(to bottom right, var(--text-color), #1e293b, var(--text-color))', color: 'var(--bg-color)' }}>
            <p className="text-xs uppercase tracking-[0.35em]" style={{ color: 'var(--primary-color)' }}>Instructor panel</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Course management</h1>
            <p className="mt-4 max-w-xl text-sm sm:text-base" style={{ color: 'rgba(255,255,255,0.7)' }}>Create, edit, publish and organise your courses, modules and lessons from one place.</p>
          </section>
          {/* Alerts */}
          {error && (
            <div className="w-full max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700 mb-4">
              {error}
              <button type="button" onClick={() => setError('')} className="ml-4 font-semibold underline">Dismiss</button>
            </div>
          )}
          {success && (
            <div className="w-full max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700 mb-4">
              {success}
            </div>
          )}
          {/* Main content (tab content) */}
          <div className="w-full max-w-5xl">
            {/* TAB: COURSES LIST */}
            {tab === 'courses' && (
                type="text"
                placeholder="Search courses…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none transition"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-strong)', color: 'var(--text-color)' }}
                placeholder="Search courses…"
              />
              {(['all', 'draft', 'published'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${filterStatus === s ? '' : ''}`}
                  style={{
                    backgroundColor: filterStatus === s ? 'var(--primary-color)' : 'var(--surface-strong)',
                    color: filterStatus === s ? 'white' : 'var(--muted-color)'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="rounded-2xl p-10 text-center shadow-sm" style={{ backgroundColor: 'var(--card-color)', color: 'var(--muted-color)' }}>Loading courses…</div>
            ) : filteredCourses.length === 0 ? (
              <div className="rounded-2xl p-10 text-center shadow-sm" style={{ backgroundColor: 'var(--card-color)', color: 'var(--muted-color)' }}>
                {courses.length === 0 ? 'No courses yet. Create your first course!' : 'No courses match your filter.'}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredCourses.map((course) => (
                  <article key={course.id} className="group relative flex flex-col rounded-2xl border p-6 shadow-sm transition hover:shadow-md" style={{ backgroundColor: 'var(--card-color)', borderColor: 'var(--border-color)' }}>
                    {/* thumbnail */}
                    {course.thumbnail_url ? (
                      <div className="mb-4 h-36 overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--surface-strong)' }}>
                        <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="mb-4 flex h-36 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.1), rgba(6, 182, 212, 0.1))' }}>
                        <span className="text-4xl font-bold" style={{ color: 'var(--primary-color)', opacity: 0.5 }}>{course.title[0]}</span>
                      </div>
                    )}

                    {/* badges */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${course.is_published ? '' : ''}`}
                        style={{ backgroundColor: course.is_published ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: course.is_published ? '#22c55e' : '#f59e0b' }}>
                        {course.is_published ? 'Published' : 'Draft'}
                      </span>
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: 'var(--surface-strong)', color: 'var(--muted-color)' }}>
                        {course.level}
                      </span>
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: 'var(--surface-strong)', color: 'var(--muted-color)' }}>
                        {course.visibility}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold line-clamp-2" style={{ color: 'var(--text-color)' }}>{course.title}</h3>
                    <p className="mt-2 flex-1 text-sm line-clamp-2" style={{ color: 'var(--muted-color)' }}>{course.short_description || course.description || 'No description'}</p>

                    {/* meta */}
                    <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: 'var(--muted-color)' }}>
                      {course.average_rating > 0 && <span>★ {course.average_rating.toFixed(1)} ({course.review_count})</span>}
                      {course.duration_minutes ? <span>{course.duration_minutes} min</span> : null}
                      {course.category && <span>{course.category.name}</span>}
                    </div>

                    {/* actions */}
                    <div className="mt-5 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                      <button type="button" onClick={() => handleEdit(course)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)' }}>Edit</button>
                      <button type="button" onClick={() => openStructure(course.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>Structure</button>
                      <button type="button" onClick={() => handleTogglePublish(course)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                        {course.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" onClick={() => handleDelete(course.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition" style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB: CREATE / EDIT COURSE */}
        {(tab === 'create' || tab === 'edit') && (
          <section className="space-y-6">
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold">{editId ? 'Edit course' : 'Create a new course'}</h2>
              <p className="mt-1 text-sm text-slate-500">Fill in the details below. You can save as draft and publish later.</p>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {/* Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Course title *
                    <input type="text" value={form.title} onChange={(e) => handleTitleChange(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="e.g. Introduction to Machine Learning" />
                  </label>
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Slug
                    <input type="text" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="auto-generated-from-title" />
                  </label>
                </div>

                {/* Level */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Level
                    <select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as any }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                      {LEVELS.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
                    </select>
                  </label>
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Visibility
                    <select value={form.visibility} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as any }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                      {VISIBILITY.map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
                    </select>
                  </label>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Duration (minutes)
                    <input type="number" value={form.duration_minutes || ''} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" min="0" />
                  </label>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Price ($)
                    <input type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" min="0" step="0.01" />
                  </label>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Category
                    <select value={form.category_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value ? parseInt(e.target.value) : null }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                      <option value="">No category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                </div>

                {/* Thumbnail URL */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Thumbnail URL
                    <input type="url" value={form.thumbnail_url} onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="https://example.com/thumbnail.jpg" />
                  </label>
                </div>

                {/* Short description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Short description
                    <input type="text" value={form.short_description} onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="A brief tagline for the course card" />
                  </label>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Full description
                    <textarea rows={5} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="Detailed course description…" />
                  </label>
                </div>

                {/* Objectives */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Course objectives</label>
                  <div className="mt-2 flex gap-2">
                    <input type="text" value={objectiveInput} onChange={(e) => setObjectiveInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (objectiveInput.trim()) { setForm((f) => ({ ...f, objectives: [...(f.objectives || []), objectiveInput.trim()] })); setObjectiveInput(''); } } }} placeholder="Add an objective and press Enter" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400" />
                    <button type="button" onClick={() => { if (objectiveInput.trim()) { setForm((f) => ({ ...f, objectives: [...(f.objectives || []), objectiveInput.trim()] })); setObjectiveInput(''); } }} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Add</button>
                  </div>
                  {form.objectives && form.objectives.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {form.objectives.map((o, i) => (
                        <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span>✓ {o}</span>
                          <button type="button" onClick={() => setForm((f) => ({ ...f, objectives: f.objectives?.filter((_, idx) => idx !== i) }))} className="text-xs text-rose-500 hover:text-rose-700">Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Requirements */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Course requirements</label>
                  <div className="mt-2 flex gap-2">
                    <input type="text" value={requirementInput} onChange={(e) => setRequirementInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (requirementInput.trim()) { setForm((f) => ({ ...f, requirements: [...(f.requirements || []), requirementInput.trim()] })); setRequirementInput(''); } } }} placeholder="Add a requirement and press Enter" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400" />
                    <button type="button" onClick={() => { if (requirementInput.trim()) { setForm((f) => ({ ...f, requirements: [...(f.requirements || []), requirementInput.trim()] })); setRequirementInput(''); } }} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Add</button>
                  </div>
                  {form.requirements && form.requirements.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {form.requirements.map((r, i) => (
                        <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span>• {r}</span>
                          <button type="button" onClick={() => setForm((f) => ({ ...f, requirements: f.requirements?.filter((_, idx) => idx !== i) }))} className="text-xs text-rose-500 hover:text-rose-700">Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Tags</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tags.map((tag) => {
                        const selected = form.tag_ids?.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => setForm((f) => ({
                              ...f,
                              tag_ids: selected ? f.tag_ids?.filter((id) => id !== tag.id) : [...(f.tag_ids || []), tag.id],
                            }))}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Toggles */}
                <div className="md:col-span-2 flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked, status: e.target.checked ? 'published' : 'draft' }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                    Publish immediately
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                    Featured course
                  </label>
                </div>
              </div>

              {/* save */}
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={handleSaveCourse} disabled={saving || !form.title.trim()} className="rounded-full bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {saving ? 'Saving…' : editId ? 'Update course' : 'Create course'}
                </button>
                <button type="button" onClick={() => { setForm({ ...emptyForm }); setEditId(null); setTab('courses'); }} className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          </section>
        )}

        {/* TAB: COURSE STRUCTURE */}
        {tab === 'structure' && structure && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Course structure: {structure.title}</h2>
                <p className="mt-1 text-sm text-slate-500">Manage modules and lessons for this course.</p>
              </div>
              <button type="button" onClick={() => setTab('courses')} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">← Back to courses</button>
            </div>

            {/* Add module */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Add module</h3>
              <div className="mt-3 flex gap-2">
                <input type="text" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddModule(); }} placeholder="Module title" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400" />
                <button type="button" onClick={handleAddModule} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Add module</button>
              </div>
            </div>

            {/* Add lesson */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-sky-600">Add lesson</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <select value={lessonModuleId ?? ''} onChange={(e) => setLessonModuleId(e.target.value ? parseInt(e.target.value) : null)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400">
                  <option value="">Select module</option>
                  {structure.modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
                <input type="text" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddLesson(); }} placeholder="Lesson title" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400" />
                <select value={lessonContentType} onChange={(e) => { setLessonContentType(e.target.value); if (!['video_upload', 'audio', 'pdf', 'ppt', 'doc'].includes(e.target.value)) { setLessonFile(null); setVideoUrl(''); } }} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400">
                  <option value="video_upload">Video</option>
                  <option value="text">Text</option>
                  <option value="pdf">PDF</option>
                  <option value="html">HTML</option>
                  <option value="audio">Audio</option>
                  <option value="youtube_embed">YouTube</option>
                  <option value="vimeo_embed">Vimeo</option>
                  <option value="external_link">External link</option>
                  <option value="live_link">Live link</option>
                  <option value="iframe_embed">Iframe embed</option>
                </select>
                <input type="number" value={lessonDuration ?? ''} onChange={(e) => setLessonDuration(e.target.value ? parseInt(e.target.value) : null)} placeholder="Duration (min)" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400" min="0" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-3">
                  {lessonContentType !== 'video_upload' && (
                    <input type="text" value={lessonContentUrl} onChange={(e) => setLessonContentUrl(e.target.value)} placeholder={lessonContentType === 'youtube_embed' ? 'YouTube video ID' : lessonContentType === 'vimeo_embed' ? 'Vimeo video ID' : lessonContentType === 'iframe_embed' ? 'Iframe URL' : lessonContentType === 'text' || lessonContentType === 'html' ? 'Optional lesson text or HTML content' : 'Content URL / resource link'} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400" />
                  )}
                  {lessonContentType === 'video_upload' && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                      {uploading ? 'Uploading video...' : videoUrl ? 'Video uploaded successfully' : 'Select a video file above to upload'}
                    </div>
                  )}
                  {['video_upload', 'audio', 'pdf', 'ppt', 'doc'].includes(lessonContentType) && (
                    <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
                      <span className="text-xs text-slate-500">Upload file</span>
                      <input
                        type="file"
                        accept={lessonContentType === 'video_upload' ? 'video/*' : lessonContentType === 'audio' ? 'audio/*' : lessonContentType === 'pdf' ? 'application/pdf' : lessonContentType === 'ppt' ? '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation' : lessonContentType === 'doc' ? '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document' : undefined}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setLessonFile(file);
                          if (lessonContentType === 'video_upload' && file) {
                            handleFileUpload(file);
                          }
                        }}
                        className="mt-2 w-full text-sm text-slate-700"
                      />
                    </label>
                  )}
                  {lessonFile && (
                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">Selected file: {lessonFile.name}</div>
                  )}
                </div>
                <textarea value={lessonDescription} onChange={(e) => setLessonDescription(e.target.value)} placeholder="Lesson description or notes" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400" rows={1} />
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">📂 Study Materials</h3>
                    <p className="text-sm text-slate-500">Add one or more optional Google Drive links for students.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    type="url"
                    value={newLessonMaterial}
                    onChange={(e) => setNewLessonMaterial(e.target.value)}
                    placeholder="Paste Google Drive folder link"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={addLessonMaterial}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    + Add Material
                  </button>
                </div>
                {lessonMaterials.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <h4 className="text-sm font-semibold text-slate-900">Added materials</h4>
                    <ul className="mt-3 space-y-3">
                      {lessonMaterials.map((material, index) => (
                        <li key={index} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-sm text-slate-700 line-clamp-1">{material}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => window.open(material, '_blank')}
                              className="rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                            >
                              Open Folder
                            </button>
                            <button
                              type="button"
                              onClick={() => removeLessonMaterial(index)}
                              className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="mt-2">
                <p className="text-xs text-slate-500">Provide a source URL or ID for media lessons and optional description text for the lesson.</p>
              </div>
              <div className="mt-3">
                <button type="button" onClick={handleAddLesson} className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700">Add lesson</button>
              </div>
            </div>

            {/* Modules + lessons tree */}
            {structure.modules.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">No modules yet. Add your first module above.</div>
            ) : (
              <div className="space-y-4">
                {structure.modules.map((mod, mi) => (
                  <div key={mod.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {/* module header */}
                    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-sm font-bold text-indigo-700">{mi + 1}</span>
                        <h3 className="font-semibold text-slate-900">{mod.title}</h3>
                        <span className="text-xs text-slate-400">{mod.lessons.length} lesson{mod.lessons.length !== 1 ? 's' : ''}</span>
                      </div>
                      <button type="button" onClick={() => handleDeleteModule(mod.id)} className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100">Delete</button>
                    </div>

                    {/* lessons */}
                    {mod.lessons.length > 0 && (
                      <ul className="divide-y divide-slate-100 px-6">
                        {mod.lessons.map((lesson, li) => (
                          <li key={lesson.id} className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-medium text-slate-400">{mi + 1}.{li + 1}</span>
                              <div>
                                <p className="text-sm font-medium text-slate-800">{lesson.title}</p>
                                <div className="mt-0.5 flex gap-2">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{lesson.content_type.replace('_', ' ')}</span>
                                  {lesson.is_mandatory && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Required</span>}
                                  {lesson.is_locked && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">Locked</span>}
                                  {lesson.drip_enabled && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">Drip</span>}
                                  {lesson.duration_minutes ? <span className="text-[10px] text-slate-400">{lesson.duration_minutes} min</span> : null}
                                </div>
                              </div>
                            </div>
                            <button type="button" onClick={() => handleDeleteLesson(lesson.id)} className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100">Delete</button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {mod.lessons.length === 0 && (
                      <p className="px-6 py-4 text-sm text-slate-400">No lessons in this module yet.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB: ASSIGNMENTS */}
        {tab === 'assignments' && <InstructorAssignmentsPage />}

        {/* TAB: SUBMISSIONS */}
        {tab === 'submissions' && <InstructorSubmissionsPage />}

        {/* TAB: ANNOUNCEMENTS */}
        {tab === 'announcements' && <InstructorAnnouncementsPanel courses={courses} />}

        {/* TAB: LIVE CLASSES */}
        {tab === 'live_classes' && userId && <InstructorLiveClassesList instructorId={parseInt(userId)} />}

        {/* TAB: DISCUSSIONS */}
        {tab === 'discussions' && (
          <div className="rounded-[28px] border border-slate-200/70 bg-slate-50 p-6 text-center">
            <p className="text-slate-600">Redirecting to Discussions...</p>
          </div>
        )}

        {/* TAB: QUIZZES */}
        {tab === 'quizzes' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Create Quiz</h2>
                <p className="mt-1 text-sm text-slate-500">Create quizzes for your courses with multiple choice questions.</p>
              </div>
              <button type="button" onClick={() => setTab('courses')} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">← Back to courses</button>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Course Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Select Course *
                    <select value={selectedCourseForQuiz ?? ''} onChange={(e) => setSelectedCourseForQuiz(e.target.value ? parseInt(e.target.value) : null)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                      <option value="">Choose a course</option>
                      {courses.filter(c => c.is_published).map((course) => (
                        <option key={course.id} value={course.id}>{course.title}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Quiz Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Quiz Title *
                    <input type="text" value={quizForm.title} onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="e.g. Final Assessment" />
                  </label>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Description
                    <textarea value={quizForm.description} onChange={(e) => setQuizForm((f) => ({ ...f, description: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" rows={2} placeholder="Optional quiz description" />
                  </label>
                </div>

                {/* Time Limit */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Time Limit (minutes)
                    <input type="number" value={quizForm.time_limit_minutes || ''} onChange={(e) => setQuizForm((f) => ({ ...f, time_limit_minutes: parseInt(e.target.value) || 0 }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" min="0" />
                  </label>
                </div>

                {/* Max Attempts */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Max Attempts
                    <input type="number" value={quizForm.max_attempts} onChange={(e) => setQuizForm((f) => ({ ...f, max_attempts: parseInt(e.target.value) || 1 }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" min="1" />
                  </label>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Due Date
                    <input type="datetime-local" value={quizForm.due_date} onChange={(e) => setQuizForm((f) => ({ ...f, due_date: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  </label>
                </div>

                {/* Passing Score */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Passing Score (%)
                    <input type="number" value={quizForm.pass_percentage || ''} onChange={(e) => setQuizForm((f) => ({ ...f, pass_percentage: parseInt(e.target.value) || 0 }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" min="0" max="100" />
                  </label>
                </div>

                {/* Publish Toggle */}
                <div className="md:col-span-2">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={quizForm.published} onChange={(e) => setQuizForm((f) => ({ ...f, published: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                    <span className="text-sm font-medium text-slate-700">Publish this quiz (make it visible to students)</span>
                  </label>
                </div>
              </div>

              {/* Questions */}
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Questions</h3>
                  <button type="button" onClick={addQuizQuestion} className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Add Question</button>
                </div>

                <div className="mt-4 space-y-6">
                  {quizForm.questions.map((question, questionIndex) => (
                    <div key={questionIndex} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-4">
                          {/* Question Text */}
                          <div>
                            <label className="block text-sm font-medium text-slate-700">
                              Question {questionIndex + 1} *
                              <input type="text" value={question.text} onChange={(e) => handleQuizQuestionChange(questionIndex, 'text', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="Enter your question" />
                            </label>
                          </div>

                          {/* Choices */}
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Choices</label>
                            <div className="space-y-2">
                              {question.choices?.map((choice, choiceIndex) => (
                                <div key={choiceIndex} className="flex items-center gap-2">
                                  <input type="radio" name={`correct-${questionIndex}`} checked={question.correct_answer === choice} onChange={() => handleQuizQuestionChange(questionIndex, 'correct_answer', choice)} className="h-4 w-4 text-indigo-600" />
                                  <input type="text" value={choice} onChange={(e) => handleQuizChoiceChange(questionIndex, choiceIndex, e.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder={`Choice ${choiceIndex + 1}`} />
                                  {question.choices && question.choices.length > 1 && (
                                    <button type="button" onClick={() => removeQuizChoice(questionIndex, choiceIndex)} className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100">×</button>
                                  )}
                                </div>
                              ))}
                              <button type="button" onClick={() => addQuizChoice(questionIndex)} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200">+ Add Choice</button>
                            </div>
                          </div>

                          {/* Points */}
                          <div className="flex items-center gap-4">
                            <label className="block text-sm font-medium text-slate-700">
                              Points
                              <input type="number" value={question.points} onChange={(e) => handleQuizQuestionChange(questionIndex, 'points', parseInt(e.target.value) || 1)} className="mt-1 w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" min="1" />
                            </label>
                          </div>
                        </div>

                        {/* Remove Question */}
                        {quizForm.questions.length > 1 && (
                          <button type="button" onClick={() => removeQuizQuestion(questionIndex)} className="ml-4 rounded-lg bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-600 transition hover:bg-rose-100">Remove</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={handleCreateQuiz} disabled={saving || !selectedCourseForQuiz || !quizForm.title.trim()} className="rounded-full bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {saving ? 'Creating…' : 'Create Quiz'}
                </button>
                <button type="button" onClick={() => { setQuizForm({ course_id: 0, title: '', description: '', total_points: 0, passing_score: 0, pass_percentage: 0, time_limit_minutes: 0, randomize_questions: false, question_count: 0, max_attempts: 1, auto_grade_enabled: true, published: true, due_date: '', questions: [{ text: '', question_type: 'multiple_choice', choices: [''], correct_answer: '', points: 1 }] }); setSelectedCourseForQuiz(null); }} className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Reset
                </button>
              </div>
            </div>

            {/* Quiz List */}
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold">Your Quizzes</h3>
                  <p className="mt-1 text-sm text-slate-500">Manage and publish your quizzes</p>
                </div>
                <button type="button" onClick={loadQuizzes} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Refresh
                </button>
              </div>

              {quizzes.length > 0 ? (
                <div className="space-y-3">
                  {quizzes.map((quiz) => (
                    <div key={quiz.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{quiz.title}</h4>
                        {quiz.description && (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{quiz.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>{quiz.total_points || 0} points</span>
                          {quiz.time_limit_minutes && <span>{quiz.time_limit_minutes} min</span>}
                          <span className={`px-2 py-1 rounded ${quiz.published ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                            {quiz.published ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await updateQuiz(quiz.id, { published: !quiz.published });
                            flash(quiz.published ? 'Quiz unpublished.' : 'Quiz published.');
                            await loadQuizzes();
                          } catch (err: any) {
                            const detail = err?.response?.data?.detail;
                            setError(typeof detail === 'string' ? detail : 'Failed to update quiz.');
                          }
                        }}
                        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                          quiz.published
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {quiz.published ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500">No quizzes yet. Create one to get started!</p>
              )}
            </div>
          </section>
        )}

        {/* TAB: QUIZ RESULTS                                   */}
        {tab === 'results' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Quiz Results</h2>
                <p className="mt-1 text-sm text-slate-500">View student quiz attempts and performance across all your courses.</p>
              </div>
              <button type="button" onClick={() => setTab('courses')} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">← Back to courses</button>
            </div>

            {loadingResults ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <p className="text-slate-500">Loading quiz results…</p>
              </div>
            ) : quizResults.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <p className="text-slate-500">No quiz attempts found yet.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Student</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Course</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Quiz</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Score</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Attempt</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {quizResults.map((result) => (
                        <tr key={result.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-900">{result.student_name || 'Unknown'}</td>
                          <td className="px-6 py-4 text-sm text-slate-900">{result.course_title || 'Unknown'}</td>
                          <td className="px-6 py-4 text-sm text-slate-900">{result.quiz_title || 'Unknown'}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 font-semibold">{Math.round(result.score)} pts</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              result.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {result.passed ? 'Passed' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900">#{result.attempt_number}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {result.completed_at ? new Date(result.completed_at).toLocaleDateString() : 'In progress'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
