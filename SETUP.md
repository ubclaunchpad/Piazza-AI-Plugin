# ThreadSense Setup Guide

This guide will help you set up the ThreadSense Piazza AI Plugin backend environment.

## Backend Environment Configuration

### 1. Create `.env` File

Navigate to the `backend` directory and create a `.env` file with the following structure:

```env
# API Configuration
API_PREFIX=/api/v1

# CORS Configuration - Chrome Extension Support
# Note: Use JSON array format
ALLOWED_ORIGINS=["http://localhost:3000", "chrome-extension://*", "https://piazza.com"]

# Database Configuration (Supabase)
# Get these values from: Supabase Dashboard → Project Settings → Database/API
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# LLM Configuration
# Get your API key from: https://console.groq.com/keys
GROQ_API_KEY=your_groq_api_key_here

OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Environment Variables Explanation

#### API Configuration

- **`API_PREFIX`**: The base path for all API endpoints (default: `/api/v1`)

#### CORS Configuration

- **`ALLOWED_ORIGINS`**: JSON array of allowed origins for CORS. Includes:
  - `http://localhost:3000` - Local development
  - `chrome-extension://*` - Chrome extension support (wildcard for any extension ID)
  - `https://piazza.com` - Piazza website integration

#### Database Configuration (Supabase)

- **`DATABASE_URL`**: PostgreSQL connection string for your Supabase database
  - Use the cloud URL for production
  - Uncomment the local URL (`127.0.0.1:54322`) for local Supabase development
- **`SUPABASE_URL`**: Your Supabase project URL
- **`SUPABASE_ANON_KEY`**: Public anonymous key for client-side operations
- **`SUPABASE_SERVICE_ROLE_KEY`**: Service role key for server-side operations (keep secret!)

#### LLM Configuration

- **`GROQ_API_KEY`**: API key for Groq LLM services
  - Get your key from: https://console.groq.com/keys
- **`OPENAI_API_KEY`**: API key for OpenAI services
  - Get your key from: https://platform.openai.com/api-keys

---

## Supabase Setup

### 3. Link Cloud Supabase Project

To connect your local development environment to a remote Supabase project:
1. **Create a Supabase cloud project**
Visit the URL below and after signing in, click on Create New Project.
https://supabase.com/dashboard
2. **Navigate to the Supabase directory:**

   ```bash
   cd supabase
   ```

2. **Link to your remote Supabase project:**

   ```bash
   supabase link
   ```

   This command will:

   - Prompt you to select a remote Supabase project
   - Authenticate with your Supabase account if needed
   - Establish the connection between your local setup and the cloud project

3. **Apply migrations to the linked database:**

   ```bash
   supabase migration up --linked
   ```

   This command will:

   - Apply all pending migrations to your remote Supabase database
   - Ensure your cloud database schema is up to date
   - Sync your local migration files with the remote database

### 4. Verify Setup

After completing the above steps, verify your setup:

**Check Cloud Project Status:**
- Visit your Supabase dashboard at https://supabase.com/dashboard
- Get the `SUPABASE_URL` from this page and add to the `backend/.env` file
- Navigate to your project and check the "Project Status" section
- Ensure all services (Database, Auth, Storage, Realtime) show as healthy
- Go to **Project Settings → API**, then under **Project API keys** copy the values labeled **anon public** and **service_role secret** into `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in your `backend/.env` file.

**Verify Database Connection:**
- Ensure you have set your `DATABASE_URL` variable in the .env. To do so, navigate to your Supabase dashboard → Project Settings → Database → Connection String. Select the "URI" tab and copy the connection string. Replace `[YOUR-PASSWORD]` with your database password (the password you set when creating the project). Add this to your `backend/.env` file as `DATABASE_URL`.

```bash
# Test the connection using the PostgreSQL client (psql)
psql "$DATABASE_URL" -c '\dt'
```

**Note:** The `supabase status` CLI command only works for local development stacks. For cloud projects, use the dashboard or status page above.

---

## Security Notes

⚠️ **Important Security Reminders:**

1. **Never commit the `.env` file** to version control (it should be in `.gitignore`)
2. **Keep your API keys secure** - especially the `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY`
3. **Rotate keys regularly** if you suspect they may have been compromised (remind your lead)
4. **Use environment-specific `.env` files** for development, staging, and production

---

## Troubleshooting

### Database Connection Issues

- Verify your `DATABASE_URL` is correct in your `.env` file
- Check if your IP is whitelisted in Supabase dashboard: Project Settings → Database → Connection Pooling
- Ensure your Supabase cloud project is healthy via the dashboard or https://status.supabase.com
- Verify your database password is correct

### Migration Issues

- Ensure you're in the correct directory (`supabase` folder)
- Verify you have the latest Supabase CLI installed
- Check migration files for syntax errors

### API Key Issues

- Verify keys are valid and not expired
- Check API usage limits haven't been exceeded
- Ensure keys have proper permissions

---

## Next Steps

After completing this setup:

1. Install backend dependencies (if not already done)
2. Start the backend server
3. Test API endpoints
4. Configure the Chrome extension with the backend URL

For more information, refer to the project documentation.
