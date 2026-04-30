'use client';

import type { UserAchievement } from '@/types/gamification';

interface AchievementsSectionProps {
  achievements: UserAchievement[];
}

export function AchievementsSection({ achievements }: AchievementsSectionProps) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm shadow-slate-200/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Achievements</h2>
          <p className="text-sm text-slate-500">Milestone accomplishments on your learning journey</p>
        </div>
      </div>

      <div className="space-y-4">
        {achievements.length ? (
          achievements.map((achievement) => (
            <div
              key={achievement.id}
              className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 text-xl">
                  {achievement.achievement.icon || '⭐'}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {achievement.achievement.name}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {achievement.achievement.description || 'Achievement unlocked!'}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                      +{achievement.achievement.points_reward} XP
                    </span>
                    <span className="text-xs text-slate-500">
                      Awarded {new Date(achievement.awarded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
            No achievements yet. Keep learning to unlock rewards!
          </div>
        )}
      </div>
    </div>
  );
}