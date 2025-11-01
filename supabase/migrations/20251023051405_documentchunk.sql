CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    thread_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    page_number INTEGER,
    text_chunk TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (thread_id) REFERENCES threads(id)
);