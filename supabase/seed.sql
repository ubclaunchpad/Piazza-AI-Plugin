-- Insert User
WITH inserted_user AS (
  INSERT INTO users (id, display_name, hashed_email, settings)
  VALUES (
    uuid_generate_v4(),
    'John Doe',
    encode(digest('john_doe@example.com', 'sha256'), 'hex'),
    '{}'::jsonb
  )
  RETURNING id
),

-- Insert Thread
inserted_thread AS (
  INSERT INTO threads (thread_title, piazza_course_id, metadata)
  VALUES (
    'CPSC213',
    'random_piazza_id',
    '{}'::jsonb
  )
  RETURNING id
)

-- Insert Enrollment
INSERT INTO enrollments (user_id, thread_id, opted_in)
SELECT u.id, t.id, TRUE
FROM inserted_user u, inserted_thread t;
