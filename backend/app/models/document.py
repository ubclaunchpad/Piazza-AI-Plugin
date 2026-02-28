"""
Document models for file upload and storage.

These models match the documents table schema in Supabase/PostgreSQL.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PermissionEnum(str, Enum):
    """Permission levels for document access."""

    PRIVATE = "private"
    THREAD = "thread"
    INSTRUCTOR = "instructor"


class DocumentBase(BaseModel):
    """Base document model with common fields."""

    thread_id: UUID = Field(
        ..., description="ID of the thread this document belongs to"
    )
    file_name: str = Field(..., max_length=255, description="Original filename")
    file_type: str = Field(..., max_length=255, description="MIME type of the file")
    permission: PermissionEnum = Field(
        default=PermissionEnum.PRIVATE, description="Access permission level"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional metadata (version, tags, etc.)"
    )


class DocumentCreate(DocumentBase):
    """Model for creating a new document record."""

    uploader_id: UUID = Field(..., description="ID of the user uploading the document")
    file_size: int = Field(..., ge=0, description="File size in bytes")
    storage_ref: str = Field(..., max_length=255, description="Storage reference path")


class DocumentUpdate(BaseModel):
    """Model for updating document fields."""

    file_name: Optional[str] = Field(None, max_length=255)
    permission: Optional[PermissionEnum] = None
    indexed: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None


class DocumentResponse(BaseModel):
    """Response model for document data."""

    id: UUID
    thread_id: UUID
    uploader_id: UUID
    file_name: str
    file_type: str
    file_size: int
    storage_ref: str
    indexed: bool
    permission: PermissionEnum
    created_at: datetime
    updated_at: datetime
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class DocumentUploadRequest(BaseModel):
    """Request model for file upload endpoint."""

    thread_id: UUID = Field(..., description="Thread to attach document to")
    permission: PermissionEnum = Field(
        default=PermissionEnum.PRIVATE, description="Access permission level"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional metadata"
    )


class DocumentUploadResponse(BaseModel):
    """Response model for successful file upload."""

    id: UUID
    file_name: str
    file_type: str
    file_size: int
    storage_ref: str
    permission: PermissionEnum
    indexed: bool
    created_at: datetime
    message: str = "File uploaded successfully"

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """Response model for listing documents."""

    documents: list[DocumentResponse]
    total: int
    page: int = 1
    per_page: int = 20


class DocumentDeleteResponse(BaseModel):
    """Response model for document deletion."""

    id: UUID
    file_name: str
    deleted: bool = True
    message: str = "Document deleted successfully"


class SignedUploadRequest(BaseModel):
    """Request model for obtaining a presigned upload URL.

    The client sends file metadata; the server validates and returns
    a signed URL for direct browser-to-Supabase upload.
    """

    piazza_course_id: str = Field(
        ..., description="Piazza course ID from URL path"
    )
    file_name: str = Field(..., max_length=255, description="Original filename")
    file_type: str = Field(..., max_length=255, description="MIME type of the file")
    file_size: int = Field(..., ge=0, description="File size in bytes")
    permission: PermissionEnum = Field(
        default=PermissionEnum.PRIVATE, description="Access permission level"
    )


class SignedUploadResponse(BaseModel):
    """Response model containing the signed upload URL and upload metadata."""

    signed_url: str = Field(..., description="Presigned URL for direct upload to Supabase Storage")
    token: str = Field(..., description="Upload token for the signed URL")
    storage_path: str = Field(..., description="Storage path where the file will be stored")
    thread_id: UUID = Field(..., description="Resolved thread UUID")
    file_name: str
    file_type: str
    file_size: int


class ConfirmUploadRequest(BaseModel):
    """Request model to confirm a completed direct upload and create the DB record."""

    storage_path: str = Field(..., max_length=512, description="Storage path returned by request-upload")
    file_name: str = Field(..., max_length=255, description="Original filename")
    file_type: str = Field(..., max_length=255, description="MIME type of the file")
    file_size: int = Field(..., ge=0, description="File size in bytes")
    thread_id: UUID = Field(..., description="Thread UUID returned by request-upload")
    permission: PermissionEnum = Field(
        default=PermissionEnum.PRIVATE, description="Access permission level"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional metadata"
    )


__all__ = [
    "PermissionEnum",
    "DocumentBase",
    "DocumentCreate",
    "DocumentUpdate",
    "DocumentResponse",
    "DocumentUploadRequest",
    "DocumentUploadResponse",
    "DocumentListResponse",
    "DocumentDeleteResponse",
    "SignedUploadRequest",
    "SignedUploadResponse",
    "ConfirmUploadRequest",
]
