CREATE TABLE resource_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    piazza_course_id TEXT,
    topic TEXT NOT NULL,
    resource_type TEXT, --e.g. youtube, stackoverflow, khan_academy, wikipedia
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    relevance_score DECIMAL(3, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_resource_library_user_course
    ON resource_library (user_id, piazza_course_id);

CREATE INDEX idx_resource_library_topic
    ON resource_library (topic);

