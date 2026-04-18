'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLiveClass, updateLiveClass, LiveClass, CreateLiveClassPayload, UpdateLiveClassPayload } from '@/services/live_classes';

function pad(num: number) {
  return String(num).padStart(2, '0');
}

function toLocalDatetimeInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function parseDateTimeValue(value: string): string | null {
  const cleanValue = value.trim();

  // Attempt to parse native local datetime-local input values first.
  const parsed = new Date(cleanValue);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const ddmmyyyyMatch = cleanValue.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year, hour, minute, second] = ddmmyyyyMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? '00'));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

interface LiveClassFormProps {
  courseName: string;
  liveClass?: LiveClass;
  onSuccess?: () => void;
}

const PLATFORMS = [
  { label: 'Internal Live Class', value: 'internal' },
];

export default function LiveClassForm({ courseName, liveClass, onSuccess }: LiveClassFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: liveClass?.title || '',
    description: liveClass?.description || '',
    start_time: liveClass
      ? toLocalDatetimeInputValue(new Date(liveClass.scheduled_at))
      : toLocalDatetimeInputValue(new Date()),
    duration: liveClass?.duration_minutes || 60,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'duration' ? parseInt(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const startTimeIso = parseDateTimeValue(formData.start_time);
      if (!startTimeIso) {
        setError('Please enter a valid start time in ISO format or DD-MM-YYYY HH:MM.');
        setLoading(false);
        return;
      }

      const payload: CreateLiveClassPayload | UpdateLiveClassPayload = {
        course_name: courseName,
        title: formData.title,
        description: formData.description || undefined,
        start_time: startTimeIso,
        duration: formData.duration,
      };

      if (liveClass) {
        await updateLiveClass(liveClass.id, payload as UpdateLiveClassPayload);
      } else {
        await createLiveClass(payload as CreateLiveClassPayload);
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save live class');
      console.error('Error saving live class:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">{liveClass ? 'Edit Live Class' : 'Schedule New Live Class'}</h2>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Advanced React Patterns"
            required
            maxLength={255}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Optional description of the live class"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              name="start_time"
              value={formData.start_time}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              min={5}
              max={480}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

        {/* Form Actions */}
      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition"
        >
          {loading ? 'Saving...' : liveClass ? 'Update Live Class' : 'Schedule Live Class'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-md transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
