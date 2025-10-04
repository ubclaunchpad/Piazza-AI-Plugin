"""
Application configuration management.

This module handles all application settings with environment variable support,
type validation, and centralized configuration management.
"""

from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Application
    APP_NAME: str = "Piazza AI Plugin"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    VERSION: str = "1.0.0"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS - Chrome Extension Support
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "chrome-extension://*",
        "https://piazza.com",
    ]

    # API Configuration
    API_V1_PREFIX: str = "/api/v1"

    # Database (placeholder for Supabase)
    DATABASE_URL: str = ""

    # Future: Add these when implementing features
    # SUPABASE_URL: str = ""
    # SUPABASE_ANON_KEY: str = ""
    # OPENAI_API_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.ENVIRONMENT.lower() == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
