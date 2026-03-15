"""Workflow models"""
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from ..database import Base


class Workflow(Base):
    """Workflow model"""
    __tablename__ = "workflows"
    
    workflow_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    workflow_name = Column(String(255), nullable=False)
    workflow_data = Column(JSONB, nullable=False)
    original_prompt = Column(Text)
    is_template = Column(Boolean, default=False)
    step_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="workflows")
    steps = relationship("WorkflowStep", back_populates="workflow", cascade="all, delete-orphan")
    executions = relationship("WorkflowExecution", back_populates="workflow")


class WorkflowStep(Base):
    """Workflow step model (normalized for querying)"""
    __tablename__ = "workflow_steps"
    
    step_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.workflow_id", ondelete="CASCADE"))
    step_number = Column(Integer, nullable=False)
    agent_type = Column(String(100), nullable=False)
    action_description = Column(Text)
    timing_logic = Column(String(50))
    input_config = Column(JSONB)
    output_storage = Column(Text)
    depends_on = Column(ARRAY(Integer))
    parallel_group = Column(String(100))
    execution_status = Column(String(20), default='pending')
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    workflow = relationship("Workflow", back_populates="steps")
