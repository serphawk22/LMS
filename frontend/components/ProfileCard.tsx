'use client';

import { useState, useEffect, type ChangeEvent } from 'react';

interface ProfileCardProps {
  name: string;
  role: string;
  avatarUrl: string | null;
  onAvatarUpload: (file: File) => void;
}

export default function ProfileCard({ name, role, avatarUrl, onAvatarUpload }: ProfileCardProps) {
  const [imageError, setImageError] = useState(false);
  
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'ST';

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onAvatarUpload(file);
    }
  };

  // Convert relative URLs to absolute URLs for image loading
  const getFullImageUrl = (url: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // For relative URLs like /uploads/..., prepend the API base URL
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:8000';
    return `${apiBase}${url}`;
  };

  const fullImageUrl = getFullImageUrl(avatarUrl);

  // Reset error state when URL changes
  useEffect(() => {
    setImageError(false);
  }, [fullImageUrl]);

  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-pink-200/30 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative">
          <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-pink-50 shadow-lg shadow-pink-200/40">
            {fullImageUrl && !imageError ? (
              <img 
                src={fullImageUrl} 
                alt="Profile" 
                className="h-full w-full object-cover"
                onError={() => setImageError(true)} 
              />
            ) : (
              <span className="text-4xl font-semibold text-slate-700">{initials}</span>
            )}
          </div>

          <label className="absolute -bottom-1 right-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white text-pink-600 shadow-md shadow-slate-200 transition hover:bg-pink-50">
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </label>
        </div>

        <div>
          <p className="text-2xl font-semibold text-slate-900">{name || 'Student Name'}</p>
          <p className="mt-1 text-sm text-slate-500">{role || 'Student'}</p>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-3xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-700"
        >
          Upload Photo
        </button>

        <p className="max-w-xs text-xs text-slate-500">JPG, PNG or GIF. Max 5MB.</p>
      </div>
    </div>
  );
}
