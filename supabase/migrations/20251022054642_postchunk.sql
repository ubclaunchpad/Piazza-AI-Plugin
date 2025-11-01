CREATE TABLE post_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL,
    thread_id UUID NOT NULL,
    chunk_index INTEGER,
    text_chunk TEXT NOT NULL,
    token_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (thread_id) REFERENCES threads(id)
);