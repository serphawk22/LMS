'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getLiveClass, LiveClass } from '@/services/live_classes';
import RecordingUpload from '@/components/RecordingUpload';
import RecordingList from '@/components/RecordingList';

interface LiveClassDetailProps {
  params: {
    id: string;
  };
}

export default function LiveClassDetailPage({ params }: LiveClassDetailProps) {
  const router = useRouter();
  const [liveClass, setLiveClass] = useState<LiveClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLiveClass();
  }, [params.id]);

  const fetchLiveClass = async () => {
    try {
      setLoading(true);
      const lc = await getLiveClass(parseInt(params.id));
      setLiveClass(lc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live class');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="text-[var(--muted-color)]">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>
      </div>
    );
  }

  if (!liveClass) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="p-4 bg-gray-100 text-gray-700 rounded">Live class not found</div>
      </div>
    );
  }

  const isUpcoming = new Date(liveClass.scheduled_at) > new Date();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-500 hover:text-blue-700 font-medium flex items-center gap-2 mb-4"
          >
            ← Back
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800">{liveClass.title}</h1>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                isUpcoming
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {isUpcoming ? 'Upcoming' : 'Past'}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="col-span-2 space-y-6">
            {/* Description */}
            {liveClass.description && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Description</h2>
                <p className="text-gray-700">{liveClass.description}</p>
              </div>
            )}

            {/* Details */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Class Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Date & Time</span>
                  <span className="font-medium">{formatDateTime(liveClass.scheduled_at)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Duration</span>
                  <span className="font-medium">{liveClass.duration_minutes} minutes</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Platform</span>
                  <span className="font-medium">{formatPlatform(liveClass.provider)}</span>
                </div>
                {liveClass.instructor && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Instructor</span>
                    <span className="font-medium">{liveClass.instructor.full_name || liveClass.instructor.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recordings Section - Only show for past classes */}
            {!isUpcoming && (
              <>
                <RecordingList
                  courseId={liveClass.course_id || 0}
                  liveSessionId={liveClass.id}
                />
                <RecordingUpload
                  courseId={liveClass.course_id || 0}
                  liveSessionId={liveClass.id}
                  onUploadSuccess={() => {
                    // Refresh the page to show the new recording
                    window.location.reload();
                  }}
                />
              </>
            )}
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow sticky top-20">
              <h3 className="font-semibold text-gray-800 mb-4">Actions</h3>
              <div className="space-y-2">
                <Link
                  href={`/dashboard/instructor/live-classes/${liveClass.id}/edit`}
                  className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition"
                >
                  Edit Class
                </Link>

                {isUpcoming && (
                  <button
                    onClick={() => {
                      router.push(`/live-class/${liveClass.id}`);
                    }}
                    className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-md hover:shadow-lg mb-2"
                  >
                    Start Live Class
                  </button>
                )}

                <Link
                  href="/dashboard/instructor/live-classes"
                  className="block w-full text-center bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded transition"
                >
                  Back to List
                </Link>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Students enrolled in this course will receive a notification when this live class is scheduled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
