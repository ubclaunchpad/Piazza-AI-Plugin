from pydantic import BaseModel, EmailStr, Field


class SignUpRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class SignUpResponse(BaseModel):
    user: dict[str, str]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class LoginResponse(BaseModel):
    user: dict[str, str]
    access_token: str
    refresh_token: str
    expires_in: int
