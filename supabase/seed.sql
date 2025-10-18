-- Example Test
INSERT INTO example (name) VALUES ('Test');

-- User Test
INSERT INTO users (display_name, hashed_email) VALUES (
    'Six Seven',
    encode(digest('john@example.com', 'sha256'), 'hex')
);