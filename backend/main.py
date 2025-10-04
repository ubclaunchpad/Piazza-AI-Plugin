"""
Piazza AI Plugin Backend

Minimal FastAPI backend for the Piazza AI browser extension.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.core.config import settings

# Create FastAPI application
app = FastAPI(
    title="Piazza AI Plugin Backend",
    description="Backend API for the Piazza AI browser extension",
    version="0.1.0",
)

# Add CORS middleware for extension support
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,  # ✅ Use config!
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix=settings.API_PREFIX)  # ✅ Use config!


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": settings.APP_NAME,  # ✅ Use config!
        "version": settings.VERSION,  # ✅ Use config!
        "status": "running",
        "environment": settings.ENVIRONMENT,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,  # ✅ Use config!
        port=settings.PORT,  # ✅ Use config!
        reload=settings.DEBUG,  # ✅ Use config!
    )
