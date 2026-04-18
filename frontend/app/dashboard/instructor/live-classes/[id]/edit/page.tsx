'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LiveClassForm from '@/components/LiveClassForm';
import { getLiveClass, LiveClass } from '@/services/live_classes';

interface EditLiveClassProps {
  params: {
    id: string;
  };
}

export default function EditLiveClassPage({ params }: EditLiveClassProps) {
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-500">Loading...</div>
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-500 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            ← Back
          </button>
        </div>
        <LiveClassForm
          courseName={liveClass.course_name}
          liveClass={liveClass}
          onSuccess={() => {
            router.push(`/dashboard/instructor/live-classes/${liveClass.id}`);
          }}
        />
      </div>
    </div>
  );
}
