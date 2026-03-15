"""Learning preference model"""
from sqlalchemy import Column, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from ..database import Base


class LearnedPreference(Base):
    """Learned preference model"""
    __tablename__ = "learned_preferences"
    
    preference_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    original_prompt = Column(Text)
    agent_type_changes = Column(JSONB)
    timing_preferences = Column(JSONB)
    input_type_preferences = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="preferences")
