# Supabase Cloud Development Guide

This folder contains Supabase configuration and database migrations for the Piazza AI Plugin project.

> **Note**: This project uses a **cloud-hosted Supabase instance**. The instructions below are for managing migrations and connecting to your cloud project. If you're looking for local development with Docker, that's not the current setup.

## ⚠️ Prerequisites

1. **Supabase Cloud Project**: Create a project at https://supabase.com/dashboard
2. **Supabase CLI**: Install the CLI for managing migrations
   ```bash
   npm install -g supabase
   # or
   brew install supabase/tap/supabase
   ```
3. **Link Your Project**: Link this local folder to your cloud project (see setup below)

## 🚀 Quick Reference

### Getting Your Connection Details

Get your connection details from the Supabase Dashboard:

1. **Navigate to your project** at https://supabase.com/dashboard
2. **Go to Project Settings** (gear icon in sidebar)
3. **Database section** → Connection String → Copy the URI format
4. **API section** → Copy Project URL, anon key, and service_role key

### Using the Values in Your .env File

Add these to your `backend/.env` file:

```bash
# From Project Settings → Database → Connection String (URI)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# From Project Settings → API → Project URL
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co

# From Project Settings → API → Project API keys → anon public
SUPABASE_ANON_KEY=your_anon_key_from_dashboard

# From Project Settings → API → Project API keys → service_role secret
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_dashboard
```

### Supabase Studio (Database Management)

Access the Supabase Studio for visual database management:
- **URL**: https://supabase.com/dashboard/project/[YOUR-PROJECT-REF]
- Navigate to "Table Editor", "SQL Editor", or "Database" sections
- Run queries, inspect data, and manage your schema visually

## 📋 Essential Supabase CLI Commands

### Project Management

```bash
# Link to your cloud Supabase project (run once)
supabase link

# Check project status
# Note: For cloud projects, use the dashboard at https://supabase.com/dashboard
# Or check platform status at https://status.supabase.com

# Pull remote schema changes
supabase db pull

# Reset remote database (⚠️ destroys all data - use with extreme caution)
supabase db reset --linked
```

### Database Migrations

#### Creating Migrations

```bash
# Create a new migration file
supabase migration new <migration_name>

# Examples:
supabase migration new "create_users_table"
supabase migration new "add_posts_table"
supabase migration new "update_user_permissions"
```

#### Running Migrations

```bash
# Apply all pending migrations to linked cloud database
supabase migration up --linked

# Check migration status
supabase migration list

# Note: Always test migrations carefully before applying to production
# Consider creating a staging project for testing migrations first
```

#### Database Schema Management

```bash
# Generate migration from remote database changes
supabase db diff --linked

# Generate TypeScript types from linked cloud database
supabase gen types typescript --linked > types/database.types.ts

# Pull remote schema to local migration files
supabase db pull
```

### Development Workflow

```bash
# Initial setup (run once)
cd supabase
supabase link
supabase migration up --linked

# After pulling new migrations from git
supabase migration up --linked

# Before committing schema changes
supabase db diff --linked > migrations/$(date +%Y%m%d%H%M%S)_description.sql
# Review the generated migration file, then apply it
supabase migration up --linked
```

## 🗂️ Folder Structure

```
supabase/
├── config.toml          # Supabase project configuration
├── seed.sql            # Initial data for development
├── migrations/         # Database schema changes
│   └── *.sql          # Migration files (timestamped)
├── functions/         # Edge Functions (serverless)
└── tests/            # Database tests
```

## 🔧 Configuration Files

### config.toml

Contains local development configuration including:

- Project ID
- Database settings
- API configuration
- Service ports

### seed.sql

Initial data inserted after migrations run. Use for:

- Development test data
- Default application settings
- Sample records for testing

## 📊 Database Management

### Using Studio (Recommended)

1. Go to https://supabase.com/dashboard/project/[YOUR-PROJECT-REF]
2. Navigate through tables, run queries, manage data
3. Visual interface for schema management
4. Access Table Editor, SQL Editor, Database sections

### Using SQL Editor

```bash
# Connect with psql using your cloud connection string
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Or use any PostgreSQL client with your DATABASE_URL from .env
# Or use the SQL Editor in the Supabase Dashboard (recommended)
```

## 🔄 Common Migration Patterns

### Creating Tables

```sql
-- migrations/20231004000001_create_users_table.sql
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);
```

### Adding Columns

```sql
-- migrations/20231004000002_add_user_avatar.sql
ALTER TABLE users
ADD COLUMN avatar_url TEXT,
ADD COLUMN bio TEXT;
```

### Creating Indexes

```sql
-- migrations/20231004000003_add_user_indexes.sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

## 🚨 Important Notes

### Development Best Practices

1. **Always create migrations** for schema changes - don't modify the database directly
2. **Test migrations locally** before applying to production
3. **Use descriptive migration names** with clear purposes
4. **Keep migrations atomic** - one logical change per migration
5. **Never edit existing migrations** - create new ones for changes

### Environment Variables

Make sure your `backend/.env` file includes your cloud project credentials:

```bash
# Database (from Supabase Dashboard → Project Settings → Database)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Supabase (from Supabase Dashboard → Project Settings → API)
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=your_anon_key_from_dashboard
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_dashboard
```

### Checking Project Status

Since you're using a cloud Supabase instance, the `supabase status` CLI command won't work (it's only for local Docker setups).

**To check your cloud project status:**
- **Dashboard**: Visit https://supabase.com/dashboard → Select your project → Check "Project Status" section
- **Platform Status**: Visit https://status.supabase.com for overall Supabase platform health
- **Programmatically**: Make a test API call to your project endpoints

## 🔗 Useful Links

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Database Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Local Development Setup](https://supabase.com/docs/guides/cli/local-development)
- [SQL Reference](https://supabase.com/docs/guides/database)

## 🆘 Troubleshooting

### Common Issues

**Connection issues:**

```bash
# Verify your project is linked
supabase link --project-ref [YOUR-PROJECT-REF]

# Check migration status
supabase migration list

# Test connection from backend
python ../backend/test_supabase_connection.py
```

**Migration errors:**

```bash
# Check migration status
supabase migration list

# Pull current remote state
supabase db pull

# If needed, reset remote database (⚠️ DESTROYS ALL DATA)
supabase db reset --linked
```

**Project health issues:**

- Check your project status in the Supabase dashboard
- Visit https://status.supabase.com for platform-wide issues
- Verify your IP is whitelisted (if connection pooling is restricted)
- Check database resources aren't exhausted (CPU, memory, connections)

---

For additional help, check the [main project README](../README.md) or ask in the team Slack channel.
