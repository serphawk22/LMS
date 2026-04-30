"use client";

import { useState } from "react";
import ProfileCard from "@/components/ProfileCard";

interface InstructorProfilePanelProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  onAvatarUpload: (file: File) => void;
}

export default function InstructorProfilePanel({ name, email, avatarUrl, onAvatarUpload }: InstructorProfilePanelProps) {
  return (
    <aside className="hidden lg:flex flex-col items-center w-72 min-h-screen bg-[var(--card-color)] border-r border-[var(--border-color)] shadow-lg px-6 py-10 fixed left-0 top-0 z-30 transition-all duration-300">
      <ProfileCard
        name={name}
        role={email}
        avatarUrl={avatarUrl}
        onAvatarUpload={onAvatarUpload}
      />
      <div className="mt-6 text-center">
        <div className="font-semibold text-lg text-[var(--text-color)]">{name}</div>
        <div className="text-sm text-[var(--muted-color)]">{email}</div>
      </div>
    </aside>
  );
}
