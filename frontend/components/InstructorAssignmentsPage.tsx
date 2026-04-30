import { useCallback, useEffect, useState } from 'react';
import AssignmentCreateForm from '@/components/AssignmentCreateForm';
import type { AssignmentPayload } from '@/types/assignment';
import type { CourseData } from '@/services/instructor';
import { fetchInstructorCourses } from '@/services/instructor';
import { createAssignmentWithFiles } from '@/services/assignments';

export default function InstructorAssignmentsPage() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState<AssignmentPayload>({
    course_id: 0,
    title: '',
    instructions: '',
    due_date: '',
    max_score: 100,
    allow_late_submission: false,
    published: true,
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchInstructorCourses();
      setCourses(data);
    } catch (err) {
      setError('Failed to load courses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await createAssignmentWithFiles(form, files || undefined);
      setSuccess('Assignment created successfully!');
      setForm({
        course_id: 0,
        title: '',
        instructions: '',
        due_date: '',
        max_score: 100,
        allow_late_submission: false,
        published: true,
      });
      setFiles(null);
    } catch (err) {
      setError('Failed to create assignment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">Loading courses…</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Create Assignment</h2>
          <p className="mt-1 text-sm text-slate-500">Create assignments for your courses with due dates and submission requirements.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <AssignmentCreateForm
          courses={courses}
          form={form}
          files={files}
          saving={saving}
          error={error}
          message={success}
          onChange={setForm}
          onFilesChange={setFiles}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  );
}