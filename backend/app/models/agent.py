"""Agent model"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, ARRAY
from datetime import datetime
from ..database import Base


class Agent(Base):
    """Agent model"""
    __tablename__ = "agents"
    
    agent_id = Column(String(100), primary_key=True)
    name = Column(String(255), nullable=False)
    type = Column(String(100), nullable=False)
    description = Column(Text)
    capabilities = Column(ARRAY(String))
    icon = Column(String(10))
    category = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
