CREATE TABLE threads(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    thread_title VARCHAR(255),
    piazza_course_id VARCHAR(255) UNIQUE NOT NULL,
    is_indexable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_piazza_course_id ON threads (piazza_course_id);

