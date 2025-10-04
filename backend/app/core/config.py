"""
Application configuration management.

This module handles all application settings with environment variable support,
type validation, and centralized configuration management.
"""

from typing import List

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load environment variables from .env file
load_dotenv()


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Application
    APP_NAME: str
    ENVIRONMENT: str
    DEBUG: bool
    VERSION: str

    # Server
    HOST: str
    PORT: int

    # CORS - Chrome Extension Support
    ALLOWED_ORIGINS: List[str]

    # API Configuration
    API_PREFIX: str

    # Database Configuration
    DATABASE_URL: str

    class Config:
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
