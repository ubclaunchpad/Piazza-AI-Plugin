"""Application package initialization."""

# Import version from config to maintain consistency
from app.core.config import settings

__version__ = settings.VERSION
__title__ = settings.APP_NAME
__description__ = "FastAPI backend for Piazza AI Plugin"
