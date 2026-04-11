CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    piazza_course_id TEXT,
    query TEXT NOT NULL,
    search_type TEXT NOT NULL DEFAULT 'semantic',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT saved_searches_search_type_check
        CHECK (search_type IN ('semantic', 'code', 'formula'))
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id
    ON saved_searches(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_searches_course
    ON saved_searches(piazza_course_id);
