'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStudentLiveClasses, markAttendance, LiveClassForStudent } from '@/services/live_classes';
import { useAuth } from '@/hooks/useAuth';

export default function UpcomingLiveClasses() {
  const router = useRouter();
  const { initialized, tenantId } = useAuth();
  const [liveClasses, setLiveClasses] = useState<LiveClassForStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningClassId, setJoiningClassId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!initialized || !tenantId) return;
    fetchLiveClasses();
    // Refresh every 5 minutes
    const interval = setInterval(fetchLiveClasses, 5 * 60 * 1000);
    const clock = setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
  }, [initialized, tenantId]);

  const fetchLiveClasses = async () => {
    try {
      setLoading(true);
      const classes = await getStudentLiveClasses(true, 50, 0);
      setLiveClasses(classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live classes');
      console.error('Error fetching live classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async (liveClass: LiveClassForStudent) => {
    try {
      setJoiningClassId(liveClass.id);
      // Navigate to live class page using Next.js router
      router.push(`/live-class/${liveClass.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join class');
      console.error('Error joining class:', err);
    } finally {
      setJoiningClassId(null);
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPlatform = (platform: string) => {
    const platformMap: { [key: string]: string } = {
      zoom: '🎥 Zoom',
      google_meet: '🎥 Google Meet',
      microsoft_teams: '🎥 Microsoft Teams',
      manual: '🔗 Join',
    };
    return platformMap[platform] || platform;
  };

  const getClassStatus = (liveClass: LiveClassForStudent) => {
    const scheduledTime = new Date(liveClass.scheduled_at);
    const durationMs = (liveClass.duration_minutes ?? 0) * 60_000;
    const endTime = new Date(scheduledTime.getTime() + durationMs);

    if (currentTime < scheduledTime) {
      return 'before';
    }
    if (currentTime >= scheduledTime && currentTime < endTime) {
      return 'during';
    }
    return 'after';
  };

  const getStatusBadge = (liveClass: LiveClassForStudent) => {
    const status = getClassStatus(liveClass);

    if (status === 'during') {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">LIVE NOW</span>;
    }
    if (status === 'after') {
      return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">Ended</span>;
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Upcoming</span>;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Upcoming Live Classes</h2>
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">Loading live classes...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Upcoming Live Classes</h2>
        <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>
      </div>
    );
  }

  if (liveClasses.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Upcoming Live Classes</h2>
        <div className="text-center py-8 text-gray-500">
          <p>No upcoming live classes. Check back soon!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Upcoming Live Classes</h2>
      <div className="space-y-3">
        {liveClasses.map((liveClass) => {
          const status = getClassStatus(liveClass);
          const scheduledTime = new Date(liveClass.scheduled_at);
          const formattedStartTime = scheduledTime.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={liveClass.id}
              className={`p-4 border rounded-lg flex items-center justify-between ${
                status === 'during'
                  ? 'border-red-300 bg-red-50'
                  : status === 'after'
                  ? 'border-gray-200 bg-gray-50'
                  : 'border-green-200 bg-green-50'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-800">{liveClass.title}</h3>
                  {getStatusBadge(liveClass)}
                </div>
                <p className="text-sm text-gray-600 flex items-center gap-4">
                  <span>📅 {formatDateTime(liveClass.scheduled_at)}</span>
                  <span>⏱️ {liveClass.duration_minutes} min</span>
                  {liveClass.instructor && (
                    <span>👤 {liveClass.instructor.full_name || liveClass.instructor.email}</span>
                  )}
                </p>
              </div>
              {status === 'during' ? (
                <button
                  onClick={() => handleJoinClass(liveClass)}
                  disabled={joiningClassId === liveClass.id}
                  className="ml-4 px-4 py-2 rounded font-medium text-white transition bg-red-500 hover:bg-red-600 disabled:bg-gray-400"
                >
                  {joiningClassId === liveClass.id ? 'Joining...' : 'Join Class'}
                </button>
              ) : (
                <div className="ml-4 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {status === 'before' ? `Starts at ${formattedStartTime}` : 'Class Ended'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
