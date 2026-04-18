from datetime import datetime, timezone
from typing import Any, List

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import (
    Achievement,
    Badge,
    Leaderboard,
    LeaderboardEntry,
    LevelDefinition,
    Organization,
    User,
    UserAchievement,
    UserBadge,
    UserProgress,
)


DEFAULT_LEVELS = [
    {"name": "Level 1", "threshold_points": 100.0},
    {"name": "Level 2", "threshold_points": 300.0},
    {"name": "Level 3", "threshold_points": 600.0},
    {"name": "Level 4", "threshold_points": 1000.0},
    {"name": "Level 5", "threshold_points": 1000.0},  # Max level
]

DEFAULT_BADGES = [
    {"name": "Beginner Learner", "description": "Complete your first lesson", "icon": "🌱", "criteria": {"event": "lesson_completed", "min_count": 1}},
    {"name": "Quiz Master", "description": "Pass 5 quizzes with 80% or higher", "icon": "🧠", "criteria": {"event": "quiz_passed", "min_count": 5, "min_score": 80}},
    {"name": "Course Finisher", "description": "Complete your first course", "icon": "🎓", "criteria": {"event": "course_completed", "min_count": 1}},
    {"name": "Assignment Expert", "description": "Submit 10 assignments", "icon": "📝", "criteria": {"event": "assignment_submitted", "min_count": 10}},
    {"name": "Consistent Learner", "description": "Log in for 7 consecutive days", "icon": "🔥", "criteria": {"event": "daily_login", "min_count": 7}},
]

DEFAULT_ACHIEVEMENTS = [
    {"name": "First Lesson Completed", "description": "You completed your first lesson!", "icon": "📖", "points_reward": 10.0, "criteria": {"event": "lesson_completed", "min_count": 1}},
    {"name": "First Quiz Passed", "description": "You passed your first quiz!", "icon": "✅", "points_reward": 25.0, "criteria": {"event": "quiz_passed", "min_count": 1}},
    {"name": "5 Quizzes Completed", "description": "You completed 5 quizzes!", "icon": "🎯", "points_reward": 50.0, "criteria": {"event": "quiz_passed", "min_count": 5}},
    {"name": "First Course Completed", "description": "You completed your first course!", "icon": "🏆", "points_reward": 100.0, "criteria": {"event": "course_completed", "min_count": 1}},
]


def _get_default_levels(organization_id: int) -> List[LevelDefinition]:
    """Return default level definitions as LevelDefinition objects for an organization."""
    levels = []
    for i, level_data in enumerate(DEFAULT_LEVELS):
        level = LevelDefinition(
            organization_id=organization_id,
            name=level_data["name"],
            threshold_points=level_data["threshold_points"],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            is_deleted=False,
        )
        level.id = -(i + 1)  # Temporary negative ID for default levels
        levels.append(level)
    return levels


def _get_default_badges(organization_id: int) -> List[Badge]:
    """Return default badge definitions as Badge objects for an organization."""
    badges = []
    for i, badge_data in enumerate(DEFAULT_BADGES):
        badge = Badge(
            organization_id=organization_id,
            name=badge_data["name"],
            description=badge_data["description"],
            icon=badge_data["icon"],
            criteria=badge_data["criteria"],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            is_deleted=False,
        )
        badge.id = -(i + 1)  # Temporary negative ID for default badges
        badges.append(badge)
    return badges


def _get_default_achievements(organization_id: int) -> List[Achievement]:
    """Return default achievement definitions as Achievement objects for an organization."""
    achievements = []
    for i, ach_data in enumerate(DEFAULT_ACHIEVEMENTS):
        achievement = Achievement(
            organization_id=organization_id,
            name=ach_data["name"],
            description=ach_data["description"],
            icon=ach_data["icon"],
            criteria=ach_data["criteria"],
            points_reward=ach_data["points_reward"],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            is_deleted=False,
        )
        achievement.id = -(i + 1)  # Temporary negative ID for default achievements
        achievements.append(achievement)
    return achievements


def _criteria_matches_event(criteria: dict[str, Any] | None, event_type: str, event_context: dict[str, Any]) -> bool:
    if not isinstance(criteria, dict):
        return False
    if criteria.get("event") != event_type:
        return False

    for key, expected in criteria.items():
        if key == "event":
            continue
        if key == "min_score":
            score = event_context.get("score")
            if score is None or float(score) < float(expected):
                return False
        elif key == "min_percentage":
            percent = event_context.get("percent")
            if percent is None or float(percent) < float(expected):
                return False
        elif key == "min_count":
            if int(event_context.get("count", 0)) < int(expected):
                return False
        elif key == "required_count":
            if int(event_context.get("count", 0)) != int(expected):
                return False
        else:
            if event_context.get(key) != expected:
                return False
    return True


def trigger_gamification_event(db: Session, user: User, event_type: str, event_context: dict[str, Any]) -> dict[str, list]:
    awarded_badges: list[UserBadge] = []
    awarded_achievements: list[UserAchievement] = []

    badges = (
        db.query(Badge)
        .filter_by(organization_id=user.organization_id, is_deleted=False)
        .all()
    )
    achievements = (
        db.query(Achievement)
        .filter_by(organization_id=user.organization_id, is_deleted=False)
        .all()
    )

    for badge in badges:
        if _criteria_matches_event(badge.criteria, event_type, event_context):
            awarded_badges.append(award_badge(db, user, badge))

    for achievement in achievements:
        if _criteria_matches_event(achievement.criteria, event_type, event_context):
            awarded_achievements.append(award_achievement(db, user, achievement))

    return {
        "badges": awarded_badges,
        "achievements": awarded_achievements,
    }


def create_badge(db: Session, organization: Organization, payload) -> Badge:
    badge = Badge(
        organization_id=organization.id,
        name=payload.name,
        description=payload.description,
        icon=payload.icon,
        criteria=payload.criteria,
    )
    db.add(badge)
    db.commit()
    db.refresh(badge)
    return badge


def update_badge(db: Session, badge_id: int, organization: Organization, payload) -> Badge:
    badge = db.query(Badge).filter_by(id=badge_id, organization_id=organization.id, is_deleted=False).first()
    if not badge:
        raise ValueError("Badge not found")
    if payload.name is not None:
        badge.name = payload.name
    if payload.description is not None:
        badge.description = payload.description
    if payload.icon is not None:
        badge.icon = payload.icon
    if payload.criteria is not None:
        badge.criteria = payload.criteria
    db.commit()
    db.refresh(badge)
    return badge


def delete_badge(db: Session, badge_id: int, organization: Organization) -> Badge:
    badge = db.query(Badge).filter_by(id=badge_id, organization_id=organization.id, is_deleted=False).first()
    if not badge:
        raise ValueError("Badge not found")
    badge.is_deleted = True
    badge.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return badge


def list_badges(db: Session, organization: Organization) -> List[Badge]:
    db_badges = (
        db.query(Badge)
        .filter_by(organization_id=organization.id, is_deleted=False)
        .order_by(Badge.name)
        .all()
    )
    if db_badges:
        return db_badges
    # Return default badges if none in DB
    return _get_default_badges(organization.id)


def create_achievement(db: Session, organization: Organization, payload) -> Achievement:
    achievement = Achievement(
        organization_id=organization.id,
        name=payload.name,
        description=payload.description,
        icon=payload.icon,
        criteria=payload.criteria,
        points_reward=payload.points_reward,
    )
    db.add(achievement)
    db.commit()
    db.refresh(achievement)
    return achievement


def update_achievement(db: Session, achievement_id: int, organization: Organization, payload) -> Achievement:
    achievement = db.query(Achievement).filter_by(id=achievement_id, organization_id=organization.id, is_deleted=False).first()
    if not achievement:
        raise ValueError("Achievement not found")
    if payload.name is not None:
        achievement.name = payload.name
    if payload.description is not None:
        achievement.description = payload.description
    if payload.icon is not None:
        achievement.icon = payload.icon
    if payload.criteria is not None:
        achievement.criteria = payload.criteria
    if payload.points_reward is not None:
        achievement.points_reward = payload.points_reward
    db.commit()
    db.refresh(achievement)
    return achievement


def delete_achievement(db: Session, achievement_id: int, organization: Organization) -> Achievement:
    achievement = db.query(Achievement).filter_by(id=achievement_id, organization_id=organization.id, is_deleted=False).first()
    if not achievement:
        raise ValueError("Achievement not found")
    achievement.is_deleted = True
    achievement.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return achievement


def list_achievements(db: Session, organization: Organization) -> List[Achievement]:
    db_achievements = (
        db.query(Achievement)
        .filter_by(organization_id=organization.id, is_deleted=False)
        .order_by(Achievement.name)
        .all()
    )
    if db_achievements:
        return db_achievements
    # Return default achievements if none in DB
    return _get_default_achievements(organization.id)


def create_level_definition(db: Session, organization: Organization, payload) -> LevelDefinition:
    level = LevelDefinition(
        organization_id=organization.id,
        name=payload.name,
        description=payload.description,
        threshold_points=payload.threshold_points,
    )
    db.add(level)
    db.commit()
    db.refresh(level)
    return level


def update_level_definition(db: Session, level_id: int, organization: Organization, payload) -> LevelDefinition:
    level = db.query(LevelDefinition).filter_by(id=level_id, organization_id=organization.id, is_deleted=False).first()
    if not level:
        raise ValueError("Level not found")
    if payload.name is not None:
        level.name = payload.name
    if payload.description is not None:
        level.description = payload.description
    if payload.threshold_points is not None:
        level.threshold_points = payload.threshold_points
    db.commit()
    db.refresh(level)
    return level


def delete_level_definition(db: Session, level_id: int, organization: Organization) -> LevelDefinition:
    level = db.query(LevelDefinition).filter_by(id=level_id, organization_id=organization.id, is_deleted=False).first()
    if not level:
        raise ValueError("Level not found")
    level.is_deleted = True
    level.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return level


def list_levels(db: Session, organization: Organization) -> List[LevelDefinition]:
    db_levels = (
        db.query(LevelDefinition)
        .filter_by(organization_id=organization.id, is_deleted=False)
        .order_by(LevelDefinition.threshold_points)
        .all()
    )
    if db_levels:
        return db_levels
    # Return default levels if none in DB
    return _get_default_levels(organization.id)


def create_leaderboard(db: Session, organization: Organization, payload) -> Leaderboard:
    leaderboard = Leaderboard(
        organization_id=organization.id,
        name=payload.name,
        description=payload.description,
        metric=payload.metric,
        is_public=payload.is_public,
    )
    db.add(leaderboard)
    db.commit()
    db.refresh(leaderboard)
    return leaderboard


def update_leaderboard(db: Session, leaderboard_id: int, organization: Organization, payload) -> Leaderboard:
    leaderboard = db.query(Leaderboard).filter_by(id=leaderboard_id, organization_id=organization.id, is_deleted=False).first()
    if not leaderboard:
        raise ValueError("Leaderboard not found")
    if payload.name is not None:
        leaderboard.name = payload.name
    if payload.description is not None:
        leaderboard.description = payload.description
    if payload.metric is not None:
        leaderboard.metric = payload.metric
    if payload.is_public is not None:
        leaderboard.is_public = payload.is_public
    db.commit()
    db.refresh(leaderboard)
    return leaderboard


def delete_leaderboard(db: Session, leaderboard_id: int, organization: Organization) -> Leaderboard:
    leaderboard = db.query(Leaderboard).filter_by(id=leaderboard_id, organization_id=organization.id, is_deleted=False).first()
    if not leaderboard:
        raise ValueError("Leaderboard not found")
    leaderboard.is_deleted = True
    leaderboard.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return leaderboard


def list_leaderboards(db: Session, organization: Organization) -> List[Leaderboard]:
    return (
        db.query(Leaderboard)
        .filter_by(organization_id=organization.id, is_deleted=False)
        .order_by(Leaderboard.name)
        .all()
    )


def get_leaderboard(db: Session, leaderboard_id: int, organization: Organization) -> Leaderboard | None:
    return db.query(Leaderboard).filter_by(id=leaderboard_id, organization_id=organization.id, is_deleted=False).first()


def get_or_create_user_progress(db: Session, user: User) -> UserProgress:
    progress = (
        db.query(UserProgress)
        .filter_by(user_id=user.id, organization_id=user.organization_id, is_deleted=False)
        .first()
    )
    if progress:
        return progress
    progress = UserProgress(user_id=user.id, organization_id=user.organization_id, total_points=0.0)
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


def get_level_for_points(db: Session, organization_id: int, total_points: float) -> LevelDefinition | None:
    db_level = (
        db.query(LevelDefinition)
        .filter(LevelDefinition.organization_id == organization_id, LevelDefinition.is_deleted == False)
        .filter(LevelDefinition.threshold_points <= total_points)
        .order_by(LevelDefinition.threshold_points.desc())
        .first()
    )
    if db_level:
        return db_level
    
    # Use default levels if none in DB
    default_levels = _get_default_levels(organization_id)
    for level in reversed(default_levels):
        if level.threshold_points <= total_points:
            return level
    return None


def get_next_level_threshold(db: Session, organization_id: int, total_points: float) -> float | None:
    db_next_level = (
        db.query(LevelDefinition)
        .filter(LevelDefinition.organization_id == organization_id, LevelDefinition.is_deleted == False)
        .filter(LevelDefinition.threshold_points > total_points)
        .order_by(LevelDefinition.threshold_points)
        .first()
    )
    if db_next_level:
        return db_next_level.threshold_points
    
    # Use default levels if none in DB
    default_levels = _get_default_levels(organization_id)
    for level in default_levels:
        if level.threshold_points > total_points:
            return level.threshold_points
    return None


def update_user_points(db: Session, user: User, points_delta: float) -> UserProgress:
    if points_delta == 0:
        return get_or_create_user_progress(db, user)
    progress = get_or_create_user_progress(db, user)
    progress.total_points = max(0.0, progress.total_points + points_delta)
    current_level = get_level_for_points(db, user.organization_id, progress.total_points)
    progress.level_id = current_level.id if current_level else None
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


def award_badge(db: Session, user: User, badge: Badge) -> UserBadge:
    existing = (
        db.query(UserBadge)
        .filter_by(
            organization_id=user.organization_id,
            user_id=user.id,
            badge_id=badge.id,
            is_deleted=False,
        )
        .first()
    )
    if existing:
        return existing
    user_badge = UserBadge(
        organization_id=user.organization_id,
        user_id=user.id,
        badge_id=badge.id,
    )
    db.add(user_badge)
    db.commit()
    db.refresh(user_badge)
    return user_badge


def award_achievement(db: Session, user: User, achievement: Achievement) -> UserAchievement:
    existing = (
        db.query(UserAchievement)
        .filter_by(
            organization_id=user.organization_id,
            user_id=user.id,
            achievement_id=achievement.id,
            is_deleted=False,
        )
        .first()
    )
    if existing:
        return existing
    user_achievement = UserAchievement(
        organization_id=user.organization_id,
        user_id=user.id,
        achievement_id=achievement.id,
    )
    db.add(user_achievement)
    if achievement.points_reward:
        progress = get_or_create_user_progress(db, user)
        progress.total_points = max(0.0, progress.total_points + achievement.points_reward)
        current_level = get_level_for_points(db, user.organization_id, progress.total_points)
        progress.level_id = current_level.id if current_level else None
        db.add(progress)
    db.commit()
    db.refresh(user_achievement)
    return user_achievement


def list_user_badges(db: Session, user: User) -> List[UserBadge]:
    return (
        db.query(UserBadge)
        .filter_by(user_id=user.id, organization_id=user.organization_id, is_deleted=False)
        .order_by(UserBadge.awarded_at.desc())
        .all()
    )


def list_user_achievements(db: Session, user: User) -> List[UserAchievement]:
    return (
        db.query(UserAchievement)
        .filter_by(user_id=user.id, organization_id=user.organization_id, is_deleted=False)
        .order_by(UserAchievement.awarded_at.desc())
        .all()
    )


def list_leaderboard_entries(db: Session, leaderboard_id: int, organization: Organization) -> List[LeaderboardEntry]:
    return (
        db.query(LeaderboardEntry)
        .filter_by(leaderboard_id=leaderboard_id, organization_id=organization.id, is_deleted=False)
        .order_by(LeaderboardEntry.rank, desc(LeaderboardEntry.score))
        .all()
    )


def list_leaderboard_entries_with_users(db: Session, leaderboard_id: int, organization: Organization) -> List[dict]:
    entries = (
        db.query(
            LeaderboardEntry.id,
            LeaderboardEntry.leaderboard_id,
            LeaderboardEntry.user_id,
            LeaderboardEntry.score,
            LeaderboardEntry.rank,
            LeaderboardEntry.created_at,
            LeaderboardEntry.updated_at,
            User.full_name.label('user_name'),
            UserProgress.total_points.label('user_points')
        )
        .join(User, LeaderboardEntry.user_id == User.id)
        .outerjoin(UserProgress, User.id == UserProgress.user_id)
        .filter(
            LeaderboardEntry.leaderboard_id == leaderboard_id,
            LeaderboardEntry.organization_id == organization.id,
            LeaderboardEntry.is_deleted == False,
            User.is_deleted == False
        )
        .order_by(LeaderboardEntry.rank, desc(LeaderboardEntry.score))
        .all()
    )
    
    # Add level info to each entry
    result = []
    for entry in entries:
        level = get_level_for_points(db, organization.id, entry.user_points or 0)
        result.append({
            **entry._asdict(),
            'user_level': level.name if level else 'Level 1'
        })
    return result


def update_leaderboard_entry(db: Session, leaderboard_id: int, user: User, score: float) -> LeaderboardEntry:
    leaderboard = get_leaderboard(db, leaderboard_id, user.organization)
    if not leaderboard:
        raise ValueError("Leaderboard not found")
    entry = (
        db.query(LeaderboardEntry)
        .filter_by(
            leaderboard_id=leaderboard_id,
            user_id=user.id,
            organization_id=user.organization_id,
            is_deleted=False,
        )
        .first()
    )
    if entry:
        entry.score = score
    else:
        entry = LeaderboardEntry(
            organization_id=user.organization_id,
            leaderboard_id=leaderboard_id,
            user_id=user.id,
            score=score,
            rank=0.0,
        )
        db.add(entry)
    db.commit()
    refresh_leaderboard_ranks(db, leaderboard_id, user.organization_id)
    db.refresh(entry)
    return entry


def refresh_leaderboard_ranks(db: Session, leaderboard_id: int, organization_id: int) -> None:
    entries = (
        db.query(LeaderboardEntry)
        .filter_by(leaderboard_id=leaderboard_id, organization_id=organization_id, is_deleted=False)
        .order_by(desc(LeaderboardEntry.score), LeaderboardEntry.updated_at)
        .all()
    )
    for index, entry in enumerate(entries, start=1):
        entry.rank = float(index)
    db.commit()


def get_user_summary(db: Session, user: User) -> dict:
    progress = get_or_create_user_progress(db, user)
    current_level = None
    if progress.level_id:
        current_level = db.query(LevelDefinition).filter_by(id=progress.level_id, organization_id=user.organization_id, is_deleted=False).first()
    next_level_threshold = get_next_level_threshold(db, user.organization_id, progress.total_points)
    badges = list_user_badges(db, user)
    achievements = list_user_achievements(db, user)
    return {
        "total_points": progress.total_points,
        "current_level": current_level,
        "next_level_threshold": next_level_threshold,
        "badges": badges,
        "achievements": achievements,
    }
