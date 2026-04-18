'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { createAssignmentWithFiles } from '@/services/assignments';
import { fetchInstructorCourses } from '@/services/instructor';
import type { AssignmentPayload } from '@/types/assignment';
import type { CourseData } from '@/services/instructor';
import AssignmentCreateForm from '@/components/AssignmentCreateForm';

export default function CreateAssignmentPage() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [form, setForm] = useState<AssignmentPayload>({
    course_id: 0,
    title: '',
    instructions: '',
    due_date: '',
    max_score: 0,
    published: false,
    allow_late_submission: false,
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCourses() {
      try {
        const data = await fetchInstructorCourses();
        setCourses(data);
        if (data.length && !form.course_id) {
          setForm((current) => ({ ...current, course_id: data[0].id }));
        }
      } catch {
        setError('Unable to load courses.');
      }
    }
    loadCourses();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await createAssignmentWithFiles(form, files || undefined);
      setMessage('Assignment created successfully.');
      setForm({ course_id: 0, title: '', instructions: '', due_date: '', max_score: 0, published: false, allow_late_submission: false });
      setFiles(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create assignment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-8">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Instructor assignments</p>
            <h1 className="text-3xl font-semibold">Create new assignment</h1>
            <p className="text-slate-600">Publish assignment tasks for enrolled students and track submissions.</p>
          </div>

          <AssignmentCreateForm
            courses={courses}
            form={form}
            files={files}
            saving={saving}
            error={error}
            message={message}
            onChange={setForm}
            onFilesChange={setFiles}
            onSubmit={handleSubmit}
          />
        </section>
      </div>
    </main>
  );
}
