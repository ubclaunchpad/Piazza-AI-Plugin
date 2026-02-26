CREATE TABLE calendar_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    piazza_course_id TEXT NOT NULL,
    google_event_id TEXT,
    title TEXT NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    source_post_number TEXT,
    reminder_settings JSONB DEFAULT '{"1_day": true, "1_week": false}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
