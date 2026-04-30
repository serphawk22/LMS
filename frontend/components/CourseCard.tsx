'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Course } from '@/types/course';

interface CourseCardProps {
  course: Course;
  progress?: number;
  showProgress?: boolean;
  enrolled?: boolean;
  onEnroll?: () => void;
  enrolling?: boolean;
}

export function CourseCard({
  course,
  progress = 0,
  showProgress = true,
  enrolled = false,
  onEnroll,
  enrolling = false,
}: CourseCardProps) {
  const [isHovering, setIsHovering] = useState(false);

  const courseCategory =
    typeof course.category === 'object'
      ? course.category?.name ?? 'Course'
      : course.category ?? 'Course';

  const instructorName =
    course.instructor_name ||
    course.instructors?.[0]?.full_name ||
    'Unknown Instructor';

  return (
    <div
      className="modern-card overflow-hidden group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Course Thumbnail */}
      <div className="relative h-48 bg-gradient-to-br from-blue-400 via-blue-500 to-purple-600 overflow-hidden">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-600">
            <svg className="w-16 h-16 text-white/30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
          </div>
        )}
        {/* Badge */}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1 rounded-full">
          <p className="text-xs font-semibold text-slate-900">{course.level || 'All'}</p>
        </div>
      </div>

      {/* Course Info */}
      <div className="p-4">
        {/* Title and Description */}
        <h3 className="font-bold text-slate-900 line-clamp-2 text-base mb-2">
          {course.title}
        </h3>
        <p className="text-sm text-slate-600 line-clamp-2 mb-3">
          {course.short_description || course.description || 'No description available'}
        </p>

        {/* Instructor */}
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-xs text-white font-semibold">
            {instructorName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-slate-600 font-medium truncate">
            {instructorName}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mb-4 text-sm">
          <div className="flex items-center gap-4">
            {course.average_rating && (
              <div className="flex items-center gap-1">
                <span className="text-yellow-500">★</span>
                <span className="font-semibold text-slate-900">{course.average_rating.toFixed(1)}</span>
                <span className="text-slate-500">(rating)</span>
              </div>
            )}
          </div>
          {course.price ? (
            <span className="font-bold text-blue-600">${course.price.toFixed(2)}</span>
          ) : (
            <span className="font-bold text-green-600">Free</span>
          )}
        </div>

        {/* Progress Bar (if enrolled) */}
        {showProgress && enrolled && progress !== undefined && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">Progress</span>
              <span className="text-xs font-bold text-blue-600">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex gap-2">
          {enrolled ? (
            <Link
              href={`/courses/${course.id}`}
              className="flex-1 btn-primary text-center block transition-all duration-300 hover:shadow-lg"
            >
              {progress > 0 ? 'Continue Course' : 'Start Course'}
            </Link>
          ) : onEnroll ? (
            <button
              onClick={onEnroll}
              disabled={enrolling}
              className="flex-1 btn-primary transition-all duration-300 hover:shadow-lg disabled:opacity-50"
            >
              {enrolling ? 'Enrolling...' : 'Enroll Now'}
            </button>
          ) : (
            <Link
              href={`/courses/${course.id}`}
              className="flex-1 btn-secondary text-center block transition-all duration-300"
            >
              View Course
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
