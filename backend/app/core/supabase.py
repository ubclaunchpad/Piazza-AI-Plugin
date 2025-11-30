"""
Supabase client initialization.

This module defines a singleton Supabase client configured from environment
variables provided through Pydantic settings. Import `supabase` from this module
whenever you need to interact with Supabase (authentication, storage, or
database).

The client uses the service role key, which bypasses Row Level Security (RLS).
Use with caution in user-facing operations.
"""

from __future__ import annotations

import logging

from supabase import Client, create_client

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    """Safely create and return a Supabase client."""
    try:
        client = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
        )
        logger.info("Supabase client initialized successfully.")
        return client
    except Exception as exc:
        logger.error(f"Failed to initialize Supabase client: {exc}")
        raise


# Singleton client instance
supabase: Client = get_supabase_client()
