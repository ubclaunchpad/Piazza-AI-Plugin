from pydantic import BaseModel, EmailStr, Field

class SignUpRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

class SignUpResponse(BaseModel):
    user: dict[str, str]