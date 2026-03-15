"""User schemas"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = Field(None, max_length=100)


class UserLogin(BaseModel):
    username: str  # accepts username or email
    password: str


class UserResponse(BaseModel):
    user_id: str
    username: str
    email: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    @field_validator('user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    """Update display name only"""
    full_name: str = Field(..., min_length=1, max_length=100)


class UserPasswordChange(BaseModel):
    """Change password — requires current password for verification"""
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, info):
        if info.data.get('new_password') and v != info.data['new_password']:
            raise ValueError('Passwords do not match')
        return v


class UserStatsResponse(BaseModel):
    """Aggregated stats for the profile page"""
    workflow_count: int
    template_count: int
    member_since: datetime
    last_login: Optional[datetime]


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserResponse


class TokenRefresh(BaseModel):
    refresh_token: str
