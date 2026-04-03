CREATE TABLE calendar_tokens (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    piazza_course_id TEXT,
    google_event_id TEXT,
    title TEXT,
    event_start_at TIMESTAMPTZ,
    event_end_at TIMESTAMPTZ,
    source_post_number TEXT,
    reminder_settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_user_course ON calendar_events(user_id, piazza_course_id);
CREATE INDEX idx_calendar_tokens_user ON calendar_tokens(user_id);