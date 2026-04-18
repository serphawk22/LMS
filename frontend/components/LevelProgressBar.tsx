'use client';

interface LevelProgressBarProps {
  currentPoints: number;
  currentLevelThreshold: number;
  nextLevelThreshold: number | null;
}

export function LevelProgressBar({ currentPoints, currentLevelThreshold, nextLevelThreshold }: LevelProgressBarProps) {
  // Calculate progress within current level
  const currentLevelMin = getLevelMinPoints(currentLevelThreshold);
  const currentLevelMax = nextLevelThreshold || currentLevelThreshold;
  const progressInLevel = currentPoints - currentLevelMin;
  const levelRange = currentLevelMax - currentLevelMin;
  const progressPercentage = levelRange > 0 ? (progressInLevel / levelRange) * 100 : 100;

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-slate-600 mb-2">
        <span>{currentLevelMin} XP</span>
        <span>{nextLevelThreshold ? `${nextLevelThreshold} XP` : 'Max Level'}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-4 shadow-inner">
        <div
          className="bg-gradient-to-r from-emerald-400 to-blue-500 h-4 rounded-full transition-all duration-700 ease-out shadow-sm"
          style={{ width: `${Math.min(progressPercentage, 100)}%` }}
        ></div>
      </div>
      <div className="text-center mt-2">
        <span className="text-sm font-medium text-slate-700">
          {progressInLevel.toFixed(0)} / {levelRange.toFixed(0)} XP to next level
        </span>
      </div>
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