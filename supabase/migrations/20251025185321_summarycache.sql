CREATE TYPE validation_label_enum AS ENUM ('SUPPORTED', 'MIXED', 'CONTRADICTED');

CREATE TABLE summary_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID,
    thread_id UUID NOT NULL,
    summary_text TEXT NOT NULL,
    summary_confidence FLOAT CHECK (summary_confidence >= 0 AND summary_confidence <= 100),
    validation_label validation_label_enum NOT NULL,
    validation_confidence FLOAT CHECK (validation_confidence >= 0 AND validation_confidence <= 100),
    source_chunks JSONB NOT NULL,
    last_computed_as TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (thread_id) REFERENCES threads(id)
);

