'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createAdminBadge,
  createAdminAchievement,
  createAdminLevel,
  createAdminLeaderboard,
  deleteAdminBadge,
  deleteAdminAchievement,
  deleteAdminLevel,
  deleteAdminLeaderboard,
  fetchAdminAchievements,
  fetchAdminBadges,
  fetchAdminLevels,
  fetchLeaderboards,
} from '@/services/gamification';
import type {
  Achievement,
  Badge,
  Leaderboard,
  LevelDefinition,
} from '@/types/gamification';

type Section = 'badges' | 'achievements' | 'levels' | 'leaderboards';

export default function GamificationAdminPage() {
  const [section, setSection] = useState<Section>('badges');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [levels, setLevels] = useState<LevelDefinition[]>([]);
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<Record<string, string | boolean>>({ name: '', description: '', icon: '', points_reward: '', threshold_points: '', metric: 'score', is_public: true });

  useEffect(() => {
    async function loadAdmin() {
      try {
        const [badgeData, achievementData, levelData, leaderboardData] = await Promise.all([
          fetchAdminBadges(),
          fetchAdminAchievements(),
          fetchAdminLevels(),
          fetchLeaderboards(),
        ]);
        setBadges(badgeData);
        setAchievements(achievementData);
        setLevels(levelData);
        setLeaderboards(leaderboardData);
      } catch (err) {
        setError('Unable to load gamification admin data. Check your access and tenant settings.');
      } finally {
        setLoading(false);
      }
    }

    loadAdmin();
  }, []);

  const sectionTitle = useMemo(() => {
    switch (section) {
      case 'achievements':
        return 'Achievements';
      case 'levels':
        return 'Levels';
      case 'leaderboards':
        return 'Leaderboards';
      default:
        return 'Badges';
    }
  }, [section]);

  const handleFieldChange = (key: string, value: string | boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const resetDraft = () => {
    setDraft({ name: '', description: '', icon: '', points_reward: '', threshold_points: '', metric: 'score', is_public: true });
  };

  const handleCreate = async () => {
    setError('');
    setMessage('');
    try {
      if (section === 'badges') {
        const badge = await createAdminBadge({
          name: String(draft.name),
          description: String(draft.description || ''),
          icon: String(draft.icon || ''),
          criteria: {},
        });
        setBadges((current) => [badge, ...current]);
      } else if (section === 'achievements') {
        const achievement = await createAdminAchievement({
          name: String(draft.name),
          description: String(draft.description || ''),
          icon: String(draft.icon || ''),
          criteria: {},
          points_reward: Number(draft.points_reward) || 0,
        });
        setAchievements((current) => [achievement, ...current]);
      } else if (section === 'levels') {
        const level = await createAdminLevel({
          name: String(draft.name),
          description: String(draft.description || ''),
          threshold_points: Number(draft.threshold_points) || 0,
        });
        setLevels((current) => [level, ...current]);
      } else {
        const leaderboard = await createAdminLeaderboard({
          name: String(draft.name),
          description: String(draft.description || ''),
          metric: draft.metric as any,
          is_public: Boolean(draft.is_public),
        });
        setLeaderboards((current) => [leaderboard, ...current]);
      }
      setMessage(`${sectionTitle.slice(0, -1)} created successfully.`);
      resetDraft();
    } catch (err) {
      setError('Unable to create resource. Check entered values and try again.');
    }
  };

  const handleDelete = async (id: number) => {
    setError('');
    setMessage('');
    try {
      if (section === 'badges') {
        await deleteAdminBadge(id);
        setBadges((current) => current.filter((item) => item.id !== id));
      } else if (section === 'achievements') {
        await deleteAdminAchievement(id);
        setAchievements((current) => current.filter((item) => item.id !== id));
      } else if (section === 'levels') {
        await deleteAdminLevel(id);
        setLevels((current) => current.filter((item) => item.id !== id));
      } else {
        await deleteAdminLeaderboard(id);
        setLeaderboards((current) => current.filter((item) => item.id !== id));
      }
      setMessage(`${sectionTitle.slice(0, -1)} deleted successfully.`);
    } catch (err) {
      setError('Unable to delete resource.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-10">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Gamification admin</p>
          <h1 className="mt-3 text-3xl font-semibold">Manage badging, achievements, levels, and leaderboards</h1>
          <p className="mt-2 text-slate-600">Create and configure gamification elements for your organization.</p>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200/40">
          <div className="flex flex-wrap gap-2">
            {(['badges', 'achievements', 'levels', 'leaderboards'] as Section[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSection(item)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${section === item ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">Loading admin content…</div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-8">
              <section className="rounded-3xl bg-white p-8 shadow-sm shadow-slate-200/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{sectionTitle}</h2>
                    <p className="text-sm text-slate-500">Manage the {sectionTitle.toLowerCase()} available across your tenant.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Create new {sectionTitle.slice(0, -1)}
                  </button>
                </div>

                <div className="mt-6 grid gap-4">
                  {section === 'badges' && badges.length ? badges.map((badge) => (
                    <div key={badge.id} className="rounded-3xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{badge.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{badge.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(badge.id)}
                          className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )) : null}

                  {section === 'achievements' && achievements.length ? achievements.map((achievement) => (
                    <div key={achievement.id} className="rounded-3xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{achievement.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{achievement.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(achievement.id)}
                          className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )) : null}

                  {section === 'levels' && levels.length ? levels.map((level) => (
                    <div key={level.id} className="rounded-3xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{level.name}</p>
                          <p className="mt-1 text-sm text-slate-500">Threshold: {level.threshold_points.toFixed(0)} points</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(level.id)}
                          className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )) : null}

                  {section === 'leaderboards' && leaderboards.length ? leaderboards.map((leaderboard) => (
                    <div key={leaderboard.id} className="rounded-3xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{leaderboard.name}</p>
                          <p className="mt-1 text-sm text-slate-500">Metric: {leaderboard.metric}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(leaderboard.id)}
                          className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )) : null}

                  {((section === 'badges' && badges.length === 0) ||
                    (section === 'achievements' && achievements.length === 0) ||
                    (section === 'levels' && levels.length === 0) ||
                    (section === 'leaderboards' && leaderboards.length === 0)) && (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-slate-600">No items found for this section.</div>
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-8">
              <section className="rounded-3xl bg-white p-8 shadow-sm shadow-slate-200/40">
                <h2 className="text-xl font-semibold text-slate-900">Create {sectionTitle.slice(0, -1)}</h2>
                <div className="mt-6 space-y-4">
                  <label className="block text-sm font-medium text-slate-700">Name</label>
                  <input
                    type="text"
                    value={String(draft.name)}
                    onChange={(event) => handleFieldChange('name', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />

                  <label className="block text-sm font-medium text-slate-700">Description</label>
                  <textarea
                    value={String(draft.description)}
                    onChange={(event) => handleFieldChange('description', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    rows={3}
                  />

                  {section === 'achievements' ? (
                    <>
                      <label className="block text-sm font-medium text-slate-700">Points reward</label>
                      <input
                        type="number"
                        value={String(draft.points_reward)}
                        onChange={(event) => handleFieldChange('points_reward', event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      />
                    </>
                  ) : null}

                  {section === 'levels' ? (
                    <>
                      <label className="block text-sm font-medium text-slate-700">Threshold points</label>
                      <input
                        type="number"
                        value={String(draft.threshold_points)}
                        onChange={(event) => handleFieldChange('threshold_points', event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      />
                    </>
                  ) : null}

                  {section === 'leaderboards' ? (
                    <>
                      <label className="block text-sm font-medium text-slate-700">Metric</label>
                      <select
                        value={String(draft.metric)}
                        onChange={(event) => handleFieldChange('metric', event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      >
                        <option value="score">Score</option>
                        <option value="completion_rate">Completion rate</option>
                        <option value="engagement">Engagement</option>
                        <option value="quiz_accuracy">Quiz accuracy</option>
                      </select>

                      <label className="mt-4 flex items-center gap-3 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(draft.is_public)}
                          onChange={(event) => handleFieldChange('is_public', event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600"
                        />
                        Public leaderboard
                      </label>
                    </>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleCreate}
                    className="mt-4 inline-flex w-full justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    Create {sectionTitle.slice(0, -1)}
                  </button>
                </div>
              </section>

              {message ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">{message}</div>
              ) : null}
              {error ? (
                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
