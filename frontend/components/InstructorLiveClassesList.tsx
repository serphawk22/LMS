'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listLiveClasses, deleteLiveClass, LiveClass } from '@/services/live_classes';
import { useRouter } from 'next/navigation';

interface InstructorLiveClassesListProps {
  courseName?: string;
  instructorId?: number;
}

export default function InstructorLiveClassesList({
  courseName,
  instructorId,
}: InstructorLiveClassesListProps) {
  const router = useRouter();
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    if (courseName || instructorId) {
      fetchLiveClasses();
    }
  }, [courseName, instructorId]);

  const fetchLiveClasses = async () => {
    if (!courseName && !instructorId) {
      setError('Course name or Instructor ID required');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const classes = await listLiveClasses(courseName, instructorId);
      setLiveClasses(classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live classes');
      console.error('Error fetching live classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    try {
      await deleteLiveClass(id);
      setLiveClasses((prev) => prev.filter((lc) => lc.id !== id));
      setDeleteConfirm(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete live class');
      console.error('Error deleting live class:', err);
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPlatform = (platform: string) => {
    const platformMap: { [key: string]: string } = {
      zoom: 'Zoom',
      google_meet: 'Google Meet',
      microsoft_teams: 'Microsoft Teams',
      manual: 'Manual Link',
    };
    return platformMap[platform] || platform;
  };

  const isUpcoming = (dateTime: string) => {
    return new Date(dateTime) > new Date();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading live classes...</div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>;
  }

  if (liveClasses.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500 mb-4">No live classes scheduled yet</p>
        <Link
          href={courseName ? `/dashboard/instructor/live-classes/create?course_name=${encodeURIComponent(courseName)}` : '/dashboard/instructor/live-classes/create'}
          className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md"
        >
          Schedule First Live Class
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {liveClasses.map((liveClass) => (
        <div
          key={liveClass.id}
          className={`p-4 border rounded-lg ${
            isUpcoming(liveClass.scheduled_at)
              ? 'border-blue-200 bg-blue-50'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800">{liveClass.title}</h3>
              {liveClass.description && (
                <p className="text-sm text-gray-600 mt-1">{liveClass.description}</p>
              )}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                isUpcoming(liveClass.scheduled_at)
                  ? 'bg-blue-200 text-blue-800'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {isUpcoming(liveClass.scheduled_at) ? 'Upcoming' : 'Past'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600 mb-4">
            <div>
              <span className="font-medium">Date & Time</span>
              <p>{formatDateTime(liveClass.scheduled_at)}</p>
            </div>
            <div>
              <span className="font-medium">Duration</span>
              <p>{liveClass.duration_minutes} minutes</p>
            </div>
            <div>
              <span className="font-medium">Platform</span>
              <p>{formatPlatform(liveClass.provider)}</p>
            </div>
            <div>
              <span className="font-medium">Students</span>
              <p>See details</p>
            </div>
          </div>

          {/* Primary Action - Start Live Class */}
          {isUpcoming(liveClass.scheduled_at) && (
            <div className="mb-3">
              <button
                onClick={() => {
                  router.push(`/live-class/${liveClass.id}`);
                }}
                className="w-full text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg text-base transition shadow-md hover:shadow-lg"
              >
                Start Live Class
              </button>
            </div>
          )}

          {/* Secondary Actions */}
          <div className="flex gap-2">
            <Link
              href={`/dashboard/instructor/live-classes/${liveClass.id}`}
              className="flex-1 text-center bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-2 px-3 rounded text-sm transition"
            >
              View Details
            </Link>
            <Link
              href={`/dashboard/instructor/live-classes/${liveClass.id}/edit`}
              className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-3 rounded text-sm transition"
            >
              Edit
            </Link>
            <button
              onClick={() => handleDelete(liveClass.id)}
              className={`flex-1 text-white font-medium py-2 px-3 rounded text-sm transition ${
                deleteConfirm === liveClass.id
                  ? 'bg-red-700 hover:bg-red-800'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {deleteConfirm === liveClass.id ? 'Confirm Delete' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
