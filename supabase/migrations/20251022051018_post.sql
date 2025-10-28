CREATE TYPE poster_role_enum AS ENUM ('student', 'ta', 'instructor');

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL,
    piazza_post_id VARCHAR(250) NOT NULL,
    poster_role poster_role_enum,
    body_html TEXT,
    body_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_answer BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    FOREIGN KEY (thread_id) REFERENCES threads(id)
);