export type LeaderboardMetric = 'score' | 'completion_rate' | 'engagement' | 'quiz_accuracy';

export interface Badge {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
  icon?: string;
  criteria?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Achievement {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
  icon?: string;
  criteria?: Record<string, any>;
  points_reward: number;
  created_at: string;
  updated_at: string;
}

export interface UserAchievement {
  id: number;
  achievement: Achievement;
  awarded_at: string;
}

export interface LevelDefinition {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
  threshold_points: number;
  created_at: string;
  updated_at: string;
}

export interface GamificationSummary {
  total_points: number;
  current_level?: LevelDefinition | null;
  next_level_threshold?: number | null;
  badges: Badge[];
  achievements: UserAchievement[];
}

export interface BadgeCreate {
  name: string;
  description?: string;
  icon?: string;
  criteria?: Record<string, any>;
}

export interface BadgeUpdate {
  name?: string;
  description?: string;
  icon?: string;
  criteria?: Record<string, any>;
}

export interface AchievementCreate {
  name: string;
  description?: string;
  icon?: string;
  criteria?: Record<string, any>;
  points_reward: number;
}

export interface AchievementUpdate {
  name?: string;
  description?: string;
  icon?: string;
  criteria?: Record<string, any>;
  points_reward?: number;
}

export interface LevelDefinitionCreate {
  name: string;
  description?: string;
  threshold_points: number;
}

export interface LevelDefinitionUpdate {
  name?: string;
  description?: string;
  threshold_points?: number;
}

export interface LeaderboardCreate {
  name: string;
  description?: string;
  metric: LeaderboardMetric;
  is_public: boolean;
}

export interface LeaderboardUpdate {
  name?: string;
  description?: string;
  metric?: LeaderboardMetric;
  is_public?: boolean;
}

export interface LeaderboardEntry {
  id: number;
  leaderboard_id: number;
  user_id: number;
  score: number;
  rank: number;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntryWithUser {
  id: number;
  leaderboard_id: number;
  user_id: number;
  user_name: string;
  score: number;
  rank: number;
  user_level: string;
  created_at: string;
  updated_at: string;
}

export interface Leaderboard {
  id: number;
  name: string;
  description?: string;
  metric: LeaderboardMetric;
  is_public: boolean;
  entries: LeaderboardEntry[];
}

export interface LeaderboardWithUsers {
  id: number;
  name: string;
  description?: string;
  metric: LeaderboardMetric;
  is_public: boolean;
  entries: LeaderboardEntryWithUser[];
}
