'use client';

import { useAuth } from '@/hooks/useAuth';

import type { LevelDefinition } from '@/types/gamification';

interface PointsCardProps {
  totalPoints: number;
  currentLevel: LevelDefinition | null;
  nextLevelThreshold: number | null;
}

export function PointsCard({ totalPoints, currentLevel, nextLevelThreshold }: PointsCardProps) {
  const { user } = useAuth();

  // Calculate progress within current level
  const currentLevelMin = currentLevel ? getLevelMinPoints(currentLevel.threshold_points) : 0;
  const currentLevelMax = nextLevelThreshold || (currentLevel ? currentLevel.threshold_points : 100);
  const progressInLevel = totalPoints - currentLevelMin;
  const levelRange = currentLevelMax - currentLevelMin;
  const progressPercentage = levelRange > 0 ? (progressInLevel / levelRange) * 100 : 100;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 p-8 shadow-sm shadow-blue-200/40">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{totalPoints.toFixed(0)} XP</h2>
          <p className="text-sm text-slate-600">Total Points</p>
        </div>
        <div className="text-right">
          <h3 className="text-xl font-semibold text-slate-900">
            {currentLevel?.name || 'Level 1'}
          </h3>
          <p className="text-sm text-slate-600">
            {nextLevelThreshold
              ? `${progressInLevel.toFixed(0)} / ${levelRange.toFixed(0)} XP`
              : 'Max Level'
            }
          </p>
        </div>
      </div>

      {nextLevelThreshold && (
        <div className="mt-6">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>{currentLevelMin} XP</span>
            <span>{currentLevelMax} XP</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get the minimum points for a level
function getLevelMinPoints(thresholdPoints: number): number {
  // Based on the level system: Level 1: 0-100, Level 2: 101-300, etc.
  if (thresholdPoints <= 100) return 0;
  if (thresholdPoints <= 300) return 101;
  if (thresholdPoints <= 600) return 301;
  if (thresholdPoints <= 1000) return 601;
  return 1001; // Level 5+
}