"""Audit log model"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from ..database import Base


class AuditLog(Base):
    """Records key user and admin actions for audit trail"""
    __tablename__ = "audit_logs"

    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    username = Column(String(50))                  # denormalized — survives user deletion
    action = Column(String(100), nullable=False)   # e.g. LOGIN, LOGOUT, WORKFLOW_CREATE
    resource_type = Column(String(50))             # e.g. workflow, template, user
    resource_id = Column(String(255))              # UUID of the affected resource
    ip_address = Column(String(45))                # IPv4 or IPv6
    user_agent = Column(Text)
    status = Column(String(20), default="success") # success | failure
    detail = Column(Text)                          # optional extra context
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
