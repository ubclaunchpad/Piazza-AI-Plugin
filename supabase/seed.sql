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
),

-- Insert Enrollment
inserted_enrollment AS (
  INSERT INTO enrollments (user_id, thread_id, opted_in)
  SELECT u.id, t.id, TRUE
  FROM inserted_user u, inserted_thread t
),
-- Insert Post
inserted_post AS (
  INSERT INTO posts (thread_id, piazza_post_id, poster_role, body_html, body_text, metadata)
  SELECT t.id, 'some id','student', '', '', '{}'::jsonb
  FROM inserted_thread t
  RETURNING id
),

-- Insert PostChunk
inserted_post_chunk AS (
  INSERT INTO post_chunks (post_id, thread_id, chunk_index, text_chunk, token_count, metadata)
  SELECT p.id, t.id, 0, '', 0, '{}'::jsonb
  FROM inserted_post p, inserted_thread t
),
-- Insert Document
inserted_document AS (
  INSERT INTO documents (thread_id, uploader_id, file_name, file_type, file_size, permission, metadata)
  SELECT t.id, u.id, 'syllabus', 'pdf', '1000', 'thread', '{}'::jsonb
  FROM inserted_thread t, inserted_user u
  RETURNING id
)

-- Insert Document Chunk
INSERT INTO document_chunks(document_id, thread_id, text_chunk, token_count, metadata)
SELECT d.id, t.id, '', 0, '{}'::jsonb
FROM inserted_document d, inserted_thread t

