import api from '@/lib/api';
import type {
  Achievement,
  AchievementCreate,
  AchievementUpdate,
  Badge,
  BadgeCreate,
  BadgeUpdate,
  GamificationSummary,
  Leaderboard,
  LeaderboardCreate,
  LeaderboardEntry,
  LeaderboardUpdate,
  LevelDefinition,
  LevelDefinitionCreate,
  LevelDefinitionUpdate,
  UserAchievement,
} from '@/types/gamification';

export async function fetchGamificationSummary(): Promise<GamificationSummary> {
  const response = await api.get('/gamification/users/me/stats');
  return response.data;
}

export async function fetchUserBadges(): Promise<Badge[]> {
  const response = await api.get('/gamification/users/me/badges');
  return response.data;
}

export async function fetchUserAchievements(): Promise<UserAchievement[]> {
  const response = await api.get('/gamification/users/me/achievements');
  return response.data;
}

export async function fetchLeaderboards(): Promise<Leaderboard[]> {
  const response = await api.get('/gamification/leaderboards');
  return response.data;
}

export async function fetchAllBadges(): Promise<Badge[]> {
  const response = await api.get('/gamification/badges');
  return response.data;
}

export async function fetchLeaderboardEntriesWithUsers(leaderboardId: number): Promise<import('@/types/gamification').LeaderboardEntryWithUser[]> {
  const response = await api.get(`/gamification/leaderboards/${leaderboardId}/entries/with-users`);
  return response.data;
}

export async function fetchAdminBadges(): Promise<Badge[]> {
  const response = await api.get('/gamification/admin/badges');
  return response.data;
}

export async function createAdminBadge(payload: BadgeCreate): Promise<Badge> {
  const response = await api.post('/gamification/admin/badges', payload);
  return response.data;
}

export async function updateAdminBadge(badgeId: number, payload: BadgeUpdate): Promise<Badge> {
  const response = await api.patch(`/gamification/admin/badges/${badgeId}`, payload);
  return response.data;
}

export async function deleteAdminBadge(badgeId: number): Promise<void> {
  await api.delete(`/gamification/admin/badges/${badgeId}`);
}

export async function fetchAdminAchievements(): Promise<Achievement[]> {
  const response = await api.get('/gamification/admin/achievements');
  return response.data;
}

export async function createAdminAchievement(payload: AchievementCreate): Promise<Achievement> {
  const response = await api.post('/gamification/admin/achievements', payload);
  return response.data;
}

export async function updateAdminAchievement(achievementId: number, payload: AchievementUpdate): Promise<Achievement> {
  const response = await api.patch(`/gamification/admin/achievements/${achievementId}`, payload);
  return response.data;
}

export async function deleteAdminAchievement(achievementId: number): Promise<void> {
  await api.delete(`/gamification/admin/achievements/${achievementId}`);
}

export async function fetchAdminLevels(): Promise<LevelDefinition[]> {
  const response = await api.get('/gamification/admin/levels');
  return response.data;
}

export async function createAdminLevel(payload: LevelDefinitionCreate): Promise<LevelDefinition> {
  const response = await api.post('/gamification/admin/levels', payload);
  return response.data;
}

export async function updateAdminLevel(levelId: number, payload: LevelDefinitionUpdate): Promise<LevelDefinition> {
  const response = await api.patch(`/gamification/admin/levels/${levelId}`, payload);
  return response.data;
}

export async function deleteAdminLevel(levelId: number): Promise<void> {
  await api.delete(`/gamification/admin/levels/${levelId}`);
}

export async function createAdminLeaderboard(payload: LeaderboardCreate): Promise<Leaderboard> {
  const response = await api.post('/gamification/admin/leaderboards', payload);
  return response.data;
}

export async function updateAdminLeaderboard(leaderboardId: number, payload: LeaderboardUpdate): Promise<Leaderboard> {
  const response = await api.patch(`/gamification/admin/leaderboards/${leaderboardId}`, payload);
  return response.data;
}

export async function deleteAdminLeaderboard(leaderboardId: number): Promise<void> {
  await api.delete(`/gamification/admin/leaderboards/${leaderboardId}`);
}
