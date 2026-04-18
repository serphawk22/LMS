'use client';

import { useEffect, useState } from 'react';
import { fetchLiveSessionRecordings, LiveSessionRecording } from '@/services/courses';

interface RecordingListProps {
  courseId: number;
  liveSessionId: number;
}

export default function RecordingList({ courseId, liveSessionId }: RecordingListProps) {
  const [recordings, setRecordings] = useState<LiveSessionRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecordings();
  }, [courseId, liveSessionId]);

  const loadRecordings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLiveSessionRecordings(courseId, liveSessionId);
      setRecordings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Unknown';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Class Recordings</h3>
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">Loading recordings...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Class Recordings</h3>
        <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Class Recordings</h3>
        <p className="text-gray-600">No recordings uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow border">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Class Recordings</h3>
      <div className="space-y-4">
        {recordings.map((recording) => (
          <div key={recording.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-lg font-medium text-gray-800">{recording.title}</h4>
                {recording.notes && (
                  <p className="text-sm text-gray-600 mt-1">{recording.notes}</p>
                )}
              </div>
              <span className="text-sm text-gray-500">
                {formatDate(recording.uploaded_at)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span>Duration: {formatDuration(recording.duration_minutes)}</span>
                <span>File: {recording.file_key.split('/').pop()}</span>
              </div>
              <a
                href={recording.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition"
              >
                Watch Recording
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}