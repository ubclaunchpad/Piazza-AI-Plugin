# Piazza AI Backend - Setup & Modification Guide

Minimal FastAPI backend for the Piazza AI browser extension. This is a starter template that can be extended with additional features as needed.

## 🎯 Current Setup

This backend currently provides:

- **Basic FastAPI application** with CORS support for browser extensions
- **One example endpoint** (`/api/v1/health`) to demonstrate the structure
- **Minimal dependencies** - only FastAPI, Uvicorn, and Pydantic
- **Placeholder files** for future database, authentication, and business logic

## � Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run the Server

```bash
python main.py
```

The server will start at `http://localhost:8000`

### 3. Test the API

- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/api/v1/health
- **Root**: http://localhost:8000/

## 📁 Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── routes.py          # Main API router with example endpoint
│   │   └── endpoints/         # Individual endpoint modules (empty for now)
│   ├── core/
│   │   ├── database.py        # Database setup (placeholder)
│   └── models/                # Database models (placeholder)
├── tests/                     # Test files (minimal setup)
├── main.py                   # FastAPI application entry point
├── requirements.txt          # Minimal dependencies
└── .env.example             # Environment variables template
```

## 🧪 Development Workflow

### Adding Dependencies

```bash
# Add new dependencies to requirements.txt
echo "new-package==1.0.0" >> requirements.txt
pip install -r requirements.txt
```

### Code Quality

```bash
# Install dev dependencies
pip install -r requirements-dev.txt

# Format code
black .

# Lint code
ruff check .

# Type checking
mypy .
```

### Testing

```bash
# Run tests
pytest

# Add new tests in tests/ directory
# Example: tests/test_api.py
```

## 🌐 Extension Integration

The backend is configured to accept requests from browser extensions:

```python
# CORS is already configured in main.py for:
allow_origins=[
    "http://localhost:3000",  # Local development
    "chrome-extension://*",   # Chrome extensions
]
```

## 📝 Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
# Basic settings
ENVIRONMENT=development
DEBUG=true
HOST=0.0.0.0
PORT=8000

# Add database URL when needed
# DATABASE_URL=postgresql://user:password@localhost:5432/database
```

## 🚀 Deployment

### Local Development

```bash
python main.py
```

### Production

```bash
# Set production environment
export ENVIRONMENT=production

# Run with multiple workers
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```
