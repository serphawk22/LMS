'use client';

import { useAuth } from '@/hooks/useAuth';
import type { LeaderboardWithUsers } from '@/types/gamification';

interface LeaderboardTableProps {
  leaderboard: LeaderboardWithUsers;
}

export function LeaderboardTable({ leaderboard }: LeaderboardTableProps) {
  const { user } = useAuth();

  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm shadow-slate-200/40">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{leaderboard.name}</h2>
          <p className="text-sm text-slate-500">{leaderboard.description || 'Public leaderboard'}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
          {leaderboard.metric.replace('_', ' ')}
        </span>
      </div>

      <div className="space-y-2">
        {leaderboard.entries.length ? (
          leaderboard.entries.slice(0, 10).map((entry, index) => {
            const isCurrentUser = user?.id === String(entry.user_id);
            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between rounded-2xl px-6 py-4 transition-all ${
                  isCurrentUser
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    index === 0
                      ? 'bg-yellow-100 text-yellow-800'
                      : index === 1
                      ? 'bg-slate-100 text-slate-800'
                      : index === 2
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className={`font-medium ${isCurrentUser ? 'text-blue-900' : 'text-slate-900'}`}>
                      {entry.user_name}
                      {isCurrentUser && <span className="ml-2 text-blue-600">(You)</span>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${isCurrentUser ? 'text-blue-900' : 'text-slate-900'}`}>
                    {entry.score.toFixed(0)}
                  </p>
                  <p className="text-sm text-slate-500">{entry.user_level}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl bg-slate-50 px-6 py-8 text-center text-slate-600">
            No leaderboard data available yet.
          </div>
        )}
      </div>
    </div>
  );
}