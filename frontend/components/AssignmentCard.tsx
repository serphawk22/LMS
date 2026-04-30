'use client';

import Link from 'next/link';
import { useState } from 'react';

interface AssignmentCardProps {
  id?: number;
  title: string;
  courseTitle: string;
  description?: string;
  dueDate: Date | string;
  status?: 'pending' | 'submitted' | 'graded' | 'overdue';
  score?: number;
  maxScore?: number;
  courseId?: number;
}

export function AssignmentCard({
  id,
  title,
  courseTitle,
  description,
  dueDate,
  status = 'pending',
  score,
  maxScore = 100,
  courseId,
}: AssignmentCardProps) {
  const [isHovering, setIsHovering] = useState(false);

  const parsedDueDate = new Date(dueDate);
  const now = new Date();
  const isOverdue = status === 'overdue' || (parsedDueDate < now && status === 'pending');
  const daysUntilDue = Math.ceil((parsedDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    submitted: 'bg-blue-100 text-blue-800 border border-blue-300',
    graded: 'bg-green-100 text-green-800 border border-green-300',
    overdue: 'bg-red-100 text-red-800 border border-red-300',
  };

  const statusIcons = {
    pending: '⏳',
    submitted: '📤',
    graded: '✅',
    overdue: '⚠️',
  };

  return (
    <div
      className="modern-card p-5 cursor-pointer"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Assignment Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-lg">{statusIcons[status]}</span>
            <h4 className="font-bold text-slate-900 truncate text-sm">
              {title}
            </h4>
          </div>

          <p className="text-xs text-slate-500 mb-2">
            {courseTitle}
          </p>

          {description && (
            <p className="text-sm text-slate-600 line-clamp-2 mb-3">
              {description}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Due Date */}
            <div className="flex items-center gap-1 text-slate-600">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-5.04-6.71l-2.75 3.54-1.3-1.54c-.3-.36-.77-.36-1.07 0-.3.36-.3.95 0 1.31l1.83 2.19c.3.36.77.36 1.07 0 .01 0 .01 0 .02 0l3.28-4.13c.3-.36.28-.95-.02-1.31-.3-.36-.76-.36-1.06 0z" />
              </svg>
              <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                {parsedDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {daysUntilDue > 0 && !isOverdue && ` (${daysUntilDue}d left)`}
                {isOverdue && ' (OVERDUE)'}
              </span>
            </div>

            {/* Score if graded */}
            {status === 'graded' && score !== undefined && (
              <div className="flex items-center gap-1 text-slate-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span className="font-semibold text-green-600">
                  {score}/{maxScore}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className={`px-2.5 py-1 rounded-lg font-medium text-xs whitespace-nowrap ${statusColors[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
      </div>

      {/* Action Link */}
      {courseId && (
        <Link
          href={`/courses/${courseId}`}
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          View Assignment
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}
