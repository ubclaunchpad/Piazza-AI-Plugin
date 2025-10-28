CREATE TABLE users (
    id UUID PRIMARY KEY,
    display_name VARCHAR(255),
    hashed_email VARCHAR(255) UNIQUE,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),  
    updated_at TIMESTAMPTZ DEFAULT NOW()   
);


