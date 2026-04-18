import type { FormEvent } from 'react';
import type { AssignmentPayload } from '@/types/assignment';
import type { CourseData } from '@/services/instructor';

interface AssignmentCreateFormProps {
  courses: CourseData[];
  form: AssignmentPayload;
  files: FileList | null;
  saving: boolean;
  error: string;
  message: string;
  onChange: (payload: AssignmentPayload) => void;
  onFilesChange: (files: FileList | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export default function AssignmentCreateForm({
  courses,
  form,
  files,
  saving,
  error,
  message,
  onChange,
  onFilesChange,
  onSubmit,
}: AssignmentCreateFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">{message}</div> : null}

      <div className="grid gap-6 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Course
          <select
            value={form.course_id || ''}
            onChange={(event) => onChange({ ...form, course_id: Number(event.target.value) })}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            required
          >
            <option value="">Select a course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Assignment title
          <input
            type="text"
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            required
          />
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Instructions
          <textarea
            value={form.instructions ?? ''}
            onChange={(event) => onChange({ ...form, instructions: event.target.value })}
            rows={4}
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Add assignment instructions or details for students"
          />
        </label>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Due date
          <input
            type="datetime-local"
            value={form.due_date ?? ''}
            onChange={(event) => onChange({ ...form, due_date: event.target.value })}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Max score
          <input
            type="number"
            value={form.max_score ?? ''}
            onChange={(event) => onChange({ ...form, max_score: Number(event.target.value) })}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            min="0"
          />
        </label>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.allow_late_submission ?? false}
            onChange={(event) => onChange({ ...form, allow_late_submission: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-sky-600"
          />
          Allow late submissions
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.published ?? false}
            onChange={(event) => onChange({ ...form, published: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-sky-600"
          />
          Publish assignment
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Attach instructional files
          <input
            type="file"
            multiple
            onChange={(event) => onFilesChange(event.target.files)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        {files && files.length > 0 ? (
          <p className="mt-2 text-sm text-slate-500">{files.length} file(s) ready to upload</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || !form.title.trim() || !form.course_id}
          className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? 'Creating…' : 'Create assignment'}
        </button>
      </div>
    </form>
  );
}
