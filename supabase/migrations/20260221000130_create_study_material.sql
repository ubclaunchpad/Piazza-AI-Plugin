-- Quizzes
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    piazza_course_id TEXT NOT NULL,
    title TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    questions JSONB NOT NULL, -- [{question, type, options[], correct_answer, explanation}]
    source_posts TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    score DECIMAL(5,2),
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcards
CREATE TABLE flashcard_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    piazza_course_id TEXT NOT NULL,
    title TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    card_type TEXT DEFAULT 'concept', -- concept, definition, qa
    -- Spaced repetition fields (SM-2 algorithm)
    ease_factor DECIMAL(3,2) DEFAULT 2.5,
    interval_days INT DEFAULT 0,
    next_review TIMESTAMPTZ DEFAULT NOW(),
    review_count INT DEFAULT 0
);

-- Summaries
CREATE TABLE summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    piazza_course_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary_type TEXT, -- thread, weekly, exam_guide
    source_posts TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);