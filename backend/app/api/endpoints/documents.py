"""
Document upload and management endpoints.

This module handles file uploads, document retrieval, and deletion
using Supabase Storage and PostgreSQL database.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.database import execute_query, execute_statement
from app.models.document import (
    DocumentDeleteResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentUploadResponse,
    PermissionEnum,
)
from app.services.storage import (
    StorageError,
    delete_file,
    get_signed_url,
    upload_to_supabase,
    validate_file_size,
    validate_file_type,
)

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(..., description="File to upload"),
    thread_id: str = Form(..., description="Thread ID to attach document to"),
    uploader_id: str = Form(..., description="User ID of uploader"),
    permission: str = Form(default="private", description="Access permission level"),
):
    """
    Upload a document to Supabase Storage and save metadata to database.

    Args:
        file: The file to upload
        thread_id: UUID of the thread to attach document to
        uploader_id: UUID of the user uploading the document
        permission: Permission level (private, thread, instructor)

    Returns:
        DocumentUploadResponse with document details

    Raises:
        HTTPException: 400 for invalid file, 413 for file too large, 500 for server errors
    """
    try:
        # Validate thread_id and uploader_id are valid UUIDs
        try:
            thread_uuid = UUID(thread_id)
            uploader_uuid = UUID(uploader_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid thread_id or uploader_id format. Must be valid UUIDs.",
            )

        # Validate permission
        try:
            permission_enum = PermissionEnum(permission)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid permission. Must be one of: {[e.value for e in PermissionEnum]}",
            )

        # Read file content
        try:
            file_content = await file.read()
        except Exception as e:
            logger.error(f"Failed to read uploaded file: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to read uploaded file. The file may be corrupted or the upload was interrupted.",
            )
        file_size = len(file_content)
        file_type = file.content_type or "application/octet-stream"
        file_name = file.filename or "unnamed_file"

        # Validate file size
        if not validate_file_size(file_size):
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE // (1024 * 1024)}MB",
            )

        # Validate file type
        if not validate_file_type(file_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{file_type}' not allowed. Allowed types: {settings.ALLOWED_FILE_TYPES}",
            )

        # Upload to Supabase Storage
        storage_ref, actual_size = await upload_to_supabase(
            file_content=file_content,
            file_name=file_name,
            file_type=file_type,
            uploader_id=str(uploader_uuid),
        )

        # Insert document metadata into database
        current_time = datetime.now(timezone.utc)

        insert_query = """
            INSERT INTO documents (
                thread_id, uploader_id, file_name, file_type,
                file_size, storage_ref, indexed, permission,
                created_at, updated_at, metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, created_at
        """

        result = execute_query(
            insert_query,
            (
                str(thread_uuid),
                str(uploader_uuid),
                file_name,
                file_type,
                file_size,
                storage_ref,
                False,  # indexed = False initially
                permission_enum.value,
                current_time,
                current_time,
                None,  # metadata
            ),
            fetch_one=True,
        )

        if not result:
            # Rollback storage upload if database insert fails
            try:
                await delete_file(storage_ref)
            except StorageError:
                logger.error(f"Failed to rollback storage upload: {storage_ref}")

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save document metadata",
            )

        logger.info(f"Document uploaded successfully: {result['id']}")

        return DocumentUploadResponse(
            id=result["id"],
            file_name=file_name,
            file_type=file_type,
            file_size=file_size,
            storage_ref=storage_ref,
            permission=permission_enum,
            indexed=False,
            created_at=result["created_at"],
            message="File uploaded successfully",
        )

    except HTTPException:
        raise
    except StorageError as e:
        logger.error(f"Storage error during upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error during upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document: {str(e)}",
        )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str):
    """
    Get document metadata and signed URL for download.

    Args:
        document_id: UUID of the document

    Returns:
        DocumentResponse with document details and download URL

    Raises:
        HTTPException: 404 if document not found
    """
    try:
        # Validate document_id
        try:
            doc_uuid = UUID(document_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid document_id format. Must be a valid UUID.",
            )

        # Fetch document from database
        query = """
            SELECT id, thread_id, uploader_id, file_name, file_type,
                   file_size, storage_ref, indexed, permission,
                   created_at, updated_at, metadata
            FROM documents
            WHERE id = %s
        """

        document = execute_query(query, (str(doc_uuid),), fetch_one=True)

        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
            )

        return DocumentResponse(
            id=document["id"],
            thread_id=document["thread_id"],
            uploader_id=document["uploader_id"],
            file_name=document["file_name"],
            file_type=document["file_type"],
            file_size=document["file_size"],
            storage_ref=document["storage_ref"],
            indexed=document["indexed"],
            permission=PermissionEnum(document["permission"]),
            created_at=document["created_at"],
            updated_at=document["updated_at"],
            metadata=document["metadata"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching document: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch document: {str(e)}",
        )


@router.get("/{document_id}/download")
async def get_document_download_url(document_id: str, expires_in: int = 3600):
    """
    Get a signed URL for downloading a document.

    Args:
        document_id: UUID of the document
        expires_in: URL expiration time in seconds (default: 1 hour)

    Returns:
        Object with signed download URL

    Raises:
        HTTPException: 404 if document not found
    """
    try:
        # Validate document_id
        try:
            doc_uuid = UUID(document_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid document_id format. Must be a valid UUID.",
            )

        # Fetch document storage_ref from database
        query = "SELECT storage_ref, file_name FROM documents WHERE id = %s"
        document = execute_query(query, (str(doc_uuid),), fetch_one=True)

        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
            )

        # Validate expires_in
        if expires_in <= 0 or expires_in > 86400:  # Max 24 hours
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="expires_in must be between 1 and 86400 seconds (24 hours)",
            )

        # Generate signed URL
        signed_url = await get_signed_url(
            storage_ref=document["storage_ref"], expires_in=expires_in
        )

        return {
            "document_id": str(doc_uuid),
            "file_name": document["file_name"],
            "download_url": signed_url,
            "expires_in": expires_in,
        }

    except HTTPException:
        raise
    except StorageError as e:
        logger.error(f"Storage error generating download URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating download URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {str(e)}",
        )


@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
async def delete_document(document_id: str):
    """
    Delete a document from storage and database.

    Args:
        document_id: UUID of the document to delete

    Returns:
        DocumentDeleteResponse with deletion confirmation

    Raises:
        HTTPException: 404 if document not found
    """
    try:
        # Validate document_id
        try:
            doc_uuid = UUID(document_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid document_id format. Must be a valid UUID.",
            )

        # Fetch document to get storage_ref
        query = "SELECT storage_ref, file_name FROM documents WHERE id = %s"
        document = execute_query(query, (str(doc_uuid),), fetch_one=True)

        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
            )

        # Delete from Supabase Storage
        try:
            await delete_file(document["storage_ref"])
        except StorageError as e:
            logger.error(f"Failed to delete from storage, aborting DB delete: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete file from storage: {e}",
            )

        # Delete from database
        delete_query = "DELETE FROM documents WHERE id = %s"
        affected_rows = execute_statement(delete_query, (str(doc_uuid),))

        if affected_rows == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete document from database",
            )

        logger.info(f"Document deleted successfully: {doc_uuid}")

        return DocumentDeleteResponse(
            id=doc_uuid,
            file_name=document["file_name"],
            deleted=True,
            message="Document deleted successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}",
        )


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    thread_id: Optional[str] = None,
    uploader_id: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
):
    """
    List documents with optional filtering.

    Args:
        thread_id: Filter by thread ID (optional)
        uploader_id: Filter by uploader ID (optional)
        page: Page number (default: 1)
        per_page: Items per page (default: 20)

    Returns:
        DocumentListResponse with paginated documents
    """
    try:
        # Build query with optional filters
        query = """
            SELECT id, thread_id, uploader_id, file_name, file_type,
                   file_size, storage_ref, indexed, permission,
                   created_at, updated_at, metadata
            FROM documents
            WHERE 1=1
        """
        count_query = "SELECT COUNT(*) as total FROM documents WHERE 1=1"
        params = []

        if thread_id:
            try:
                UUID(thread_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid thread_id format",
                )
            query += " AND thread_id = %s"
            count_query += " AND thread_id = %s"
            params.append(thread_id)

        if uploader_id:
            try:
                UUID(uploader_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid uploader_id format",
                )
            query += " AND uploader_id = %s"
            count_query += " AND uploader_id = %s"
            params.append(uploader_id)

        # Add pagination
        offset = (page - 1) * per_page
        query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"

        # Get total count
        total_result = execute_query(
            count_query, tuple(params) if params else None, fetch_one=True
        )
        total = total_result["total"] if total_result else 0

        # Get documents
        params.extend([per_page, offset])
        documents = execute_query(query, tuple(params))

        # Convert to response models
        document_responses = [
            DocumentResponse(
                id=doc["id"],
                thread_id=doc["thread_id"],
                uploader_id=doc["uploader_id"],
                file_name=doc["file_name"],
                file_type=doc["file_type"],
                file_size=doc["file_size"],
                storage_ref=doc["storage_ref"],
                indexed=doc["indexed"],
                permission=PermissionEnum(doc["permission"]),
                created_at=doc["created_at"],
                updated_at=doc["updated_at"],
                metadata=doc["metadata"],
            )
            for doc in (documents or [])
        ]

        return DocumentListResponse(
            documents=document_responses, total=total, page=page, per_page=per_page
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing documents: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list documents: {str(e)}",
        )


@router.get("/health")
async def documents_health_check():
    """Health check for document service."""
    return {
        "status": "healthy",
        "service": "documents",
        "storage_bucket": settings.SUPABASE_STORAGE_BUCKET,
        "max_file_size_mb": settings.MAX_FILE_SIZE // (1024 * 1024),
        "allowed_file_types": settings.ALLOWED_FILE_TYPES,
    }
