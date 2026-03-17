"""Admin API routes — all endpoints require is_admin=True"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from ..database import get_db
from ..models.user import User
from ..models.workflow import Workflow
from ..models.template import Template
from ..models.execution import WorkflowExecution
from ..models.audit import AuditLog
from ..api.deps import require_admin
from ..core.security import hash_password
from ..services.audit_service import log_action

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class AdminUserItem(BaseModel):
    user_id: str
    username: str
    email: str
    full_name: Optional[str]
    is_active: bool
    is_admin: bool
    created_at: datetime
    last_login: Optional[datetime]
    workflow_count: int
    template_count: int

    class Config:
        from_attributes = True


class AdminWorkflowItem(BaseModel):
    workflow_id: str
    workflow_name: str
    username: str
    step_count: Optional[int]
    original_prompt: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AdminTemplateItem(BaseModel):
    template_id: str
    name: str
    username: str
    usage_count: int
    is_public: bool
    step_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    admin_users: int
    new_users_this_week: int
    total_workflows: int
    total_templates: int
    total_executions: int


class UserToggleRequest(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


class AdminPasswordResetRequest(BaseModel):
    new_password: str


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from datetime import timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)

    return AdminStatsResponse(
        total_users=db.query(User).count(),
        active_users=db.query(User).filter(User.is_active == True).count(),
        admin_users=db.query(User).filter(User.is_admin == True).count(),
        new_users_this_week=db.query(User).filter(User.created_at >= week_ago).count(),
        total_workflows=db.query(Workflow).filter(Workflow.is_template == False).count(),
        total_templates=db.query(Template).count(),
        total_executions=db.query(WorkflowExecution).count(),
    )


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (User.username.ilike(like)) | (User.email.ilike(like))
        )

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    items = []
    for u in users:
        wf_count = db.query(Workflow).filter(
            Workflow.user_id == u.user_id, Workflow.is_template == False
        ).count()
        tpl_count = db.query(Template).filter(Template.user_id == u.user_id).count()
        items.append(AdminUserItem(
            user_id=str(u.user_id),
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            is_active=u.is_active,
            is_admin=u.is_admin,
            created_at=u.created_at,
            last_login=u.last_login,
            workflow_count=wf_count,
            template_count=tpl_count,
        ))

    return {"users": items, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    body: UserToggleRequest,
    http_request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent admin from deactivating or demoting themselves
    if str(user.user_id) == str(current_admin.user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot modify your own admin account")

    if body.is_active is not None:
        user.is_active = body.is_active
    if body.is_admin is not None:
        user.is_admin = body.is_admin

    db.commit()
    log_action(db, action="ADMIN_USER_UPDATE", user_id=current_admin.user_id,
               username=current_admin.username, resource_type="user",
               resource_id=str(user_id),
               detail=f"is_active={body.is_active}, is_admin={body.is_admin}",
               ip_address=http_request.client.host if http_request.client else None,
               user_agent=http_request.headers.get("user-agent"))
    return {"message": "User updated", "user_id": str(user_id)}


@router.post("/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: UUID,
    body: AdminPasswordResetRequest,
    http_request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if len(body.new_password) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(body.new_password)
    db.commit()
    log_action(db, action="ADMIN_PASSWORD_RESET", user_id=current_admin.user_id,
               username=current_admin.username, resource_type="user",
               resource_id=str(user_id),
               ip_address=http_request.client.host if http_request.client else None,
               user_agent=http_request.headers.get("user-agent"))
    return {"message": "Password reset successfully"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    http_request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if str(user_id) == str(current_admin.user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    deleted_username = user.username
    db.delete(user)
    db.commit()
    log_action(db, action="ADMIN_USER_DELETE", user_id=current_admin.user_id,
               username=current_admin.username, resource_type="user",
               resource_id=str(user_id), detail=f"Deleted user: {deleted_username}",
               ip_address=http_request.client.host if http_request.client else None,
               user_agent=http_request.headers.get("user-agent"))
    return {"message": "User deleted"}


# ── Workflows ─────────────────────────────────────────────────────────────────

@router.get("/workflows")
async def list_all_workflows(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Workflow, User.username).join(User, Workflow.user_id == User.user_id).filter(
        Workflow.is_template == False
    )
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Workflow.workflow_name.ilike(like)) | (User.username.ilike(like))
        )

    total = query.count()
    rows = query.order_by(Workflow.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    items = [
        AdminWorkflowItem(
            workflow_id=str(w.workflow_id),
            workflow_name=w.workflow_name,
            username=username,
            step_count=w.step_count,
            original_prompt=(w.original_prompt or "")[:120],
            created_at=w.created_at,
        )
        for w, username in rows
    ]

    return {"workflows": items, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(
    workflow_id: UUID,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    wf = db.query(Workflow).filter(Workflow.workflow_id == workflow_id).first()
    if not wf:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    db.delete(wf)
    db.commit()
    return {"message": "Workflow deleted"}


# ── Templates ─────────────────────────────────────────────────────────────────

@router.get("/templates")
async def list_all_templates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Template, User.username).join(User, Template.user_id == User.user_id)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Template.name.ilike(like)) | (User.username.ilike(like))
        )

    total = query.count()
    rows = query.order_by(Template.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    items = [
        AdminTemplateItem(
            template_id=str(t.template_id),
            name=t.name,
            username=username,
            usage_count=t.usage_count or 0,
            is_public=t.is_public or False,
            step_count=len(t.workflow_data.get("steps", [])) if t.workflow_data else 0,
            created_at=t.created_at,
        )
        for t, username in rows
    ]

    return {"templates": items, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: UUID,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tpl = db.query(Template).filter(Template.template_id == template_id).first()
    if not tpl:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Template not found")
    db.delete(tpl)
    db.commit()
    return {"message": "Template deleted"}


# ── Audit Logs ────────────────────────────────────────────────────────────────

@router.get("/audit-logs")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if username:
        query = query.filter(AuditLog.username.ilike(f"%{username}%"))

    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "logs": [
            {
                "log_id": str(log.log_id),
                "username": log.username,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address,
                "status": log.status,
                "detail": log.detail,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }
