'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { fetchCurrentUser, updateCurrentUser, uploadAvatar } from '@/services/auth';
import { clearAuthToken, saveUserProfile } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/types/auth';
import InputField from '@/components/InputField';
import ProfileCard from '@/components/ProfileCard';

const navItems = [
  {
    label: 'Profile',
    active: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
        <path d="M6 20c0-2.21 3.58-4 6-4s6 1.79 6 4" />
      </svg>
    ),
  },
  {
    label: 'Courses',
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.4 1.24 1 1.51H21a2 2 0 0 1 0 4h-.09c-.66.27-1 .85-1 1.51z" />
      </svg>
    ),
  },
];

type ProfileFormState = {
  name: string;
  email: string;
  age: string;
  joined_at: string;
  github_url: string;
  linkedin_url: string;
  role: string;
};

const blankProfile: ProfileFormState = {
  name: '',
  email: '',
  age: '',
  joined_at: '',
  github_url: '',
  linkedin_url: '',
  role: 'Student',
};

export default function AccountPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileFormState>(blankProfile);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await fetchCurrentUser();
        setUser(profile);
      } catch (err) {
        setError('Unable to load profile. Please sign in again.');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  useEffect(() => {
    if (!user) return;

    setForm({
      name: user.full_name ?? '',
      email: user.email ?? '',
      age: user.age != null ? String(user.age) : '',
      joined_at: user.joined_at ? user.joined_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      github_url: user.github_url ?? '',
      linkedin_url: user.linkedin_url ?? '',
      role: user.role ?? 'Student',
    });
    setAvatarUrl(user.avatar_url ?? null);
  }, [user]);

  const handleSignOut = () => {
    clearAuthToken();
    router.push('/login');
  };

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarUpload = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    setStatus('Uploading profile photo...');

    try {
      const metadata = await uploadAvatar(file);
      const updatedUser = await updateCurrentUser({ avatar_url: metadata.url });
      setUser(updatedUser);
      setAvatarUrl(updatedUser.avatar_url ?? null);
      // Save updated user profile to localStorage for global state sync
      saveUserProfile(updatedUser);
      setStatus('Profile photo uploaded successfully.');
    } catch (err) {
      setStatus('Unable to upload profile photo. Please try again.');
    } finally {
      window.setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('Saving profile changes...');

    try {
      const updatedUser = await updateCurrentUser({
        full_name: form.name || undefined,
        age: form.age ? Number(form.age) : undefined,
        joined_at: form.joined_at || undefined,
        github_url: form.github_url || undefined,
        linkedin_url: form.linkedin_url || undefined,
      });
      setUser(updatedUser);
      setAvatarUrl(updatedUser.avatar_url ?? null);
      // Save updated user profile to localStorage for global state sync
      saveUserProfile(updatedUser);
      setStatus('Profile updated successfully.');
    } catch (err) {
      setStatus('Unable to save profile. Please try again.');
    } finally {
      window.setTimeout(() => setStatus(''), 3000);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,207,229,0.38),_transparent_28%),_linear-gradient(180deg,_#f9ede9,_#fcf6f0)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-3 rounded-[2rem] bg-white/90 p-8 shadow-2xl shadow-pink-200/30 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-pink-600">Account</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">My Profile</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Update your student profile information and keep your contact details current.</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
          <aside className="hidden rounded-[2rem] bg-white/90 p-6 shadow-2xl shadow-slate-200/40 backdrop-blur-xl lg:block">
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Navigation</p>
              </div>
              <div className="space-y-3">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-3xl px-4 py-4 text-left text-sm font-medium transition ${
                      item.active ? 'bg-pink-50 text-pink-700 shadow-sm shadow-pink-200/40' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-current">
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <ProfileCard
                name={form.name || 'Student Name'}
                role={form.role}
                avatarUrl={avatarUrl}
                onAvatarUpload={handleAvatarUpload}
              />

              <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-slate-200/30 backdrop-blur-xl">
                <div className="mb-6 space-y-2">
                  <p className="text-sm uppercase tracking-[0.24em] text-pink-600">Personal Information</p>
                  <h2 className="text-2xl font-semibold text-slate-900">Update your profile details</h2>
                  <p className="text-sm text-slate-500">Your email cannot be changed from here. Keep your GitHub and LinkedIn links current.</p>
                </div>

                {loading ? (
                  <div className="rounded-3xl bg-slate-50 p-8 text-slate-500">Loading profile…</div>
                ) : error ? (
                  <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
                ) : (
                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <InputField
                        label="Name"
                        name="name"
                        value={form.name}
                        placeholder="Enter your full name"
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        }
                        onChange={handleFieldChange}
                      />
                      <InputField
                        label="Email"
                        name="email"
                        value={form.email}
                        placeholder="you@example.com"
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16v16H4z" />
                            <polyline points="22,6 12,13 2,6" />
                          </svg>
                        }
                        disabled
                        onChange={() => {}}
                      />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <InputField
                        label="Age"
                        name="age"
                        type="number"
                        value={form.age}
                        placeholder="25"
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 6v6l4 2" />
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        }
                        onChange={handleFieldChange}
                      />
                      <InputField
                        label="Date Joined"
                        name="joined_at"
                        type="date"
                        value={form.joined_at}
                        placeholder="Select date"
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                          </svg>
                        }
                        onChange={handleFieldChange}
                      />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <InputField
                        label="GitHub URL"
                        name="github_url"
                        value={form.github_url}
                        placeholder="https://github.com/username"
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                            <path d="M12 0.5C5.37 0.5 0 5.87 0 12.5C0 17.82 3.438 22.27 8.205 23.91C8.805 24.02 9.025 23.65 9.025 23.34C9.025 23.07 9.015 22.39 9.01 21.47C5.672 22.18 4.968 19.77 4.968 19.77C4.422 18.39 3.633 18.03 3.633 18.03C2.545 17.31 3.715 17.33 3.715 17.33C4.922 17.42 5.56 18.58 5.56 18.58C6.622 20.35 8.36 19.84 9.05 19.54C9.16 18.77 9.47 18.25 9.81 17.94C7.145 17.64 4.343 16.58 4.343 11.77C4.343 10.43 4.805 9.33 5.57 8.47C5.44 8.16 5.04 6.89 5.68 5.25C5.68 5.25 6.71 4.92 9.01 6.53C9.99 6.24 11.04 6.1 12.09 6.09C13.14 6.1 14.19 6.24 15.17 6.53C17.46 4.92 18.49 5.25 18.49 5.25C19.13 6.89 18.73 8.16 18.6 8.47C19.37 9.33 19.83 10.43 19.83 11.77C19.83 16.59 17.02 17.64 14.35 17.94C14.79 18.33 15.17 19.09 15.17 20.22C15.17 21.8 15.16 22.99 15.16 23.34C15.16 23.66 15.38 24.03 15.99 23.91C20.76 22.27 24.19 17.82 24.19 12.5C24.19 5.87 18.82 0.5 12.19 0.5H12Z" />
                          </svg>
                        }
                        onChange={handleFieldChange}
                      />
                      <InputField
                        label="LinkedIn URL"
                        name="linkedin_url"
                        value={form.linkedin_url}
                        placeholder="https://linkedin.com/in/username"
                        icon={
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                            <path d="M20.45 20.45h-3.56v-5.3c0-1.26-.02-2.87-1.75-2.87-1.75 0-2.02 1.37-2.02 2.78v5.4H9.62V9.5h3.42v1.5h.05c.48-.9 1.65-1.85 3.4-1.85 3.63 0 4.3 2.39 4.3 5.5v6.28zM5.34 8c-1.15 0-2.08-.94-2.08-2.1 0-1.14.93-2.08 2.08-2.08 1.15 0 2.08.94 2.08 2.08 0 1.16-.93 2.1-2.08 2.1zm1.78 12.45H3.56V9.5h3.56v10.95z" />
                          </svg>
                        }
                        onChange={handleFieldChange}
                      />
                    </div>

                    {status ? <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-700">{status}</div> : null}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-200/30 transition hover:bg-pink-700"
                      >
                        Save Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({
                          name: user?.full_name ?? '',
                          email: user?.email ?? '',
                          age: user?.age != null ? String(user.age) : '',
                          joined_at: user?.joined_at ? user.joined_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                          github_url: user?.github_url ?? '',
                          linkedin_url: user?.linkedin_url ?? '',
                          role: user?.role ?? 'Student',
                        })}
                        className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Reset
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
