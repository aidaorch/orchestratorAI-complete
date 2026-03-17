"""Learning preference schemas"""
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime
from uuid import UUID


class LearnedPreferenceCreate(BaseModel):
    original_prompt: str
    agent_type_changes: Dict[str, Any] = {}
    timing_preferences: Dict[str, Any] = {}
    input_type_preferences: Dict[str, Any] = {}


class LearnedPreferenceResponse(BaseModel):
    preference_id: str
    original_prompt: Optional[str]
    agent_type_changes: Optional[Dict[str, Any]]
    timing_preferences: Optional[Dict[str, Any]]
    input_type_preferences: Optional[Dict[str, Any]]
    created_at: datetime

    @classmethod
    def from_orm_obj(cls, obj):
        return cls(
            preference_id=str(obj.preference_id),
            original_prompt=obj.original_prompt,
            agent_type_changes=obj.agent_type_changes or {},
            timing_preferences=obj.timing_preferences or {},
            input_type_preferences=obj.input_type_preferences or {},
            created_at=obj.created_at,
        )

    class Config:
        from_attributes = True
