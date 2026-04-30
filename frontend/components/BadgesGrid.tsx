'use client';

import type { Badge } from '@/types/gamification';

interface BadgesGridProps {
  allBadges: Badge[];
  earnedBadgeIds: number[];
}

export function BadgesGrid({ allBadges, earnedBadgeIds }: BadgesGridProps) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm shadow-slate-200/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Badges</h2>
          <p className="text-sm text-slate-500">Earn badges by completing key learning milestones</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {allBadges.length ? (
          allBadges.map((badge) => {
            const isEarned = earnedBadgeIds.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`rounded-2xl border-2 p-6 transition-all duration-300 ${
                  isEarned
                    ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-md'
                    : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl text-2xl ${
                    isEarned
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    {badge.icon || '🏅'}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${isEarned ? 'text-slate-900' : 'text-slate-500'}`}>
                      {badge.name}
                    </h3>
                    <p className={`text-sm mt-1 ${isEarned ? 'text-slate-600' : 'text-slate-400'}`}>
                      {badge.description || 'Complete specific achievements to earn this badge'}
                    </p>
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        isEarned
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {isEarned ? '✓ Earned' : '🔒 Locked'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
            No badges available yet.
          </div>
        )}
      </div>
    </div>
  );
}