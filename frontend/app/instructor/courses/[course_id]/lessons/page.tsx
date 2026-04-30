'use client';

import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchCourse,
  fetchCourseStructure,
  createLesson,
  updateLesson,
  deleteLesson,
  createModule,
  type CourseData,
  type ModuleData,
  type LessonData,
} from '@/services/instructor';
import type { CourseStructure } from '@/types/course';

interface StudyMaterial {
  title: string;
  url: string;
}

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

export default function LessonManagementPage() {
  const { authenticated, role } = useAuth();
  const router = useRouter();
  const params = useParams();
  const courseId = parseInt(params?.course_id as string ?? '0');

  const [course, setCourse] = useState<CourseData | null>(null);
  const [structure, setStructure] = useState<CourseStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  /* ── Form state ─────────────────────────────────────────── */
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([
    { title: '', url: '' },
  ]);
  
  /* ── Module state ───────────────────────────────────────── */
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);

  /* ── View/Edit modal state ──────────────────────────────── */
  const [viewingLesson, setViewingLesson] = useState<LessonData | null>(null);
  const [editingLesson, setEditingLesson] = useState<LessonData | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editStudyMaterials, setEditStudyMaterials] = useState<StudyMaterial[]>([]);

  const isInstructor = role && ['instructor', 'organization_admin', 'super_admin', 'admin'].includes(role);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadError('');
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
    } catch (error) {
      setUploadError('Failed to upload video. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const emptyMaterial = { title: '', url: '' };

  const getValidMaterials = (materials: StudyMaterial[]) =>
    materials
      .map((material) => ({
        title: material.title.trim(),
        url: material.url.trim(),
      }))
      .filter((material) => material.title && material.url);

  const setLessonMaterials = (materials: StudyMaterial[]) => {
    setStudyMaterials(materials.length > 0 ? materials : [{ ...emptyMaterial }]);
  };

  const setEditingMaterials = (materials: StudyMaterial[]) => {
    setEditStudyMaterials(materials.length > 0 ? materials : [{ ...emptyMaterial }]);
  };

  const addLessonMaterial = () => {
    setStudyMaterials((current) => [...current, { ...emptyMaterial }]);
  };

  const updateLessonMaterial = (index: number, field: 'title' | 'url', value: string) => {
    setStudyMaterials((current) =>
      current.map((material, idx) => (idx === index ? { ...material, [field]: value } : material)),
    );
  };

  const removeLessonMaterial = (index: number) => {
    setStudyMaterials((current) => current.filter((_, idx) => idx !== index));
  };

  const addEditMaterial = () => {
    setEditStudyMaterials((current) => [...current, { ...emptyMaterial }]);
  };

  const updateEditMaterial = (index: number, field: 'title' | 'url', value: string) => {
    setEditStudyMaterials((current) =>
      current.map((material, idx) => (idx === index ? { ...material, [field]: value } : material)),
    );
  };

  const removeEditMaterial = (index: number) => {
    setEditStudyMaterials((current) => current.filter((_, idx) => idx !== index));
  };

  const getMaterialsFromLesson = (lesson: LessonData): StudyMaterial[] => {
    const payload = lesson.content_payload as any;
    if (!payload?.resources || !Array.isArray(payload.resources)) {
      return [{ ...emptyMaterial }];
    }
    return payload.resources.map((resource: any) => ({
      title: String(resource.title || ''),
      url: String(resource.url || ''),
    }));
  };

  /* ── Load course and structure ──────────────────────────── */
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [courseData, structureData] = await Promise.all([
        fetchCourse(courseId),
        fetchCourseStructure(courseId),
      ]);
      setCourse(courseData);
      setStructure(structureData);
      setModules(structureData.modules);
      
      // Auto-select first module or create default module
      if (structureData.modules.length > 0) {
        setSelectedModuleId(structureData.modules[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load course.'));
    } finally {
      setLoading(false);
    }
  };

  /* ── Create default module if needed ────────────────────── */
  const ensureDefaultModule = async () => {
    if (modules.length === 0) {
      try {
        const newModule = await createModule({
          course_id: courseId,
          title: 'Lessons',
        });
        const updatedStructure = await fetchCourseStructure(courseId);
        setStructure(updatedStructure);
        setModules(updatedStructure.modules);
        setSelectedModuleId(newModule.id);
        return newModule.id;
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to create lessons module.'));
        return null;
      }
    }
    return selectedModuleId || modules[0]?.id || null;
  };

  useEffect(() => {
    if (authenticated && isInstructor) {
      loadData();
    }
  }, [authenticated, isInstructor, courseId]);

  /* ── Extract vimeo ID from URL ──────────────────────────– */
  const extractVimeoId = (url: string): string | null => {
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? match[1] : null;
  };

  /* ── Extract vimeo ID from lesson content_payload ───────– */
  const getVimeoIdFromLesson = (lesson: LessonData): string | null => {
    if (lesson.content_type === 'vimeo_embed') {
      const payload = lesson.content_payload as any;
      if (payload?.vimeo_id) return payload.vimeo_id;
    }
    return null;
  };

  const handleAddLesson = async () => {
    // Validation: Allow if title exists
    if (!lessonTitle.trim()) {
      setError('Please enter a lesson title.');
      return;
    }

    // Allow if (video/file) OR (at least one study material)
    const validResources = getValidMaterials(studyMaterials);
    const hasVideo = videoUrl.trim() || lessonFile;
    const hasMaterial = validResources.length > 0;
    if (!hasVideo && !hasMaterial) {
      setError('Please provide a video URL, upload a video file, or add at least one study material.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      let moduleId = selectedModuleId;
      if (!moduleId) {
        moduleId = await ensureDefaultModule();
        if (!moduleId) return;
      }

      // Use the proper service function instead of direct fetch
      // Allow either videoUrl OR lessonFile (not both required)
      const contentPayload: any = {
        file_url: videoUrl,
        resources: validResources.length > 0 ? validResources : undefined,
      };

      await createLesson({
        course_id: courseId,
        module_id: moduleId,
        title: lessonTitle.trim(),
        content: lessonDescription.trim() || '',
        content_type: 'video_upload',
        content_payload: contentPayload,
        duration_minutes: 0,
      });

      flash('Lesson added successfully.');
      setLessonTitle('');
      setLessonDescription('');
      setVideoUrl('');
      setLessonMaterials([{ ...emptyMaterial }]);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add lesson.'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditLesson = async () => {
    if (!editingLesson || !editTitle.trim()) {
      setError('Please enter a lesson title.');
      return;
    }

    let payload: any = {
      title: editTitle.trim(),
      content: editDescription.trim() || undefined,
    };

    const validEditResources = getValidMaterials(editStudyMaterials);
    const existingPayload = (editingLesson?.content_payload as any) ?? {};
    const nextPayload = { ...existingPayload, ...(validEditResources.length > 0 ? { resources: validEditResources } : {}) };

    if (editVideoUrl.trim()) {
      const vimeoId = extractVimeoId(editVideoUrl);
      if (!vimeoId) {
        setError('Invalid Vimeo URL.');
        return;
      }
      payload.content_type = 'vimeo_embed';
      nextPayload.vimeo_id = vimeoId;
    }

    if (Object.keys(nextPayload).length > 0) {
      payload.content_payload = nextPayload;
    }

    setSaving(true);
    setError('');
    try {
      await updateLesson(editingLesson.id, payload);
      flash('Lesson updated successfully.');
      setEditingLesson(null);
      setViewingLesson(null);
      setEditStudyMaterials([{ ...emptyMaterial }]);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update lesson.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (!confirm('Delete this lesson? This action cannot be undone.')) return;

    setError('');
    try {
      await deleteLesson(lessonId);
      flash('Lesson deleted.');
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete lesson.'));
    }
  };

  const handleViewLesson = (lesson: LessonData) => {
    setViewingLesson(lesson);
    setEditingLesson(null);
  };

  const handleEditClick = (lesson: LessonData) => {
    setEditingLesson(lesson);
    setEditTitle(lesson.title);
    setEditDescription(lesson.content || '');
    setEditVideoUrl(''); // Will show current vimeo ID in display
    setEditingMaterials(getMaterialsFromLesson(lesson));
    setViewingLesson(null);
  };

  /* ── Guard ──────────────────────────────────────────────── */
  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50 p-10 text-rose-700">
          Please sign in to manage lessons.
        </div>
      </main>
    );
  }

  if (!isInstructor) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-amber-200 bg-amber-50 p-10 text-amber-800">
          <p className="font-semibold">Access restricted</p>
          <p className="mt-2 text-sm">Only instructors and administrators can access this page.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-6xl text-center text-slate-500">
          Loading lessons...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <div className="w-full space-y-8">

        {/* ── Header ─────────────────────────────────────── */}
        <section className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 mb-4"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-semibold text-slate-900">
              {course?.title || 'Course'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">Manage lessons and Vimeo videos for this course</p>
          </div>
        </section>

        {/* ── Alerts ─────────────────────────────────────── */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
            {error}
            <button type="button" onClick={() => setError('')} className="ml-4 font-semibold underline">Dismiss</button>
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {/* ── Add Lesson Form ────────────────────────────────── */}
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Add New Lesson</h2>
          <p className="text-sm text-slate-500 mb-6">Create a lesson and upload a video</p>

          <div className="space-y-4">
            {/* Lesson Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Lesson Title *
              </label>
              <input
                type="text"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="e.g. Introduction to Video Editing"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Lesson Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={lessonDescription}
                onChange={(e) => setLessonDescription(e.target.value)}
                placeholder="Optional lesson description or learning objectives"
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Video Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Upload Video *
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              {uploading && (
                <p className="mt-2 text-sm text-blue-600">Uploading video...</p>
              )}
              {uploadError && (
                <p className="mt-2 text-sm text-red-600">{uploadError}</p>
              )}
              {videoUrl && !uploading && (
                <p className="mt-2 text-sm text-green-600">Video uploaded successfully</p>
              )}
            </div>

            {/* Study Materials */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Study materials</p>
                  <p className="text-sm text-slate-500">Add reference links, downloads, and supplemental resources for this lesson.</p>
                </div>
                <button
                  type="button"
                  onClick={addLessonMaterial}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Add material
                </button>
              </div>
              {studyMaterials.map((material, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={material.title}
                      onChange={(e) => updateLessonMaterial(index, 'title', e.target.value)}
                      placeholder="Resource title (e.g. Slides, Cheat sheet)"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <input
                      type="url"
                      value={material.url}
                      onChange={(e) => updateLessonMaterial(index, 'url', e.target.value)}
                      placeholder="Resource URL or download link"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLessonMaterial(index)}
                    className="self-end rounded-full bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={handleAddLesson}
              disabled={saving || uploading || !lessonTitle.trim() || !videoUrl.trim()}
              className="rounded-full bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? 'Adding…' : 'Add Lesson'}
            </button>
          </div>
        </section>

        {/* ── Lessons List ────────────────────────────────────– */}
        <section className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold">Lessons ({structure?.modules.reduce((acc, m) => acc + m.lessons.length, 0) || 0})</h2>
          </div>

          {structure && structure.modules.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500">
              No lessons yet. Add your first lesson above.
            </div>
          ) : structure ? (
            <div className="divide-y divide-slate-100">
              {structure.modules.map((module) => (
                <div key={module.id}>
                  {/* Module Header */}
                  <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-600">{module.title}</p>
                  </div>

                  {/* Lessons in Module */}
                  {module.lessons.length === 0 ? (
                    <div className="px-6 py-4 text-sm text-slate-500">No lessons in this module</div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {module.lessons.map((lesson, idx) => (
                        <li key={lesson.id} className="px-6 py-4 hover:bg-slate-50 transition">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-sm font-bold text-indigo-700">{idx + 1}</span>
                                <div>
                                  <h3 className="font-semibold text-slate-900">{lesson.title}</h3>
                                  {lesson.content && (
                                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">{lesson.content}</p>
                                  )}
                                  {getVimeoIdFromLesson(lesson) && (
                                    <p className="mt-1 text-xs text-slate-400">Vimeo: {getVimeoIdFromLesson(lesson)}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleViewLesson(lesson)}
                                className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditClick(lesson)}
                                className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(lesson.id)}
                                className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* ── View Lesson Modal ──────────────────────────────– */}
        {viewingLesson && !editingLesson && (
          <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-lg">
              {/* Modal Header */}
              <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{viewingLesson.title}</h2>
                <button
                  type="button"
                  onClick={() => setViewingLesson(null)}
                  className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-6 space-y-4">
                {/* Video Player */}
                {getVimeoIdFromLesson(viewingLesson) && (
                  <div className="rounded-xl overflow-hidden bg-slate-900">
                    <iframe
                      src={`https://player.vimeo.com/video/${getVimeoIdFromLesson(viewingLesson)}`}
                      width="100%"
                      height="400"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      className="rounded-xl"
                    />
                  </div>
                )}

                {/* Description */}
                {viewingLesson.content && (
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">Description</h3>
                    <p className="text-slate-700 whitespace-pre-wrap">{viewingLesson.content}</p>
                  </div>
                )}

                {/* Study Materials */}
                {Array.isArray((viewingLesson.content_payload as any)?.resources) && (viewingLesson.content_payload as any).resources.length > 0 ? (
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">Study materials</h3>
                    <ul className="space-y-3">
                      {((viewingLesson.content_payload as any).resources as any[]).map((resource, idx) => (
                        <li key={idx}>
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span>{resource.title || resource.url}</span>
                              <span className="text-slate-500">Open</span>
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Lesson Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {viewingLesson.duration_minutes && (
                    <div>
                      <p className="text-slate-500">Duration</p>
                      <p className="font-medium">{viewingLesson.duration_minutes} minutes</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-500">Type</p>
                    <p className="font-medium capitalize">{viewingLesson.content_type.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-100 px-6 py-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => handleEditClick(viewingLesson)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setViewingLesson(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Edit Lesson Modal ──────────────────────────────– */}
        {editingLesson && (
          <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-lg">
              {/* Modal Header */}
              <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Edit Lesson</h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLesson(null);
                    setEditTitle('');
                    setEditDescription('');
                    setEditVideoUrl('');
                  }}
                  className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Lesson Title *
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* Current Vimeo ID Display */}
                {getVimeoIdFromLesson(editingLesson) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Current Vimeo ID
                    </label>
                    <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700">
                      {getVimeoIdFromLesson(editingLesson)}
                    </div>
                  </div>
                )}

                {/* Study Materials */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Study materials</p>
                      <p className="text-sm text-slate-500">Keep lesson resources available while you edit the lesson.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addEditMaterial}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Add material
                    </button>
                  </div>
                  {editStudyMaterials.map((material, index) => (
                    <div key={index} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={material.title}
                          onChange={(e) => updateEditMaterial(index, 'title', e.target.value)}
                          placeholder="Resource title"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                        <input
                          type="url"
                          value={material.url}
                          onChange={(e) => updateEditMaterial(index, 'url', e.target.value)}
                          placeholder="Resource URL"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEditMaterial(index)}
                        className="self-end rounded-full bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                {/* New Vimeo URL (optional) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Change Vimeo Link (leave blank to keep current)
                  </label>
                  <input
                    type="url"
                    value={editVideoUrl}
                    onChange={(e) => setEditVideoUrl(e.target.value)}
                    placeholder="https://player.vimeo.com/video/..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-100 px-6 py-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleEditLesson}
                  disabled={saving || !editTitle.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLesson(null);
                    setEditTitle('');
                    setEditDescription('');
                    setEditVideoUrl('');
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
