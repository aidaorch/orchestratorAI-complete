"""Workflow schemas"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class WorkflowGenerateRequest(BaseModel):
    """Schema for workflow generation request"""
    business_requirement: str = Field(..., min_length=20, max_length=2000)
    user_preferences: Optional[Dict[str, Any]] = {}


class WorkflowResponse(BaseModel):
    """Schema for workflow response"""
    workflow_id: str
    workflow_name: str
    workflow_data: Dict[str, Any]
    original_prompt: Optional[str]
    step_count: int
    created_at: datetime
    updated_at: datetime
    
    @field_validator('workflow_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        """Convert UUID to string"""
        if isinstance(v, UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


class WorkflowListItem(BaseModel):
    """Schema for workflow list item"""
    workflow_id: str
    workflow_name: str
    step_count: int
    created_at: datetime
    updated_at: datetime
    
    @field_validator('workflow_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        """Convert UUID to string"""
        if isinstance(v, UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


class WorkflowListResponse(BaseModel):
    """Schema for workflow list response"""
    workflows: List[WorkflowListItem]
    total: int
    page: int
    pages: int


class WorkflowUpdateRequest(BaseModel):
    """Schema for workflow update"""
    workflow_data: Dict[str, Any]
    change_note: Optional[str] = None
