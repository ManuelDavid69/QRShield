import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    created_at: datetime
    has_recovery_code: bool


class UserRegistered(UserOut):
    # Affiché une seule fois : seul son hash est conservé
    recovery_code: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=128)


class PasswordConfirm(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class RecoveryCodeOut(BaseModel):
    recovery_code: str


class PasswordReset(BaseModel):
    email: EmailStr
    recovery_code: str = Field(min_length=1, max_length=40)
    new_password: str = Field(min_length=10, max_length=128)
