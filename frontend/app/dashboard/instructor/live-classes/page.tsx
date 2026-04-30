'use client';

import { useState } from 'react';
import Link from 'next/link';
import InstructorLiveClassesList from '@/components/InstructorLiveClassesList';
import { useAuth } from '@/hooks/useAuth';

export default function InstructorLiveClassesPage() {
  const { user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-[var(--text-color)]">Live Classes</h1>
          <Link
            href="/dashboard/instructor/live-classes/create"
            className="bg-[var(--primary-color)] hover:opacity-90 text-white font-medium py-2 px-6 rounded-md transition"
          >
            + Schedule New Live Class
          </Link>
        </div>
        <p className="text-[var(--muted-color)]">
          Manage your live classes, connect with students in real-time, and schedule sessions across your courses.
        </p>
      </div>

      {/* Filter Section */}
      <div className="mb-6 p-4 bg-[var(--surface-strong)] rounded-lg border border-[var(--border-color)]">
        <h3 className="font-semibold text-gray-800 mb-3">Filters</h3>
        <p className="text-sm text-gray-600">
          Showing all your scheduled live classes. Click "Edit" to modify or "Delete" to remove a class.
        </p>
      </div>

      {/* Live Classes List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <InstructorLiveClassesList instructorId={user?.id ? parseInt(user.id) : undefined} />
        </div>
      </div>
    </div>
  );
}
