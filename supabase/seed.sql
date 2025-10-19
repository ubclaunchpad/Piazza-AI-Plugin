-- Example Test
INSERT INTO example (name) VALUES ('Test');

-- User Test Seed
INSERT INTO users (user_id,display_name, hashed_email, settings) VALUES (
    uuid_generate_v4(), -- supabase client id
    'Six Seven',
    encode(digest('john@example.com', 'sha256'), 'hex'),
    '{}':: jsonb
);

-- Threads Test Seed
INSERT INTO threads (thread_title, piazza_course_id, metadata) VALUES (
    'CPSC213',
    'random_piazza_id',
    '{}' :: jsonb
);