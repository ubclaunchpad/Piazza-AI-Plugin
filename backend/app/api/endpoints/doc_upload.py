"""
Upload endpoint for generating pre-signed upload URLs for Supabase documents storage.
"""
from dotenv import load_dotenv
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client

load_dotenv()

router = APIRouter()

def get_supabase_client() -> Client:
    return create_client(
        os.getenv("SUPABASE_URL"), 
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

class DocumentUploadRequest(BaseModel):
    thread_id: str
    filename: str

class DocumentUploadResponse(BaseModel):
    signed_url: str
    key: str

@router.post("/upload-url", response_model=DocumentUploadResponse)
def generate_upload_url(request: DocumentUploadRequest):
    """
    Generate a pre-signed upload URL for a document.

    Args:
        request: DocumentUploadRequest containing thread_id and filename

    Returns:
        DocumentUploadResponse with the signed URL and path key

    Raises:
        HTTPException: 500 if URL generation fails
    """
    
    supabase = get_supabase_client()
    bucket = "course_docs"
    key = f"{request.thread_id}/documents/{request.filename}"
    
    result = supabase.storage.from_(bucket).create_signed_upload_url(key)
    signed_url = result.get("signed_url")

    if not signed_url:
        raise HTTPException(status_code=500, detail="Failed to obtain signed URL")
    
    return DocumentUploadResponse(signed_url=signed_url, key=key)