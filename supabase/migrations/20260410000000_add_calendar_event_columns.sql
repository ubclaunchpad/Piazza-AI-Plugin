ALTER TABLE calendar_events
    ADD COLUMN IF NOT EXISTS event_start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS event_end_at TIMESTAMPTZ,
    REMOVE COLUMN IF EXISTS event_date,
    ADD COLUMN IF NOT EXISTS source_post_number TEXT,
    ADD COLUMN IF NOT EXISTS reminder_settings JSONB DEFAULT '{"1_day": true, "1_week": false}';

ALTER TABLE calendar_tokens
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

