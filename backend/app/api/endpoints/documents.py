"""
Document upload and management endpoints.

This module handles file uploads, document retrieval, and deletion
using Supabase Storage and PostgreSQL database.

Provides two upload flows:
  1. Presigned URL flow (recommended):
       POST /request-upload  -> returns signed URL
       Client PUTs file directly to Supabase Storage
       POST /confirm-upload  -> creates DB record
  2. Legacy proxy flow (deprecated):
       POST /upload  -> backend proxies file to Supabase
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.dependencies.auth import get_current_user
from app.core.config import settings
from app.core.database import execute_query, execute_statement
from app.models.document import (
    ConfirmUploadRequest,
    DocumentDeleteResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentUploadResponse,
    PermissionEnum,
    SignedUploadRequest,
    SignedUploadResponse,
)
from app.services.storage import (
    StorageError,
    create_signed_upload_url,
    delete_file,
    get_signed_url,
    upload_to_supabase,
    validate_file_size,
    validate_file_type,
    verify_file_exists,
)

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: resolve piazza_course_id -> thread UUID (upsert if needed)
# ---------------------------------------------------------------------------

def _resolve_thread_id(piazza_course_id: str) -> UUID:
    """
    Look up the thread UUID for a piazza_course_id, creating the thread
    record if it does not yet exist.

    Raises:
        HTTPException 500 if the upsert fails.
    """
    thread_result = execute_query(
        "SELECT id FROM threads WHERE piazza_course_id = %s",
        (piazza_course_id,),
        fetch_one=True,
    )

    if thread_result:
        return UUID(str(thread_result["id"]))

    upsert_query = """
        INSERT INTO threads (piazza_course_id, thread_title, is_indexable, updated_at)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (piazza_course_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
    """
    new_thread = execute_query(
        upsert_query,
        (piazza_course_id, f"Course {piazza_course_id}", True),
        fetch_one=True,
    )
    if not new_thread:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create or find thread for this course.",
        )
    return UUID(str(new_thread["id"]))


# ---------------------------------------------------------------------------
# Presigned URL flow
# ---------------------------------------------------------------------------

@router.post("/request-upload", response_model=SignedUploadResponse)
async def request_upload(
    body: SignedUploadRequest,
    user=Depends(get_current_user),
):
    """
    Request a presigned upload URL for direct browser-to-Supabase upload.

    The client should:
      1. Call this endpoint with file metadata.
      2. PUT the file bytes directly to the returned ``signed_url``.
      3. Call ``POST /confirm-upload`` to finalise the metadata record.

    Authentication required -- the uploader identity is derived from the
    Bearer token, not from the request body.
    """
    try:
        # Validate piazza_course_id
        if not body.piazza_course_id or not body.piazza_course_id.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="piazza_course_id is required and cannot be empty.",
            )

        # Validate file size
        if not validate_file_size(body.file_size):
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE // (1024 * 1024)}MB",
            )

        # Validate file type
        if not validate_file_type(body.file_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{body.file_type}' not allowed. Allowed types: {settings.ALLOWED_FILE_TYPES}",
            )

        # Resolve course -> thread
        thread_uuid = _resolve_thread_id(body.piazza_course_id)

        # Generate the signed upload URL
        upload_data = await create_signed_upload_url(
            file_name=body.file_name,
            file_type=body.file_type,
            thread_id=str(thread_uuid),
            uploader_id=str(user.id),
        )

        return SignedUploadResponse(
            signed_url=upload_data["signed_url"],
            token=upload_data["token"],
            storage_path=upload_data["storage_path"],
            thread_id=thread_uuid,
            file_name=body.file_name,
            file_type=body.file_type,
            file_size=body.file_size,
        )

    except HTTPException:
        raise
    except StorageError as e:
        logger.error(f"Storage error generating signed upload URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error generating signed upload URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}",
        )


@router.post("/confirm-upload", response_model=DocumentUploadResponse)
async def confirm_upload(
    body: ConfirmUploadRequest,
    user=Depends(get_current_user),
):
    """
    Confirm that a direct upload has completed and create the document
    metadata record in the database.

    Should be called *after* the client has successfully PUT the file
    to the signed URL returned by ``POST /request-upload``.
    """
    try:
        # Verify the file actually exists in storage
        try:
            exists = await verify_file_exists(body.storage_path)
            if not exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File not found at the specified storage path. "
                           "Ensure the file was uploaded before confirming.",
                )
        except StorageError as e:
            logger.warning(
                f"Could not verify file existence (proceeding anyway): {e}"
            )
            # Non-fatal -- we still create the record. The file may simply
            # not be listable yet due to eventual consistency.

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
                str(body.thread_id),
                str(user.id),
                body.file_name,
                body.file_type,
                body.file_size,
                body.storage_path,
                False,  # indexed = False initially
                body.permission.value,
                current_time,
                current_time,
                None,  # metadata
            ),
            fetch_one=True,
        )

        if not result:
            # Rollback: delete the orphaned file from storage
            try:
                await delete_file(body.storage_path)
            except StorageError:
                logger.error(
                    f"Failed to rollback storage upload: {body.storage_path}"
                )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save document metadata",
            )

        logger.info(f"Document confirmed successfully: {result['id']}")

        return DocumentUploadResponse(
            id=result["id"],
            file_name=body.file_name,
            file_type=body.file_type,
            file_size=body.file_size,
            storage_ref=body.storage_path,
            permission=body.permission,
            indexed=False,
            created_at=result["created_at"],
            message="File uploaded and confirmed successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error confirming upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to confirm upload: {str(e)}",
        )


# ---------------------------------------------------------------------------
# Legacy proxy upload (deprecated -- kept for backwards compatibility)
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=DocumentUploadResponse, deprecated=True)
async def upload_document(
    file: UploadFile = File(..., description="File to upload"),
    piazza_course_id: str = Form(..., description="Piazza course ID from URL path"),
    permission: str = Form(default="private", description="Access permission level"),
    user=Depends(get_current_user),
):
    """
    **Deprecated** -- use ``POST /request-upload`` + ``POST /confirm-upload`` instead.

    Upload a document via the backend proxy. The file bytes are buffered in
    server memory and then forwarded to Supabase Storage.
    """
    try:
        # Validate piazza_course_id
        if not piazza_course_id or not piazza_course_id.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="piazza_course_id is required and cannot be empty.",
            )

        # Resolve course -> thread
        thread_uuid = _resolve_thread_id(piazza_course_id)

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

        # Upload to Supabase Storage (uploader_id from auth token)
        storage_ref, actual_size = await upload_to_supabase(
            file_content=file_content,
            file_name=file_name,
            file_type=file_type,
            thread_id=str(thread_uuid),
            uploader_id=str(user.id),
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
                str(user.id),
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


# ---------------------------------------------------------------------------
# Read / download / delete / list
# ---------------------------------------------------------------------------

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, user=Depends(get_current_user)):
    """
    Get document metadata by ID.

    Only the uploader or users in the same thread (depending on
    permission level) should be able to access the document.
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

        # Access check: private docs are only visible to the uploader
        if (
            document["permission"] == PermissionEnum.PRIVATE.value
            and str(document["uploader_id"]) != str(user.id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this document.",
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
async def get_document_download_url(
    document_id: str,
    expires_in: int = 3600,
    user=Depends(get_current_user),
):
    """
    Get a signed URL for downloading a document.
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
        query = "SELECT storage_ref, file_name, uploader_id, permission FROM documents WHERE id = %s"
        document = execute_query(query, (str(doc_uuid),), fetch_one=True)

        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
            )

        # Access check
        if (
            document["permission"] == PermissionEnum.PRIVATE.value
            and str(document["uploader_id"]) != str(user.id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to download this document.",
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
async def delete_document(document_id: str, user=Depends(get_current_user)):
    """
    Delete a document from storage and database.

    Only the uploader can delete their own documents.
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

        # Fetch document to get storage_ref and verify ownership
        query = "SELECT storage_ref, file_name, uploader_id FROM documents WHERE id = %s"
        document = execute_query(query, (str(doc_uuid),), fetch_one=True)

        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
            )

        # Ownership check
        if str(document["uploader_id"]) != str(user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own documents.",
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
    piazza_course_id: Optional[str] = None,
    uploader_id: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    user=Depends(get_current_user),
):
    """
    List documents with optional filtering.

    Results are scoped: private documents are only visible to their uploader.
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

        if piazza_course_id:
            # Resolve piazza_course_id to thread UUID
            thread_query = "SELECT id FROM threads WHERE piazza_course_id = %s"
            thread_result = execute_query(
                thread_query, (piazza_course_id,), fetch_one=True
            )
            if thread_result:
                query += " AND thread_id = %s"
                count_query += " AND thread_id = %s"
                params.append(str(thread_result["id"]))
            else:
                # No thread found for this course - return empty result
                return DocumentListResponse(
                    documents=[], total=0, page=page, per_page=per_page
                )

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

        # Scope private documents to the authenticated user
        query += (
            " AND (permission != 'private' OR uploader_id = %s)"
        )
        count_query += (
            " AND (permission != 'private' OR uploader_id = %s)"
        )
        params.append(str(user.id))

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
    """Health check for document service (no auth required)."""
    return {
        "status": "healthy",
        "service": "documents",
        "storage_bucket": settings.SUPABASE_STORAGE_BUCKET,
        "max_file_size_mb": settings.MAX_FILE_SIZE // (1024 * 1024),
        "allowed_file_types": settings.ALLOWED_FILE_TYPES,
    }
