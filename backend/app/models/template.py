"""Template models"""
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from ..database import Base


class Template(Base):
    """Template model"""
    __tablename__ = "templates"
    
    template_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    workflow_data = Column(JSONB, nullable=False)
    tags = Column(ARRAY(String))
    version_number = Column(Integer, default=1)
    is_public = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="templates")
    versions = relationship("TemplateVersion", back_populates="template", cascade="all, delete-orphan")


class TemplateVersion(Base):
    """Template version model"""
    __tablename__ = "template_versions"
    
    version_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.template_id", ondelete="CASCADE"))
    version_number = Column(Integer, nullable=False)
    workflow_data = Column(JSONB, nullable=False)
    change_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    
    # Relationships
    template = relationship("Template", back_populates="versions")
