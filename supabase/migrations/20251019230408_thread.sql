CREATE TABLE threads(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
    thread_title TEXT,
    piazza_course_id TEXT UNIQUE NOT NULL,
    is_indexable BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_piazza_course_id ON threads (piazza_course_id);

