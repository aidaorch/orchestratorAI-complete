"""Audit logging service"""
from sqlalchemy.orm import Session
from ..models.audit import AuditLog
import logging

logger = logging.getLogger(__name__)


def log_action(
    db: Session,
    action: str,
    user_id: str = None,
    username: str = None,
    resource_type: str = None,
    resource_id: str = None,
    ip_address: str = None,
    user_agent: str = None,
    status: str = "success",
    detail: str = None,
):
    """Write an audit log entry. Never raises — failures are logged to server log only."""
    try:
        entry = AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status,
            detail=detail,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to write audit log: {e}")
