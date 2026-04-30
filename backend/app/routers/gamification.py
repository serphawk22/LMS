from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import (
    get_current_active_user,
    get_current_admin_user,
    get_db,
    get_tenant,
)
from app.models import Achievement, Badge, User
from app.services import auth as auth_service
from app.services import gamification as gamification_service

router = APIRouter()


def _get_organization(tenant_id: str, db: Session, current_user: User):
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    return organization


@router.post("/admin/badges", response_model=schemas.BadgeRead, status_code=status.HTTP_201_CREATED)
def create_badge(
    payload: schemas.BadgeCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.create_badge(db, organization, payload)


@router.get("/admin/badges", response_model=list[schemas.BadgeRead])
def list_badges(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.list_badges(db, organization)


@router.patch("/admin/badges/{badge_id}", response_model=schemas.BadgeRead)
def update_badge(
    badge_id: int,
    payload: schemas.BadgeUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    try:
        return gamification_service.update_badge(db, badge_id, organization, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/admin/badges/{badge_id}", response_model=schemas.BadgeRead)
def delete_badge(
    badge_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    try:
        return gamification_service.delete_badge(db, badge_id, organization)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/admin/achievements", response_model=schemas.AchievementRead, status_code=status.HTTP_201_CREATED)
def create_achievement(
    payload: schemas.AchievementCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.create_achievement(db, organization, payload)


@router.get("/admin/achievements", response_model=list[schemas.AchievementRead])
def list_achievements(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.list_achievements(db, organization)


@router.patch("/admin/achievements/{achievement_id}", response_model=schemas.AchievementRead)
def update_achievement(
    achievement_id: int,
    payload: schemas.AchievementUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    try:
        return gamification_service.update_achievement(db, achievement_id, organization, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/admin/achievements/{achievement_id}", response_model=schemas.AchievementRead)
def delete_achievement(
    achievement_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    try:
        return gamification_service.delete_achievement(db, achievement_id, organization)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/admin/levels", response_model=schemas.LevelDefinitionRead, status_code=status.HTTP_201_CREATED)
def create_level(
    payload: schemas.LevelDefinitionCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.create_level_definition(db, organization, payload)


@router.get("/admin/levels", response_model=list[schemas.LevelDefinitionRead])
def list_levels(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.list_levels(db, organization)


@router.patch("/admin/levels/{level_id}", response_model=schemas.LevelDefinitionRead)
def update_level(
    level_id: int,
    payload: schemas.LevelDefinitionUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    try:
        return gamification_service.update_level_definition(db, level_id, organization, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/admin/levels/{level_id}", response_model=schemas.LevelDefinitionRead)
def delete_level(
    level_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    try:
        return gamification_service.delete_level_definition(db, level_id, organization)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/admin/leaderboards", response_model=schemas.LeaderboardRead, status_code=status.HTTP_201_CREATED)
def create_leaderboard(
    payload: schemas.LeaderboardCreate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.create_leaderboard(db, organization, payload)


@router.get("/leaderboards", response_model=list[schemas.LeaderboardRead])
def get_leaderboards(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.list_leaderboards(db, organization)


@router.patch("/admin/leaderboards/{leaderboard_id}", response_model=schemas.LeaderboardRead)
def update_leaderboard(
    leaderboard_id: int,
    payload: schemas.LeaderboardUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    try:
        return gamification_service.update_leaderboard(db, leaderboard_id, organization, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/admin/leaderboards/{leaderboard_id}", response_model=schemas.LeaderboardRead)
def delete_leaderboard(
    leaderboard_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    try:
        return gamification_service.delete_leaderboard(db, leaderboard_id, organization)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/leaderboards/{leaderboard_id}/entries", response_model=list[schemas.LeaderboardEntryRead])
def list_leaderboard_entries(
    leaderboard_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.list_leaderboard_entries(db, leaderboard_id, organization)


@router.get("/leaderboards/{leaderboard_id}/entries/with-users", response_model=list[schemas.LeaderboardEntryWithUserRead])
def list_leaderboard_entries_with_users(
    leaderboard_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.list_leaderboard_entries_with_users(db, leaderboard_id, organization)


@router.post("/leaderboards/{leaderboard_id}/entries", response_model=schemas.LeaderboardEntryRead)
def update_leaderboard_entry(
    leaderboard_id: int,
    payload: schemas.UserPointsUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        return gamification_service.update_leaderboard_entry(db, leaderboard_id, current_user, payload.points_delta)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/users/me/stats", response_model=schemas.GamificationSummaryRead)
def get_my_stats(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization(tenant_id, db, current_user)
    return gamification_service.get_user_summary(db, current_user)


@router.get("/users/me/badges", response_model=list[schemas.UserBadgeRead])
def get_my_badges(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization(tenant_id, db, current_user)
    return gamification_service.list_user_badges(db, current_user)


@router.get("/users/me/achievements", response_model=list[schemas.UserAchievementRead])
def get_my_achievements(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization(tenant_id, db, current_user)
    return gamification_service.list_user_achievements(db, current_user)


@router.get("/badges", response_model=list[schemas.BadgeRead])
def get_all_badges(
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    return gamification_service.list_badges(db, organization)


@router.post("/users/me/points", response_model=schemas.UserProgressRead)
def add_my_points(
    payload: schemas.UserPointsUpdate,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _get_organization(tenant_id, db, current_user)
    return gamification_service.update_user_points(db, current_user, payload.points_delta)


@router.post("/admin/users/{user_id}/badges/{badge_id}/award", response_model=schemas.UserBadgeRead)
def award_badge(
    user_id: int,
    badge_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    target_user = db.query(User).filter_by(id=user_id, organization_id=organization.id, is_deleted=False).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    badge = db.query(Badge).filter_by(id=badge_id, organization_id=organization.id, is_deleted=False).first()
    if badge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Badge not found")
    return gamification_service.award_badge(db, target_user, badge)


@router.post("/admin/users/{user_id}/achievements/{achievement_id}/award", response_model=schemas.UserAchievementRead)
def award_achievement(
    user_id: int,
    achievement_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    organization = _get_organization(tenant_id, db, current_user)
    target_user = db.query(User).filter_by(id=user_id, organization_id=organization.id, is_deleted=False).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    achievement = db.query(Achievement).filter_by(id=achievement_id, organization_id=organization.id, is_deleted=False).first()
    if achievement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Achievement not found")
    return gamification_service.award_achievement(db, target_user, achievement)
