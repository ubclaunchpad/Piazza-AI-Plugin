# Virtual Environment Setup Guide

This guide helps you and your team set up the Python virtual environment for the Piazza AI Plugin project.

## 📁 Project Structure
```
ThreadSense/
├── .venv/                    # Virtual environment (created here)
└── Piazza-AI-Plugin/         # Project repository
    └── backend/              # FastAPI backend
        ├── main.py
        ├── requirements.txt
        └── requirements-dev.txt
```

## 🚀 Initial Setup (One-time)

### 1. Create Virtual Environment
```bash
cd /Users/username/Desktop/ThreadSense
python3 -m venv .venv
```

### 2. Activate Virtual Environment
```bash
# On macOS/Linux
source .venv/bin/activate

# On Windows
.venv\Scripts\activate
```

### 3. Install Dependencies
```bash
# Navigate to backend directory
cd Piazza-AI-Plugin/backend

# Install production dependencies
pip install -r requirements.txt

# Install development dependencies (optional)
pip install -r requirements-dev.txt
```

## 🔄 Daily Workflow

### Start Working
```bash
# 1. Navigate to ThreadSense folder
cd /Users/username/Desktop/ThreadSense

# 2. Activate virtual environment
source .venv/bin/activate

# 3. Navigate to backend
cd Piazza-AI-Plugin/backend

# 4. Run the server
python main.py
```

### Stop Working
```bash
# 1. Stop server (Ctrl+C)
# 2. Deactivate virtual environment
deactivate
```

## 🧪 Development Commands

### Run Backend Server
```bash
# Development mode (with auto-reload)
python main.py

# Or using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Code Quality
```bash
# Format code
black .

# Lint code
ruff check .

# Type checking
mypy .

# Run tests
pytest
```

## 📝 Environment Variables

### Setup (First Time)
```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
nano .env  # or use your preferred editor
```

### Example .env Contents
```bash
ENVIRONMENT=development
DEBUG=true
HOST=0.0.0.0
PORT=8000

# Add database URL when needed
# DATABASE_URL=postgresql://user:password@localhost:5432/database
```

## 🌐 Access Points

Once the server is running:
- **API Documentation**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc  
- **Health Check**: http://localhost:8000/api/v1/health
- **Root Endpoint**: http://localhost:8000/

## 🤝 Team Setup Instructions

### For New Team Members
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ThreadSense
   ```

2. **Follow the Initial Setup steps above**

3. **Verify installation**:
   ```bash
   source .venv/bin/activate
   cd Piazza-AI-Plugin/backend
   python main.py
   ```

4. **Visit** http://localhost:8000/docs to confirm it works

### IDE Setup (VS Code)
1. **Open project**: Open the `Piazza-AI-Plugin` folder in VS Code
2. **Select interpreter**: Cmd+Shift+P → "Python: Select Interpreter" → Choose `.venv/bin/python`
3. **Install extensions**: Python, Pylance (should auto-suggest)

## 🐛 Troubleshooting

### Virtual Environment Not Activated
**Problem**: Commands fail or wrong Python version
**Solution**: 
```bash
source /Users/username/Desktop/ThreadSense/.venv/bin/activate
```

### Import Errors
**Problem**: `ModuleNotFoundError` for FastAPI/Pydantic
**Solution**: 
```bash
pip install -r requirements.txt
```

### Permission Errors
**Problem**: Can't install packages
**Solution**: Make sure virtual environment is activated first

### Port Already in Use
**Problem**: `Address already in use`
**Solution**: 
```bash
# Kill existing process
lsof -ti:8000 | xargs kill -9

# Or use different port
uvicorn main:app --port 8001
```

## 💡 Pro Tips

1. **Always activate** the virtual environment before working
2. **Use `which python`** to verify you're in the venv
3. **Deactivate** when switching projects
4. **Update dependencies** periodically:
   ```bash
   pip install --upgrade -r requirements.txt
   ```

## 📦 Package Management

### Adding New Dependencies
```bash
# Install new package
pip install new-package

# Add to requirements.txt
echo "new-package==1.0.0" >> requirements.txt

# Or for dev dependencies
echo "dev-package==1.0.0" >> requirements-dev.txt
```

### Freezing Dependencies
```bash
# Generate exact versions (use sparingly)
pip freeze > requirements-frozen.txt
```

---

**Current Status**: ✅ Virtual environment is set up and working!
- **Location**: `/Users/username/Desktop/ThreadSense/.venv`
- **Backend**: Ready to run at `http://localhost:8000`
- **Dependencies**: Installed and verified