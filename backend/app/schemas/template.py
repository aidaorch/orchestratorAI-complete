"""Template schemas"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class TemplateSaveRequest(BaseModel):
    """Schema for template save request"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    workflow_data: Dict[str, Any]
    tags: Optional[List[str]] = []
    change_note: Optional[str] = "Initial save"


class TemplateResponse(BaseModel):
    """Schema for template response"""
    template_id: str
    name: str
    description: Optional[str]
    workflow_data: Dict[str, Any]
    tags: List[str]
    version_number: int
    created_at: datetime
    updated_at: datetime
    
    @field_validator('template_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        """Convert UUID to string"""
        if isinstance(v, UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


class TemplateListItem(BaseModel):
    """Schema for template list item"""
    template_id: str
    name: str
    description: Optional[str]
    tags: List[str]
    version_number: int
    step_count: int
    created_at: datetime
    
    @field_validator('template_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        """Convert UUID to string"""
        if isinstance(v, UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    """Schema for template list response"""
    templates: List[TemplateListItem]
