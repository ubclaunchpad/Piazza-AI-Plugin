# Study Material Generator - Design Document

## Overview

The Study Material Generator extends ThreadSense to automatically create educational content (quizzes, flashcards, and summaries) from Piazza course materials using LLM technology.

### Key Features
- **Quiz Generation**: Multiple-choice and short-answer questions with auto-grading
- **Flashcard Decks**: Spaced repetition system using SM-2 algorithm
- **Summaries**: Condensed thread summaries and exam guides
- **Progress Tracking**: Quiz scores and flashcard mastery metrics

---

## Architecture

### Design Decisions

**Following Existing Patterns:**
- New router: `app/api/endpoints/study_materials.py`
- LLM service: `app/textGeneration/study_generator.py`
- Models: `app/models/study_materials.py`
- Reuse existing: vector store (PGVector), authentication, database pooling, streaming responses

**Tech Stack:**
- Backend: FastAPI + LangChain + Groq/OpenAI (existing)
- Database: PostgreSQL (Supabase) with new tables
- Frontend: React component in popup + content script integration
- LLM: `openai/gpt-oss-120b` for generation, OpenAI embeddings for retrieval

**Data Flow:**
```
User Request → API Endpoint → Vector Store Retrieval → LLM Generation (streaming) → Save to DB → Return to Frontend
```

---

## Database Schema

### Migration: `supabase/migrations/YYYYMMDD_create_study_materials.sql`

```sql
-- Quizzes
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    piazza_course_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) NOT NULL,
    questions JSONB NOT NULL,  -- [{id, question, type, options[], correct_answer, explanation, points}]
    source_posts TEXT[],
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX idx_quizzes_thread_id ON quizzes(thread_id);
CREATE INDEX idx_quizzes_piazza_course_id ON quizzes(piazza_course_id);

-- Quiz Attempts
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,  -- [{question_id, user_answer, is_correct, points_earned}]
    score DECIMAL(5,2) NOT NULL,
    time_spent_seconds INT,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);

-- Flashcard Decks
CREATE TABLE flashcard_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    piazza_course_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT[],
    total_cards INT DEFAULT 0,
    mastered_cards INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flashcard_decks_user_id ON flashcard_decks(user_id);
CREATE INDEX idx_flashcard_decks_thread_id ON flashcard_decks(thread_id);

-- Flashcards
CREATE TABLE flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    card_type TEXT DEFAULT 'basic' CHECK (card_type IN ('basic', 'cloze')),
    source_post TEXT,
    -- SM-2 Algorithm fields
    ease_factor DECIMAL(3,2) DEFAULT 2.5,
    interval_days INT DEFAULT 0,
    repetitions INT DEFAULT 0,
    next_review TIMESTAMPTZ DEFAULT NOW(),
    last_reviewed TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flashcards_deck_id ON flashcards(deck_id);
CREATE INDEX idx_flashcards_next_review ON flashcards(next_review);

-- Flashcard Reviews (for progress tracking)
CREATE TABLE flashcard_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quality INT NOT NULL CHECK (quality BETWEEN 0 AND 5),  -- SM-2 quality rating
    reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flashcard_reviews_flashcard_id ON flashcard_reviews(flashcard_id);

-- Summaries
CREATE TABLE summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    piazza_course_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,  -- Markdown-formatted
    summary_type TEXT CHECK (summary_type IN ('thread', 'weekly', 'exam_guide', 'custom')),
    source_posts TEXT[],
    tags TEXT[],
    word_count INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_summaries_user_id ON summaries(user_id);
CREATE INDEX idx_summaries_thread_id ON summaries(thread_id);
CREATE INDEX idx_summaries_summary_type ON summaries(summary_type);

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_quizzes_updated_at BEFORE UPDATE ON quizzes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_flashcard_decks_updated_at BEFORE UPDATE ON flashcard_decks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_summaries_updated_at BEFORE UPDATE ON summaries
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update deck card counts
CREATE OR REPLACE FUNCTION update_deck_card_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE flashcard_decks SET total_cards = total_cards + 1, updated_at = NOW()
        WHERE id = NEW.deck_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE flashcard_decks SET total_cards = GREATEST(total_cards - 1, 0), updated_at = NOW()
        WHERE id = OLD.deck_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deck_card_count
AFTER INSERT OR DELETE ON flashcards
FOR EACH ROW EXECUTE FUNCTION update_deck_card_count();
```

---

## Backend API Design

### Endpoints: `app/api/endpoints/study_materials.py`

**Quiz Endpoints:**
- `POST /study/quiz/generate` - Generate quiz (streaming NDJSON)
- `GET /study/quiz/{quiz_id}` - Get quiz details
- `POST /study/quiz/{quiz_id}/submit` - Submit answers, get score
- `GET /study/quiz` - List all user quizzes (filterable)
- `DELETE /study/quiz/{quiz_id}` - Delete quiz

**Flashcard Endpoints:**
- `POST /study/flashcards/generate` - Generate deck (streaming)
- `GET /study/flashcards/{deck_id}` - Get deck with all cards
- `PUT /study/flashcards/{card_id}/review` - Submit review (updates SM-2)
- `GET /study/flashcards/{deck_id}/due` - Get cards due for review
- `GET /study/flashcards` - List all decks
- `DELETE /study/flashcards/{deck_id}` - Delete deck

**Summary Endpoints:**
- `POST /study/summary/generate` - Generate summary (streaming)
- `GET /study/summary/{summary_id}` - Get summary
- `GET /study/summary` - List all summaries
- `DELETE /study/summary/{summary_id}` - Delete summary

**Combined:**
- `GET /study/materials` - List all materials (quizzes, decks, summaries)

### Request/Response Pattern
- All endpoints require `Authorization: Bearer <token>`
- Generation endpoints return **NDJSON streams**:
  ```json
  {"type": "progress", "message": "Retrieving content..."}
  {"type": "question", "question": {...}, "index": 1, "total": 10}
  {"type": "complete", "quiz_id": "uuid", "num_questions": 10}
  ```

---

## LLM Orchestration

### Service: `app/textGeneration/study_generator.py`

**Core Functions:**

1. **`generate_quiz_stream(quiz_data, user_id)`**
   - Retrieve context from vector store (thread_id collection)
   - Use LangChain prompt template with difficulty + context
   - Generate JSON-structured questions via LLM
   - Stream progress updates
   - Save to `quizzes` table

2. **`generate_flashcards_stream(deck_data, user_id)`**
   - Retrieve key concepts from vector store
   - Generate front/back pairs (basic or cloze)
   - Stream each card as generated
   - Save deck + cards to database

3. **`generate_summary_stream(summary_data, user_id)`**
   - Retrieve comprehensive context (10-20 docs)
   - Generate markdown-formatted summary
   - Stream content chunks
   - Save to `summaries` table

4. **`grade_quiz_submission(questions, answers)`**
   - Multiple choice: exact match
   - Short answer: keyword matching
   - Return score + detailed feedback

5. **`update_flashcard_sm2(ease_factor, interval_days, repetitions, quality)`**
   - SM-2 spaced repetition algorithm
   - Quality 0-5 → new interval, ease factor, repetitions
   - Return updated parameters

### Prompting Strategy

**Quiz Generation:**
```
System: "You are an expert educational content creator. Generate {num_questions}
quiz questions at {difficulty} difficulty from the provided Piazza context.
Include clear questions, realistic options, and detailed explanations."

Context: {retrieved_docs}
```

**Flashcard Generation:**
```
System: "Create {num_cards} flashcards. Front: short prompt. Back: concise answer.
Focus on definitions, concepts, formulas. Use cloze deletion where appropriate."

Context: {retrieved_docs}
```

**Summary Generation:**
```
System: "Generate a {length} {summary_type} summary in Markdown. Include headings,
bullet points, and bold key terms. Prioritize core concepts and common questions."

Context: {retrieved_docs}
```

---

## Frontend Design

### New Component: `src/popup/StudyMaterialsPage.jsx`

**Structure:**
```
StudyMaterialsPage
├── Tab Navigation (Quizzes | Flashcards | Summaries)
├── Generate Button → Opens dialog with config
├── Materials List → Cards showing each material
└── Material Viewer → Quiz player / Flashcard player / Summary viewer
```

**Key Features:**
- **Generation Dialog**: Title, difficulty/length, num questions/cards, tags
- **Streaming UI**: Progress messages during generation
- **Quiz Player**: Question navigation, answer input, submit, view results with explanations
- **Flashcard Player**: Card flip animation, SM-2 quality buttons (Again/Hard/Good/Easy)
- **Summary Viewer**: Markdown rendering with KaTeX for math

**State Management:**
- Fetch all materials on mount
- Handle streaming responses with `fetch().body.getReader()`
- Update UI progressively as content generates

### Content Script Integration: `src/content/content.js`

**Features:**
- Inject "📚 Generate Study Materials" button on Piazza thread pages
- Button opens popup to Study Materials tab
- Quick-generate options (e.g., "Summarize this thread")

---

## Implementation Plan

### Phase 1: Database & API Structure (Week 1)
- Create migration, run on dev database
- Build Pydantic models (`app/models/study_materials.py`)
- Create router file with endpoint stubs
- Test basic CRUD (no LLM yet)

### Phase 2: LLM Integration (Week 2)
- Implement `study_generator.py` with all generation functions
- Add streaming logic
- Integrate vector store retrieval
- Implement grading and SM-2 algorithm

### Phase 3: Frontend Core (Week 3)
- Build `StudyMaterialsPage` component
- Add tab navigation and material listing
- Create generation dialogs
- Implement streaming UI updates

### Phase 4: Interactive Features (Week 4)
- Build quiz player with submission/grading
- Build flashcard player with SM-2 review
- Add summary viewer with markdown rendering
- Test end-to-end flows

### Phase 5: Content Script + Polish (Week 5)
- Inject buttons on Piazza pages
- Add quick-generate flows
- Bug fixes and UX improvements
- Documentation

---

## Key Technical Considerations

### Security
- All endpoints require authentication
- Users only access their own materials (verified via `user_id`)
- Input validation via Pydantic
- Parameterized SQL queries (no injection risk)

### Performance
- Database indexes on all foreign keys and query fields
- Cached counts updated via triggers
- Streaming responses for better UX
- Reuse existing connection pooling

### SM-2 Spaced Repetition Algorithm
```
if quality >= 3 (correct):
    if repetitions == 0: interval = 1 day
    if repetitions == 1: interval = 6 days
    else: interval = previous_interval * ease_factor
    repetitions++
else (incorrect):
    repetitions = 0, interval = 1 day

ease_factor = ease_factor + (0.1 - (5-quality) * (0.08 + (5-quality) * 0.02))
ease_factor = max(1.3, ease_factor)
```

---

## Success Metrics
- Users generate at least 1 study material per week
- 80%+ quiz completion rate
- 60%+ flashcard review engagement
- Positive feedback on content quality

---

**Next Steps:**
1. Review design with team
2. Create GitHub issues for each phase
3. Begin Phase 1 implementation

---

**Version:** 1.0
**Last Updated:** 2026-02-06
