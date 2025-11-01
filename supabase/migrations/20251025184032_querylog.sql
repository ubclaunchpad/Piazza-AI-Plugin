CREATE TABLE query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    thread_id UUID NOT NULL,
    query_text TEXT NOT NULL,
    query_response TEXT NOT NUll,
    results JSONB, -- [{source_type, source_id, score}]
    duration_ms FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (thread_id) REFERENCES threads(id)
);

