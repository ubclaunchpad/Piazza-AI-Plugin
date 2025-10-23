CREATE TYPE permission_enum as ENUM ('private', 'thread', 'instructor');

CREATE TABLE documents(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL,
    uploader_id UUID NOT NULL,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    storage_ref TEXT,
    indexed BOOLEAN NOT NULL DEFAULT FALSE,
    permission permission_enum NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB, -- can include version
    FOREIGN KEY (thread_id) REFERENCES threads(id),
    FOREIGN KEY (uploader_id) REFERENCES users(id)
);