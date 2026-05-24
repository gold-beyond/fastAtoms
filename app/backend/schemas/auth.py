from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str  # Now a string UUID (platform sub)
    email: str
    name: Optional[str] = None
    role: str = "user"  # user/admin
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlatformTokenExchangeRequest(BaseModel):
    """Request body for exchanging Platform token for app token."""

    platform_token: str


class TokenExchangeResponse(BaseModel):
    """Response body for issued application token."""

    token: str


class SimpleLoginRequest(BaseModel):
    name: str
    password: str


class SimpleLoginResponse(BaseModel):
    token: str
    expires_at: str
    token_type: str
    user: UserResponse


class RegisterRequest(BaseModel):
    name: str
    password: str


class RegisterResponse(BaseModel):
    token: str
    expires_at: str
    token_type: str
    user: UserResponse
