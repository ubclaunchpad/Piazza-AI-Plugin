# Supabase Local Development Guide

This folder contains Supabase configuration and database migrations for the Piazza AI Plugin project.

## ⚠️ Prerequisites

**Docker Desktop must be running** before using any Supabase commands. Supabase runs all its services (PostgreSQL, Studio, etc.) in Docker containers.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) if you haven't already
2. Start Docker Desktop application
3. Verify Docker is running: `docker --version`

## 🚀 Quick Reference

### Getting Your Connection Details

First, make sure Supabase is running and check the status (your first time running the start command may take a while because supabase is downloading the docker images):

```bash
supabase start
supabase status
```

Example output from `supabase status`:

```
supabase local development setup is running.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
         MCP URL: http://127.0.0.1:54321/mcp
    Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
     Mailpit URL: http://127.0.0.1:54324
 Publishable key: eyJ[...truncated...]
      Secret key: eyJ[...truncated...]
   S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
   S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
       S3 Region: local
```

### Using the Output in Your .env File

Copy the values from your `supabase status` output:

```bash
# From "Database URL" line
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# From "API URL" line
SUPABASE_URL=http://127.0.0.1:54321

# From "Publishable key" line (copy the full key)
SUPABASE_ANON_KEY=your_publishable_key_from_status_output

# From "Secret key" line (copy the full key)
SUPABASE_SERVICE_ROLE_KEY=your_secret_key_from_status_output
```

### Studio URL (Database Management)

Use the **Studio URL** from your `supabase status` output (typically `http://127.0.0.1:54323`) to access the Supabase Studio for visual database management, running queries, and inspecting data.

## 📋 Essential Supabase CLI Commands

### Project Management

```bash
# Start Supabase local development
supabase start

# Stop Supabase local development
supabase stop

# Check status of local services
supabase status

# Reset local database (⚠️ destroys all data)
supabase db reset

# Stop and remove all containers
supabase stop --no-backup
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
# Apply all pending migrations to local database
supabase migration up --local

# Apply migrations to remote database (production)
supabase migration up

# Rollback last migration (local)
supabase migration down --local

# Check migration status
supabase migration list
```

#### Database Schema Management

```bash
# Generate migration from current database state
supabase db diff --local

# Generate TypeScript types from database
supabase gen types typescript --local > types/database.types.ts

# Reset database to latest migration state
supabase db reset --local
```

### Development Workflow

```bash
# Full development setup (run once)
supabase start
supabase migration up --local

# Daily development (if containers stopped)
supabase start

# After pulling new migrations
supabase migration up --local

# Before pushing schema changes
supabase db diff --local > migrations/new_migration.sql
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

1. Open http://127.0.0.1:54323
2. Navigate through tables, run queries, manage data
3. Visual interface for schema management

### Using SQL Editor

```bash
# Connect with psql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Or use any PostgreSQL client with the connection string above
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

Make sure your `.env` file includes:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Port Configuration

Default ports (configurable in config.toml):

- **API**: 54321
- **Database**: 54322
- **Studio**: 54323
- **Mailpit**: 54324

## 🔗 Useful Links

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Database Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Local Development Setup](https://supabase.com/docs/guides/cli/local-development)
- [SQL Reference](https://supabase.com/docs/guides/database)

## 🆘 Troubleshooting

### Common Issues

**Services won't start:**

```bash
# Check if ports are in use
lsof -i :54321 -i :54322 -i :54323 -i :54324

# Force stop and restart
supabase stop --no-backup
supabase start
```

**Migration errors:**

```bash
# Check migration status
supabase migration list

# Reset and reapply
supabase db reset --local
supabase migration up --local
```

**Connection issues:**

```bash
# Verify services are running
supabase status

# Test connection
python ../backend/test_supabase_connection.py
```

---

For additional help, check the [main project README](../README.md) or ask in the team Slack channel.
