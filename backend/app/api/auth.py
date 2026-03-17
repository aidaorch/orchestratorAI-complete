"""Authentication API routes"""
import re
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from ..database import get_db
from ..models.user import User
from ..models.token import RefreshToken
from ..models.workflow import Workflow
from ..models.template import Template
from ..schemas.user import (
    UserCreate, UserLogin, Token, TokenRefresh, UserResponse,
    UserProfileUpdate, UserPasswordChange, UserStatsResponse
)
from ..core.security import hash_password, verify_password, create_access_token, create_refresh_token, verify_token
from ..config import settings
from ..api.deps import get_current_user
from ..services.audit_service import log_action
from ..core.limiter import limiter

router = APIRouter()

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]+$')


# ── Register ──────────────────────────────────────────────────────────────────
@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
@limiter.limit("10/hour")
async def register(user_data: UserCreate, request: Request, db: Session = Depends(get_db)):
    if not USERNAME_RE.match(user_data.username):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Username can only contain letters, numbers, and underscores")

    if db.query(User).filter(User.username.ilike(user_data.username)).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Username already taken. Please choose another one.")

    if db.query(User).filter(User.email.ilike(user_data.email)).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Email already registered. Please use a different email or login.")

    try:
        user = User(
            username=user_data.username,
            email=user_data.email.lower(),
            password_hash=hash_password(user_data.password),
            full_name=user_data.full_name or ""
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        log_action(db, action="REGISTER", user_id=user.user_id, username=user.username,
                   resource_type="user", resource_id=str(user.user_id),
                   ip_address=request.client.host if request.client else None,
                   user_agent=request.headers.get("user-agent"))
        return user
    except Exception as e:
        db.rollback()
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to create user: {str(e)}")


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.username == credentials.username) | (User.email == credentials.username.lower())
    ).first()

    if not user or not verify_password(credentials.password, user.password_hash):
        log_action(db, action="LOGIN_FAILED", username=credentials.username,
                   status="failure", detail="Invalid credentials",
                   ip_address=request.client.host if request.client else None,
                   user_agent=request.headers.get("user-agent"))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect username/email or password",
                            headers={"WWW-Authenticate": "Bearer"})

    if not user.is_active:
        log_action(db, action="LOGIN_FAILED", user_id=user.user_id, username=user.username,
                   status="failure", detail="Account inactive",
                   ip_address=request.client.host if request.client else None,
                   user_agent=request.headers.get("user-agent"))
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            detail="Account is inactive. Please contact support.")

    access_token = create_access_token(data={"sub": str(user.user_id)})
    refresh_token_str = create_refresh_token(data={"sub": str(user.user_id)})

    token_hash = hashlib.sha256(refresh_token_str.encode()).hexdigest()
    db.add(RefreshToken(
        user_id=user.user_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    ))
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    log_action(db, action="LOGIN", user_id=user.user_id, username=user.username,
               resource_type="user", resource_id=str(user.user_id),
               ip_address=request.client.host if request.client else None,
               user_agent=request.headers.get("user-agent"))

    return Token(
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="Bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )


# ── Token Refresh ─────────────────────────────────────────────────────────────
@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh_token(token_data: TokenRefresh, request: Request, db: Session = Depends(get_db)):
    payload = verify_token(token_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    token_hash = hashlib.sha256(token_data.refresh_token.encode()).hexdigest()
    stored = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False
    ).first()

    if not stored:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token revoked or not found")
    if stored.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    return {
        "access_token": create_access_token(data={"sub": user_id}),
        "token_type": "Bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }


# ── Logout ────────────────────────────────────────────────────────────────────
@router.post("/logout")
async def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.user_id
    ).update({"revoked": True})
    db.commit()
    log_action(db, action="LOGOUT", user_id=current_user.user_id, username=current_user.username,
               resource_type="user", resource_id=str(current_user.user_id),
               ip_address=request.client.host if request.client else None,
               user_agent=request.headers.get("user-agent"))
    return {"message": "Logged out successfully"}


# ── Get current user ──────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


# ── Get profile stats ─────────────────────────────────────────────────────────
@router.get("/me/stats", response_model=UserStatsResponse)
async def get_profile_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflow_count = db.query(Workflow).filter(
        Workflow.user_id == current_user.user_id,
        Workflow.is_template == False
    ).count()

    template_count = db.query(Template).filter(
        Template.user_id == current_user.user_id
    ).count()

    return UserStatsResponse(
        workflow_count=workflow_count,
        template_count=template_count,
        member_since=current_user.created_at,
        last_login=current_user.last_login
    )


# ── Update profile (full_name) ────────────────────────────────────────────────
@router.patch("/me", response_model=UserResponse)
async def update_profile(
    update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.full_name = update.full_name.strip()
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    # Also update localStorage-cached user on client side (client handles this)
    return current_user


# ── Change password ───────────────────────────────────────────────────────────
@router.post("/me/change-password")
async def change_password(
    data: UserPasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Current password is incorrect")

    if data.new_password == data.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="New password must be different from current password")

    current_user.password_hash = hash_password(data.new_password)
    current_user.updated_at = datetime.now(timezone.utc)

    # Revoke all refresh tokens — force re-login on other devices
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.user_id
    ).update({"revoked": True})

    db.commit()
    return {"message": "Password changed successfully. Please log in again on other devices."}


# ── Delete account ────────────────────────────────────────────────────────────
@router.delete("/me")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}
