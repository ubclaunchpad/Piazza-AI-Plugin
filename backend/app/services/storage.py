"""
Supabase Storage service for file uploads.

This module provides functions for uploading, retrieving, and deleting files
from Supabase Storage.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

from supabase import Client, create_client

from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Global Supabase client
_supabase_client: Optional[Client] = None


class StorageError(Exception):
    """Custom exception for storage-related errors."""

    pass


def get_supabase_client() -> Client:
    """
    Get or create a Supabase client instance.

    Returns:
        Client: Supabase client instance

    Raises:
        StorageError: If Supabase credentials are not configured
    """
    global _supabase_client

    if _supabase_client is None:
        if (
            not settings.SUPABASE_URL
            or not settings.SUPABASE_SERVICE_ROLE_KEY
            or not settings.SUPABASE_ANON_KEY
        ):
            raise StorageError(
                "Supabase credentials not configured. "
                "Please set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY environment variables."
            )

        try:
            _supabase_client = create_client(
                settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
            )
            # create bucket if it doesn't exist
            create_bucket(settings.SUPABASE_STORAGE_BUCKET)

            logger.info("Supabase client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            raise StorageError(f"Failed to initialize Supabase client: {e}")

    return _supabase_client

def create_bucket(bucket_name: str) -> bool:
    """
    Create a new storage bucket in Supabase.

    Args:
        bucket_name: Name of the bucket to create
    Returns:
        bool: True if bucket was created successfully
    """
    try:
        client = get_supabase_client()
        client.storage.create_bucket(bucket_name)
        logger.info(f"Bucket '{bucket_name}' created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create bucket '{bucket_name}': {e}")
        raise StorageError(f"Failed to create bucket '{bucket_name}': {e}")

def generate_storage_path(uploader_id: str, file_name: str) -> str:
    """
    Generate a unique storage path for a file.

    Args:
        uploader_id: UUID of the user uploading the file
        file_name: Original filename

    Returns:
        str: Unique storage path in format: uploader_id/timestamp_uuid_filename
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    # Sanitize filename - remove special characters
    safe_filename = "".join(c for c in file_name if c.isalnum() or c in ".-_")

    return f"{uploader_id}/{timestamp}_{unique_id}_{safe_filename}"


async def upload_to_supabase(
    file_content: bytes,
    file_name: str,
    file_type: str,
    uploader_id: str,
    bucket: Optional[str] = None,
) -> Tuple[str, int]:
    """
    Upload a file to Supabase Storage.

    Args:
        file_content: File content as bytes
        file_name: Original filename
        file_type: MIME type of the file
        uploader_id: UUID of the user uploading the file
        bucket: Storage bucket name (defaults to config value)

    Returns:
        Tuple[str, int]: (storage_ref path, file_size in bytes)

    Raises:
        StorageError: If upload fails
    """
    bucket = bucket or settings.SUPABASE_STORAGE_BUCKET
    storage_path = generate_storage_path(uploader_id, file_name)
    file_size = len(file_content)

    try:
        client = get_supabase_client()

        # Upload file to Supabase Storage
        client.storage.from_(bucket).upload(
            path=storage_path,
            file=file_content,
            file_options={
                "content-type": file_type,
                "upsert": "false",  # Don't overwrite existing files
            },
        )

        logger.info(f"File uploaded successfully: {storage_path}")
        return storage_path, file_size

    except Exception as e:
        logger.error(f"Failed to upload file to Supabase: {e}")
        raise StorageError(f"Failed to upload file: {e}")


async def get_signed_url(
    storage_ref: str, expires_in: int = 3600, bucket: Optional[str] = None
) -> str:
    """
    Generate a signed URL for accessing a file.

    Args:
        storage_ref: Storage reference path from the documents table
        expires_in: URL expiration time in seconds (default: 1 hour)
        bucket: Storage bucket name (defaults to config value)

    Returns:
        str: Signed URL for file access

    Raises:
        StorageError: If URL generation fails
    """
    bucket = bucket or settings.SUPABASE_STORAGE_BUCKET

    try:
        client = get_supabase_client()

        # Generate signed URL
        response = client.storage.from_(bucket).create_signed_url(
            path=storage_ref, expires_in=expires_in
        )

        if response and "signedURL" in response:
            logger.debug(f"Signed URL generated for: {storage_ref}")
            return response["signedURL"]
        else:
            raise StorageError("Failed to generate signed URL: Invalid response")

    except StorageError:
        raise
    except Exception as e:
        logger.error(f"Failed to generate signed URL: {e}")
        raise StorageError(f"Failed to generate signed URL: {e}")


async def delete_file(storage_ref: str, bucket: Optional[str] = None) -> bool:
    """
    Delete a file from Supabase Storage.

    Args:
        storage_ref: Storage reference path from the documents table
        bucket: Storage bucket name (defaults to config value)

    Returns:
        bool: True if deletion was successful

    Raises:
        StorageError: If deletion fails
    """
    bucket = bucket or settings.SUPABASE_STORAGE_BUCKET

    try:
        client = get_supabase_client()

        # Delete file from Supabase Storage
        client.storage.from_(bucket).remove([storage_ref])

        logger.info(f"File deleted successfully: {storage_ref}")
        return True

    except Exception as e:
        logger.error(f"Failed to delete file from Supabase: {e}")
        raise StorageError(f"Failed to delete file: {e}")


async def get_public_url(storage_ref: str, bucket: Optional[str] = None) -> str:
    """
    Get public URL for a file (if bucket is public).

    Args:
        storage_ref: Storage reference path from the documents table
        bucket: Storage bucket name (defaults to config value)

    Returns:
        str: Public URL for file access
    """
    bucket = bucket or settings.SUPABASE_STORAGE_BUCKET

    try:
        client = get_supabase_client()

        response = client.storage.from_(bucket).get_public_url(storage_ref)
        return response

    except Exception as e:
        logger.error(f"Failed to get public URL: {e}")
        raise StorageError(f"Failed to get public URL: {e}")


def validate_file_type(file_type: str) -> bool:
    """
    Validate if the file type is allowed.

    Args:
        file_type: MIME type of the file

    Returns:
        bool: True if file type is allowed
    """
    return file_type in settings.ALLOWED_FILE_TYPES


def validate_file_size(file_size: int) -> bool:
    """
    Validate if the file size is within limits.

    Args:
        file_size: Size of the file in bytes

    Returns:
        bool: True if file size is within limits
    """
    return file_size <= settings.MAX_FILE_SIZE
