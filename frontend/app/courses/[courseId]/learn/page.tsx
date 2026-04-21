'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchCourse, fetchCourseStructure } from '@/services/courses';
import { getEnrollment } from '@/services/instructor';
import type { CourseDetails, CourseStructure, Lesson } from '@/types/course';
import type { EnrollmentData } from '@/services/instructor';
import { useAuth } from '@/hooks/useAuth';
import ChatBot from '@/components/ChatBot';

interface LessonWithModule extends Lesson {
  module_title: string;
}

export default function CourseLearnPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const rawCourseId = params.courseId ?? params.courseid;
  const courseId = Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId;
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [structure, setStructure] = useState<CourseStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [moduleLessons, setModuleLessons] = useState<LessonWithModule[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<LessonWithModule | null>(null);

  useEffect(() => {
    if (!courseId) {
      router.push('/courses');
      return;
    }

    async function loadData() {
      try {
        const [courseData, enrollmentData] = await Promise.all([
          fetchCourse(courseId),
          getEnrollment(parseInt(courseId, 10))
        ]);

        if (!enrollmentData) {
          setError('You must be enrolled in this course to access the learning materials.');
          setLoading(false);
          return;
        }

        setCourse(courseData);
        setEnrollment(enrollmentData);

        const structureData = await fetchCourseStructure(courseId);
        setStructure(structureData);

        // Set first module as selected
        if (structureData.modules.length > 0) {
          setSelectedModuleId(structureData.modules[0].id);
          // Load lessons for the first module
          const firstModule = structureData.modules[0];
          const lessonsForModule = firstModule.lessons.map(lesson => ({
            ...lesson,
            module_title: firstModule.title,
          }));
          setModuleLessons(lessonsForModule);
          // Auto-select first lesson
          if (lessonsForModule.length > 0) {
            setSelectedLesson(lessonsForModule[0]);
          }
        }

      } catch (err) {
        setError('Failed to load course data.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [courseId, router]);

  // Load lessons when selectedModuleId changes
  useEffect(() => {
    if (selectedModuleId && structure) {
      const selectedModule = structure.modules.find(module => module.id === selectedModuleId);
      if (selectedModule) {
        const lessonsForModule = selectedModule.lessons.map(lesson => ({
          ...lesson,
          module_title: selectedModule.title,
        }));
        setModuleLessons(lessonsForModule);
        // Auto-select first lesson in the module
        if (lessonsForModule.length > 0) {
          setSelectedLesson(lessonsForModule[0]);
        } else {
          setSelectedLesson(null);
        }
      }
    }
  }, [selectedModuleId, structure]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-6xl text-center text-slate-500">
          Loading course...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50 p-10 text-rose-700">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">{course?.title}</h1>
          <p className="mt-2 text-slate-600">Learn at your own pace</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
          {/* Lessons List */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Course Content</h2>

            {/* Module Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {structure?.modules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => setSelectedModuleId(module.id)}
                  className={`px-3 py-2 text-sm rounded-lg transition ${
                    selectedModuleId === module.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {module.title}
                </button>
              ))}
            </div>

            {/* Lessons for selected module */}
            <div className="space-y-2">
              {moduleLessons.map((lesson, index) => (
                <div
                  key={`${lesson.module_id}-${index}`}
                  onClick={() => setSelectedLesson(lesson)}
                  className={`cursor-pointer rounded-lg border p-4 transition ${
                    selectedLesson?.title === lesson.title
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <h3 className="font-medium">{lesson.title}</h3>
                  <p className="text-sm text-slate-500">{lesson.duration_minutes || 0} min</p>
                </div>
              ))}
            </div>
          </div>

          {/* Video Player */}
          <div className="space-y-4">
            {selectedLesson ? (
              <>
                <h2 className="text-xl font-semibold">{selectedLesson.title}</h2>
                {selectedLesson.video_url ? (
                  <div className="aspect-video w-full">
                    <video
                      controls
                      className="h-full w-full rounded-lg"
                      src={selectedLesson.video_url}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                ) : (
                  <div className="aspect-video w-full rounded-lg bg-slate-100 flex items-center justify-center">
                    <p className="text-slate-500">Video not available</p>
                  </div>
                )}
                {selectedLesson.content && (
                  <div className="rounded-lg bg-white p-4">
                    <h3 className="font-medium mb-2">Description</h3>
                    <p className="text-slate-600">{selectedLesson.content}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="aspect-video w-full rounded-lg bg-slate-100 flex items-center justify-center">
                <p className="text-slate-500">Select a lesson to start learning</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {role === 'student' && <ChatBot />}
    </main>
  );
}