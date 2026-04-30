'use client';

import type { Lesson, Module } from '@/types/course';

interface CourseNavigationProps {
  modules: Module[];
  currentLessonId: number;
  onNavigate: (lessonId: number) => void;
}

export default function CourseNavigation({ modules, currentLessonId, onNavigate }: CourseNavigationProps) {
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40 lg:sticky lg:top-24 lg:max-h-[calc(100vh-10rem)] lg:overflow-auto">
      <h2 className="text-lg font-semibold text-slate-900">Course lessons</h2>
      <p className="mt-2 text-sm text-slate-600">Browse modules and jump to a lesson at any time.</p>

      <div className="mt-6 space-y-6">
        {modules.map((module) => (
          <div key={module.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Module</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">{module.title}</h3>
              </div>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">{module.lessons.length} lessons</span>
            </div>

            <div className="mt-4 space-y-2">
              {module.lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => onNavigate(lesson.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                    lesson.id === currentLessonId
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-200/50'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate">{lesson.title}</span>
                  <span className="ml-4 rounded-full border px-2 py-0.5 text-xs font-semibold text-slate-500">{lesson.position}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
