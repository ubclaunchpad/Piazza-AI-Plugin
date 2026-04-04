\CREATE TABLE calendar_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token BYTEA NOT NULL,
    refresh_token BYTEA NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    piazza_course_id TEXT NOT NULL,
    google_event_id TEXT,
    title TEXT NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    source_post_number TEXT,
    reminder_settings JSONB DEFAULT '{"1_day": true, "1_week": false}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_user_course ON calendar_events (user_id, piazza_course_id);
CREATE INDEX idx_calendar_tokens_user ON calendar_tokens (user_id);
