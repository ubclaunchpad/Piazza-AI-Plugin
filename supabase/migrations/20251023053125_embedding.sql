-- Replicated Vector DB For Supabase
-- https://deepwiki.com/diegoperea20/n8n-rag-gemini-supabase/3.1-supabase-vector-database-setup

CREATE EXTENSION IF NOT EXISTS vector;
CREATE TYPE source_type_enum AS ENUM ('post_chunk', 'doc_chunk', 'external');

-- Partition Table For Generalized Embeddings
CREATE TABLE embeddings (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    source_type source_type_enum NOT NULL,
    source_id UUID NOT NULL,
    thread_id UUID NOT NULL,
    embedding VECTOR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,
    FOREIGN KEY (thread_id) REFERENCES threads(id),
    PRIMARY KEY (id, source_type)
)
PARTITION BY LIST (source_type);

-- Partition of Post Chunk Embeddings
CREATE TABLE embeddings_post_chunks
    PARTITION OF embeddings
    FOR VALUES IN ('post_chunk');

-- Partition of Doc Chunk Embeddings
CREATE TABLE embeddings_doc_chunks
    PARTITION OF embeddings
    FOR VALUES IN ('doc_chunk', 'external');


-- Enforce Function 
-- Ensures source_id and source_type are always synced and references correct foreign key
CREATE OR REPLACE FUNCTION enforce_source_fk()
RETURNS TRIGGER 
SET search_path = ''
AS $$
BEGIN
    IF NEW.source_type = 'post_chunk' THEN
        IF NOT EXISTS (SELECT 1 FROM post_chunks WHERE id = NEW.source_id) THEN
            RAISE EXCEPTION 'Invalid source_id for post_chunk: %', NEW.source_id;
        END IF;
    ELSE -- doc_chunk or external
        IF NOT EXISTS (SELECT 1 FROM document_chunks WHERE id = NEW.source_id) THEN
            RAISE EXCEPTION 'Invalid source_id for doc_chunk/external: %', NEW.source_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Apply Trigger
CREATE TRIGGER embeddings_source_fk_check
BEFORE INSERT OR UPDATE ON embeddings
FOR EACH ROW
EXECUTE FUNCTION enforce_source_fk();


