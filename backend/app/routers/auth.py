from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import schemas
from app.config import settings
from app.dependencies import get_current_active_user, get_current_user, get_db, get_tenant
from app.services import auth as auth_service

from app.models import User as UserModel

router = APIRouter()


@router.post("/register", response_model=schemas.RegistrationResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant),
):
    try:
        user = auth_service.create_user(
            db=db,
            email=payload.email,
            password=payload.password,
            tenant_id=tenant_id,
            full_name=payload.full_name,
            role_name=payload.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IntegrityError as exc:
        if "email" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address is already registered.") from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration failed due to a data constraint.") from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    verification_token = auth_service.create_email_verification_token(user)
    return {"user": user, "verification_token": verification_token}


@router.post("/login", response_model=schemas.LoginResponse)
@router.post("/token", response_model=schemas.LoginResponse)
def login_for_tokens(
    form_data: schemas.LoginData,
    db: Session = Depends(get_db),
    tenant_id: str | None = Header(None, alias=settings.tenant_header),
):
    user = auth_service.authenticate_user(db, form_data.email, form_data.password, tenant_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session_id = auth_service.generate_session_id()
    refresh_token = auth_service.build_refresh_token(user, session_id=session_id)
    auth_service.create_auth_session(db, user, session_id=session_id, refresh_token=refresh_token)
    access_token = auth_service.build_access_token(user, session_id=session_id)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": 60 * 60,
    }


@router.post("/logout")
def logout(request: schemas.RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        auth_service.logout_refresh_token(db, request.refresh_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return {"detail": "Logged out successfully."}


@router.post("/refresh", response_model=schemas.RefreshTokenResponse)
def refresh_access_token(request: schemas.RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        access_token, refresh_token = auth_service.refresh_access_token(db, request.refresh_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": 60 * 60,
    }


@router.get("/me", response_model=schemas.UserRead)
def read_current_user(current_user: UserModel = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=schemas.UserRead)
def update_current_user(
    payload: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user),
):
    updates = payload.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(current_user, field, value)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/verify-email")
def verify_email(request: schemas.VerifyEmailRequest, db: Session = Depends(get_db)):
    try:
        auth_service.verify_user_email(db, request.token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"detail": "Email verified."}


@router.post("/password-reset-request")
def password_reset_request(request: schemas.PasswordResetRequest, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant)):
    user = auth_service.get_user_by_email_and_tenant(db, request.email, tenant_id)
    if user:
        reset_token = auth_service.create_password_reset_token(user)
        return {"detail": "Password reset token created.", "reset_token": reset_token}

    return {"detail": "If the email exists, a reset link will be sent."}


@router.post("/reset-password")
@router.post("/password-reset")
def password_reset(request: schemas.PasswordResetBody, db: Session = Depends(get_db)):
    try:
        auth_service.reset_user_password(db, request.token, request.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"detail": "Password has been reset."}
