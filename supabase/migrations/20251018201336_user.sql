CREATE TABLE users (
    id UUID PRIMARY KEY,
    display_name TEXT UNIQUE NOT NULL,
    hashed_email TEXT UNIQUE,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),  
    updated_at TIMESTAMPTZ DEFAULT NOW()   
);


