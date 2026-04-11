# Piazza AI Backend - Setup & Modification Guide

Minimal FastAPI backend for the Piazza AI browser extension. This is a starter template that can be extended with additional features as needed.

## 🎯 Current Setup

This backend currently provides:

- **Basic FastAPI application** with CORS support for browser extensions
- **One example endpoint** (`/api/v1/health`) to demonstrate the structure
- **Environment-based configuration** using Pydantic Settings
- **Supabase integration ready** with database configuration
- **Minimal dependencies** - FastAPI, Uvicorn, Pydantic, and psycopg2

## ⚙️ Environment Configuration

### 1. Create env File

```bash
cd backend
touch .env
```

### 2. Configure Your Environment Variables

Edit the `.env` file with your specific values:

```bash
APP_NAME="Piazza AI Plugin"
ENVIRONMENT=development
DEBUG=true
VERSION=1.0.0


HOST=0.0.0.0
PORT=8000
API_PREFIX=/api/v1

ALLOWED_ORIGINS=["http://localhost:3000", "chrome-extension://*", "https://piazza.com"]
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres


```

### 3. Get Supabase Values

To get your actual Supabase keys, run:

```bash
cd ../supabase
supabase status
```

Copy the values from the output:

- **Database URL** → `DATABASE_URL`

### 4. Google Calendar API and OAuth credentials

Calendar features use **OAuth 2.0** (a **Client ID** and **Client secret** for a **Web application** client). You need to set up Google Cloud Console for the calendar features to work.

1. In [Google Cloud Console](https://console.cloud.google.com/), select or create a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → configure the app type, scopes, and test users if the app is in testing.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Web application**.
5. Under **Authorized redirect URIs**, add the callback URL your backend uses. With the default local setup (`API_PREFIX=/api/v1` in `main.py` and the calendar router mounted at `/calendar`), the redirect URI is:

   `http://localhost:8000/api/v1/calendar/callback`

   This must match **exactly** what is in your `.env` and in the OAuth client. Mismatches produce `redirect_uri_mismatch` from Google.

6. Copy the **Client ID** and **Client secret** from the new client (or from the downloaded JSON).

Add the following variables to `backend/.env` (names must match `app/api/endpoints/calendar.py`):

```bash
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_PROJECT_ID="your-gcp-project-id"
GOOGLE_CLIENT_CLIENT_SECRET="your-client-secret"
GOOGLE_CLIENT_AUTH_URI="https://accounts.google.com/o/oauth2/auth"
GOOGLE_CLIENT_TOKEN_URI="https://oauth2.googleapis.com/token"
GOOGLE_CLIENT_AUTH_PROVIDER_X509_CERT_URL="https://www.googleapis.com/oauth2/v1/certs"
GOOGLE_CLIENT_REDIRECT_URIS=["http://localhost:8000/api/v1/calendar/callback"]
```

Notes:

- `GOOGLE_CLIENT_REDIRECT_URIS` is parsed as JSON; keep it valid JSON on one line.
- For production, add your deployed callback URL to both Google Cloud **Authorized redirect URIs** and this JSON array, and keep the same URI in your deployed backend configuration.
- Restart the backend after changing OAuth-related environment variables.

## 🌐 Resource Aggregator Configuration (when enabled)

When using the Smart Resource Aggregator feature, configure the following environment variables (see `app/core/config.py` for details):

- `YOUTUBE_API_KEY` – API key for YouTube Data API v3.
- `STACKEXCHANGE_API_KEY` – API key for Stack Exchange (optional depending on usage).
- `STACKEXCHANGE_SITE` – Stack Exchange site to query (default: `stackoverflow`).

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your values (see Environment Configuration above)
```

### 3. Run the Server

```bash
python main.py
```

The server will start at `http://localhost:8000`

### 4. Test the API

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

For **Google Calendar OAuth**, set the `GOOGLE_CLIENT_*` variables documented in [Google Calendar API and OAuth credentials](#4-google-calendar-api-and-oauth-credentials) (step 4 under Environment Configuration).

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
