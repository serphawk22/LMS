'use client';

import { useEffect, useState } from 'react';
import { fetchGamificationSummary, fetchAllBadges, fetchLeaderboards, fetchLeaderboardEntriesWithUsers } from '@/services/gamification';
import { useAuth } from '@/hooks/useAuth';
import type { GamificationSummary, Badge, LeaderboardWithUsers } from '@/types/gamification';
import { PointsCard } from '@/components/PointsCard';
import { BadgesGrid } from '@/components/BadgesGrid';
import { AchievementsSection } from '@/components/AchievementsSection';
import { LeaderboardTable } from '@/components/LeaderboardTable';

export default function GamificationPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [leaderboards, setLeaderboards] = useState<LeaderboardWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [stats, badgesData, leaderboardsData] = await Promise.all([
          fetchGamificationSummary(),
          fetchAllBadges(),
          fetchLeaderboards(),
        ]);

        setSummary(stats);
        setAllBadges(badgesData);

        // Load leaderboard entries with user names
        const leaderboardsWithUsers = await Promise.all(
          leaderboardsData.map(async (leaderboard) => {
            const entries = await fetchLeaderboardEntriesWithUsers(leaderboard.id);
            return {
              ...leaderboard,
              entries,
            } as LeaderboardWithUsers;
          })
        );

        setLeaderboards(leaderboardsWithUsers);
      } catch (err) {
        setError('Unable to load gamification data. Please sign in and try again.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const earnedBadgeIds = summary?.badges.map(badge => badge.id) || [];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full space-y-8">
        <section className="rounded-3xl bg-white p-10 shadow-sm shadow-slate-200/40">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Gamification</p>
          <h1 className="mt-3 text-3xl font-semibold">Your Learning Journey</h1>
          <p className="mt-2 text-slate-600">Track your progress, level up, and see where you rank against other learners.</p>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-slate-500 shadow-sm shadow-slate-200/40">
            Loading gamification details…
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-700">{error}</div>
        ) : summary ? (
          <>
            {/* Top Section: Points Card */}
            <section>
              <PointsCard
                totalPoints={summary.total_points}
                currentLevel={summary.current_level || null}
                nextLevelThreshold={summary.next_level_threshold || null}
              />
            </section>

            {/* Middle Section: Badges Grid */}
            <section>
              <BadgesGrid allBadges={allBadges} earnedBadgeIds={earnedBadgeIds} />
            </section>

            {/* Achievements Section */}
            <section>
              <AchievementsSection achievements={summary.achievements} />
            </section>

            {/* Bottom Section: Leaderboards */}
            <section>
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-slate-900">Leaderboards</h2>
                  <p className="text-slate-600 mt-2">See your rank among active learners</p>
                </div>

                {leaderboards.length ? (
                  leaderboards.map((leaderboard) => (
                    <LeaderboardTable key={leaderboard.id} leaderboard={leaderboard} />
                  ))
                ) : (
                  <div className="rounded-3xl bg-white p-8 text-center text-slate-600 shadow-sm shadow-slate-200/40">
                    No leaderboards are published yet.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
