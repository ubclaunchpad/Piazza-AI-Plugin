CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    display_name TEXT UNIQUE NOT NULL,
    hashed_email TEXT UNIQUE,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


