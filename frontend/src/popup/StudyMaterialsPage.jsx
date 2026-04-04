import { useState } from "react";

/* global chrome */
const API_ENDPOINT = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";

// Used in the top bar (includes Home)
const TOP_NAV_ITEMS = [
  { key: "home", label: "Home" },
  { key: "quiz", label: "Quiz" },
  { key: "flashcards", label: "Flashcards" },
  { key: "summary", label: "Summary" },
];

// Used only for the homepage cards
const SECTION_ITEMS = [
  { key: "quiz", label: "Quiz", icon: "📝", desc: "Test your knowledge" },
  { key: "flashcards", label: "Flashcards", icon: "🃏", desc: "Review key terms" },
  { key: "summary", label: "Summary", icon: "📄", desc: "Quick overview" },
];

const lightTheme = {
  bg: "#ffffff",
  cardBg: "#ffffff",
  cardBgHover: "#f5f3ff",
  text: "#111827",
  textMuted: "#6b7280",
  accent: "#7c3aed",
  pillBg: "#7c3aed",
  pillText: "#ffffff",
  cardBorder: "#e5e7eb",
  cardBorderHover: "#7c3aed",
  spinnerTrack: "#e5e7eb",
  spinnerFill: "#a855f7",
};

const darkTheme = {
  bg: "#222831",
  cardBg: "#393E46",
  cardBgHover: "#454c57",
  text: "#DFD0B8",
  textMuted: "#948979",
  accent: "#DFD0B8",
  pillBg: "#DFD0B8",
  pillText: "#222831",
  cardBorder: "#505863",
  cardBorderHover: "#948979",
  spinnerTrack: "#505863",
  spinnerFill: "#DFD0B8",
};

export default function StudyMaterialsPage({ user, onLogout, piazzaCourseId }) {
  const [view, setView] = useState("home");
  const [darkMode, setDarkMode] = useState(false);

  // Summary state (unchanged)
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState(null);
  const [summaryError, setSummaryError] = useState(null);

  // Dashboard list state
  const [quizList, setQuizList] = useState(null);
  const [flashcardList, setFlashcardList] = useState(null);
  const [lastLoadedCourseId, setLastLoadedCourseId] = useState(undefined);
  const [dashboardLoading, setDashboardLoading] = useState({ quiz: false, flashcards: false });
  const [dashboardError, setDashboardError] = useState({ quiz: null, flashcards: null });

  // Currently active quiz/deck for playback
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [activeDeck, setActiveDeck] = useState(null);
  const [quizPlayKey, setQuizPlayKey] = useState(0);
  const [deckPlayKey, setDeckPlayKey] = useState(0);

  // Creation modal visibility
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);

  // Modal form state
  const [quizForm, setQuizForm] = useState({ title: "", difficulty: "medium", num_questions: 10 });
  const [deckForm, setDeckForm] = useState({ title: "", tags: "", num_cards: 15 });

  // Creating state
  const [creating, setCreating] = useState({ quiz: false, flashcards: false });
  const [createError, setCreateError] = useState({ quiz: null, flashcards: null });

  const theme = darkMode ? darkTheme : lightTheme;

  const resolveCourseId = async () => {
    if (piazzaCourseId) return piazzaCourseId;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes("piazza.com")) {
        const pathParts = new URL(tab.url).pathname.split("/").filter(Boolean);
        return pathParts[1] || null;
      }
    } catch (err) {
      console.error("Error reading tab info:", err);
    }
    return null;
  };

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user.access_token}`,
  };

  const fetchQuizList = async (courseId) => {
    setDashboardLoading(prev => ({ ...prev, quiz: true }));
    setDashboardError(prev => ({ ...prev, quiz: null }));
    try {
      const url = courseId
        ? `${API_ENDPOINT}/study/quiz/course/${encodeURIComponent(courseId)}`
        : `${API_ENDPOINT}/study/quiz`;
      const res = await fetch(url, { headers: authHeaders });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setQuizList(await res.json());
    } catch (err) {
      setDashboardError(prev => ({ ...prev, quiz: err.message }));
    } finally {
      setDashboardLoading(prev => ({ ...prev, quiz: false }));
    }
  };

  const fetchFlashcardList = async (courseId) => {
    setDashboardLoading(prev => ({ ...prev, flashcards: true }));
    setDashboardError(prev => ({ ...prev, flashcards: null }));
    try {
      const url = courseId
        ? `${API_ENDPOINT}/study/flashcards/course/${encodeURIComponent(courseId)}`
        : `${API_ENDPOINT}/study/flashcards`;
      const res = await fetch(url, { headers: authHeaders });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setFlashcardList(await res.json());
    } catch (err) {
      setDashboardError(prev => ({ ...prev, flashcards: err.message }));
    } finally {
      setDashboardLoading(prev => ({ ...prev, flashcards: false }));
    }
  };

  const handleNavigate = async (key) => {
    if (key === "home") { setView("home"); return; }
    if (key === "quiz" || key === "flashcards") {
      const courseId = await resolveCourseId();
      const courseChanged = courseId !== lastLoadedCourseId;
      if (key === "quiz") {
        setView("quiz");
        if (quizList === null || courseChanged) {
          setLastLoadedCourseId(courseId);
          fetchQuizList(courseId);
        }
      } else {
        setView("flashcards");
        if (flashcardList === null || courseChanged) {
          setLastLoadedCourseId(courseId);
          fetchFlashcardList(courseId);
        }
      }
      return;
    }
    // Summary
    setView(key);
    if (summaryResult !== null) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const piazza_course_id = await resolveCourseId();
      if (!piazza_course_id) {
        setSummaryError("No Piazza course detected. Navigate to a Piazza class page first.");
        return;
      }
      const res = await fetch(`${API_ENDPOINT}/study/summary/generate`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ piazza_course_id, title: "Auto Summary", summary_type: "weekly" }),
      });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setSummaryResult(await res.json());
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    setCreating(prev => ({ ...prev, quiz: true }));
    setCreateError(prev => ({ ...prev, quiz: null }));
    try {
      const piazza_course_id = await resolveCourseId();
      if (!piazza_course_id) throw new Error("No Piazza course detected.");
      const res = await fetch(`${API_ENDPOINT}/study/quiz/generate`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          piazza_course_id,
          title: quizForm.title || "My Quiz",
          difficulty: quizForm.difficulty,
          num_questions: quizForm.num_questions,
        }),
      });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Request failed: ${res.status}`);
      }
      const quiz = await res.json();
      setQuizList(prev => (prev ? [quiz, ...prev] : [quiz]));
      setActiveQuiz(quiz);
      setQuizPlayKey(k => k + 1);
      setShowQuizModal(false);
      setQuizForm({ title: "", difficulty: "medium", num_questions: 10 });
      setView("quiz-play");
    } catch (err) {
      setCreateError(prev => ({ ...prev, quiz: err.message }));
    } finally {
      setCreating(prev => ({ ...prev, quiz: false }));
    }
  };

  const handleCreateDeck = async () => {
    setCreating(prev => ({ ...prev, flashcards: true }));
    setCreateError(prev => ({ ...prev, flashcards: null }));
    try {
      const piazza_course_id = await resolveCourseId();
      if (!piazza_course_id) throw new Error("No Piazza course detected.");
      const tags = deckForm.tags
        ? deckForm.tags.split(",").map(t => t.trim()).filter(Boolean)
        : [];
      const res = await fetch(`${API_ENDPOINT}/study/flashcards/generate`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          piazza_course_id,
          title: deckForm.title || "My Deck",
          tags: tags.length ? tags : null,
          num_cards: deckForm.num_cards,
        }),
      });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Request failed: ${res.status}`);
      }
      const deck = await res.json();
      setFlashcardList(prev => (prev ? [deck, ...prev] : [deck]));
      setActiveDeck(deck);
      setDeckPlayKey(k => k + 1);
      setShowDeckModal(false);
      setDeckForm({ title: "", tags: "", num_cards: 15 });
      setView("flashcards-play");
    } catch (err) {
      setCreateError(prev => ({ ...prev, flashcards: err.message }));
    } finally {
      setCreating(prev => ({ ...prev, flashcards: false }));
    }
  };

  const navActiveKey = view.startsWith("quiz") ? "quiz"
    : view.startsWith("flashcards") ? "flashcards"
    : view;

  return (
    <div
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        minHeight: "100vh",
        transition: "background-color 300ms ease, color 300ms ease",
      }}
      className="flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4">
        <SlidingPillNav theme={theme} items={TOP_NAV_ITEMS} activeKey={navActiveKey} onSelect={handleNavigate} />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDarkMode(d => !d)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", lineHeight: 1 }}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button
            onClick={onLogout}
            style={{
              color: theme.textMuted,
              backgroundColor: "transparent",
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: "6px",
              padding: "5px 14px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Modals */}
      {showQuizModal && (
        <QuizCreateModal
          theme={theme}
          form={quizForm}
          onChange={setQuizForm}
          onSubmit={handleCreateQuiz}
          onClose={() => { setShowQuizModal(false); setCreateError(prev => ({ ...prev, quiz: null })); }}
          isCreating={creating.quiz}
          error={createError.quiz}
        />
      )}
      {showDeckModal && (
        <DeckCreateModal
          theme={theme}
          form={deckForm}
          onChange={setDeckForm}
          onSubmit={handleCreateDeck}
          onClose={() => { setShowDeckModal(false); setCreateError(prev => ({ ...prev, flashcards: null })); }}
          isCreating={creating.flashcards}
          error={createError.flashcards}
        />
      )}

      {view === "home" ? (
        <HomePage theme={theme} onNavigate={handleNavigate} />
      ) : view === "quiz" ? (
        <QuizDashboard
          theme={theme}
          quizList={quizList}
          isLoading={dashboardLoading.quiz}
          error={dashboardError.quiz}
          onSelectQuiz={(quiz) => { setActiveQuiz(quiz); setQuizPlayKey(k => k + 1); setView("quiz-play"); }}
          onNewQuiz={() => setShowQuizModal(true)}
        />
      ) : view === "quiz-play" && activeQuiz ? (
        <QuizView
          key={quizPlayKey}
          theme={theme}
          quizData={activeQuiz}
          user={user}
          onRetry={() => setQuizPlayKey(k => k + 1)}
          onReturnToDashboard={() => setView("quiz")}
          onNewQuiz={() => { setView("quiz"); setShowQuizModal(true); }}
        />
      ) : view === "flashcards" ? (
        <FlashcardDashboard
          theme={theme}
          deckList={flashcardList}
          isLoading={dashboardLoading.flashcards}
          error={dashboardError.flashcards}
          onSelectDeck={(deck) => { setActiveDeck(deck); setDeckPlayKey(k => k + 1); setView("flashcards-play"); }}
          onNewDeck={() => setShowDeckModal(true)}
        />
      ) : view === "flashcards-play" && activeDeck ? (
        <FlashcardsView
          key={deckPlayKey}
          theme={theme}
          flashcardData={activeDeck}
          user={user}
          onReviewAgain={() => setDeckPlayKey(k => k + 1)}
          onReturnToDashboard={() => setView("flashcards")}
          onNewDeck={() => { setView("flashcards"); setShowDeckModal(true); }}
        />
      ) : (
        <SectionView
          theme={theme}
          view={view}
          isLoading={summaryLoading}
          result={summaryResult}
          error={summaryError}
        />
      )}
    </div>
  );
}

// ─── Quiz Components ──────────────────────────────────────────────────────────

function QuizView({ theme, quizData, user, onRetry, onReturnToDashboard, onNewQuiz }) {
  const { questions, id, title, difficulty } = quizData;

  const [mcAnswers, setMcAnswers] = useState({});
  const [msSelections, setMsSelections] = useState({});
  const [msAnswers, setMsAnswers] = useState({});
  const [lockedQuestions, setLockedQuestions] = useState(new Set());
  const [revealCorrect, setRevealCorrect] = useState(new Set());
  const [phase, setPhase] = useState("taking");
  const [quizResult, setQuizResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allAnswered = questions.every((_, i) => lockedQuestions.has(i));

  const handleMCAnswer = (qIdx, selectedOption) => {
    if (lockedQuestions.has(qIdx)) return;
    const correct = questions[qIdx].correct_answer;
    setMcAnswers(prev => ({ ...prev, [qIdx]: selectedOption }));
    setLockedQuestions(prev => new Set([...prev, qIdx]));
    if (selectedOption !== correct) {
      setTimeout(() => {
        setRevealCorrect(prev => new Set([...prev, qIdx]));
      }, 800);
    } else {
      setRevealCorrect(prev => new Set([...prev, qIdx]));
    }
  };

  const handleMSToggle = (qIdx, option) => {
    if (lockedQuestions.has(qIdx)) return;
    setMsSelections(prev => {
      const current = prev[qIdx] || [];
      if (current.includes(option)) {
        return { ...prev, [qIdx]: current.filter(o => o !== option) };
      }
      return { ...prev, [qIdx]: [...current, option] };
    });
  };

  const handleMSSubmit = (qIdx) => {
    if (lockedQuestions.has(qIdx)) return;
    const selected = msSelections[qIdx] || [];
    setMsAnswers(prev => ({ ...prev, [qIdx]: selected }));
    setLockedQuestions(prev => new Set([...prev, qIdx]));
    setRevealCorrect(prev => new Set([...prev, qIdx]));
  };

  const handleFinishQuiz = async () => {
    setIsSubmitting(true);
    const answersArray = questions.map((q, i) =>
      q.type === "multiple_select" ? (msAnswers[i] || []) : (mcAnswers[i] || "")
    );
    try {
      const res = await fetch(`${API_ENDPOINT}/study/quiz/${id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({ answers: answersArray }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuizResult(data);
      }
    } catch (err) {
      console.error("Quiz submit failed:", err);
    } finally {
      setIsSubmitting(false);
      setPhase("results");
    }
  };

  if (phase === "results") {
    return (
      <QuizResults
        theme={theme}
        result={quizResult}
        totalCount={questions.length}
        onRetry={onRetry}
        onReturnToDashboard={onReturnToDashboard}
        onNewQuiz={onNewQuiz}
      />
    );
  }

  const diffColor = difficultyColors[difficulty] || difficultyColors.medium;
  const accentText = theme === lightTheme ? "#fff" : darkTheme.pillText;

  return (
    <div className="flex flex-col flex-1" style={{ paddingBottom: "80px" }}>
      {/* Quiz header */}
      <div style={{ padding: "0 32px 20px", maxWidth: "760px", width: "100%", margin: "0 auto" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: "4px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: theme.text }}>
            {title}
          </h2>
          <span
            style={{
              backgroundColor: diffColor.bg,
              color: diffColor.text,
              border: `1px solid ${diffColor.border}`,
              borderRadius: "9999px",
              padding: "2px 10px",
              fontSize: "11px",
              fontWeight: "600",
              textTransform: "capitalize",
            }}
          >
            {difficulty}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: theme.textMuted }}>
          {questions.length} questions — answer all to finish
        </p>
      </div>

      {/* Questions list */}
      <div
        style={{
          maxWidth: "760px",
          width: "100%",
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {questions.map((q, qIdx) => {
          const isLocked = lockedQuestions.has(qIdx);
          const isRevealed = revealCorrect.has(qIdx);
          const isMS = q.type === "multiple_select";
          const msSelected = msSelections[qIdx] || [];
          const msLocked = msAnswers[qIdx] || [];
          const correctAnswers = Array.isArray(q.correct_answer)
            ? q.correct_answer
            : [q.correct_answer];

          return (
            <div
              key={qIdx}
              style={{
                backgroundColor: theme.cardBg,
                border: `1px solid ${isLocked && isRevealed ? theme.cardBorder : theme.cardBorder}`,
                borderRadius: "12px",
                padding: "20px",
                transition: "border-color 200ms ease",
              }}
            >
              {/* Question number + text */}
              <div className="flex items-start gap-3" style={{ marginBottom: "14px" }}>
                <span
                  style={{
                    minWidth: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    backgroundColor: isLocked
                      ? (isRevealed ? "#dcfce7" : "#fee2e2")
                      : theme.accent,
                    color: isLocked
                      ? (isRevealed ? "#15803d" : "#b91c1c")
                      : accentText,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "700",
                    flexShrink: 0,
                    transition: "background-color 400ms ease, color 400ms ease",
                  }}
                >
                  {qIdx + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: theme.text, lineHeight: "1.55" }}>
                    {q.question}
                  </p>
                  {isMS && (
                    <span style={{ fontSize: "11px", color: theme.textMuted, marginTop: "4px", display: "block" }}>
                      Select all that apply
                    </span>
                  )}
                </div>
              </div>

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "38px" }}>
                {q.options.map((option, oIdx) => {
                  if (isMS) {
                    const isChecked = isLocked ? msLocked.includes(option) : msSelected.includes(option);
                    const isCorrectOpt = correctAnswers.includes(option);

                    let optBg = theme.cardBg;
                    let optBorder = theme.cardBorder;
                    let optColor = theme.text;
                    let optOpacity = 1;

                    if (isLocked) {
                      if (isChecked && isCorrectOpt) {
                        optBg = "#dcfce7"; optBorder = "#16a34a"; optColor = "#15803d";
                      } else if (isChecked && !isCorrectOpt) {
                        optBg = "#fee2e2"; optBorder = "#dc2626"; optColor = "#b91c1c";
                      } else if (!isChecked && isCorrectOpt) {
                        optBg = "#dcfce7"; optBorder = "#16a34a"; optColor = "#15803d";
                      } else {
                        optOpacity = 0.5;
                      }
                    }

                    const checkBorderColor = isLocked
                      ? optBorder
                      : (isChecked ? theme.accent : theme.cardBorder);
                    const checkBg = isChecked ? (isLocked ? optBorder : theme.accent) : "transparent";

                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleMSToggle(qIdx, option)}
                        disabled={isLocked}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: `1.5px solid ${optBorder}`,
                          backgroundColor: optBg,
                          color: optColor,
                          cursor: isLocked ? "default" : "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                          opacity: optOpacity,
                          transition: "all 200ms ease",
                        }}
                      >
                        <span
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "4px",
                            border: `2px solid ${checkBorderColor}`,
                            backgroundColor: checkBg,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 150ms ease",
                          }}
                        >
                          {isChecked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path
                                d="M1 4L3.5 6.5L9 1"
                                stroke="#fff"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: "500" }}>{option}</span>
                      </button>
                    );
                  }

                  // Multiple choice
                  const userAnswer = mcAnswers[qIdx];
                  const isSelected = option === userAnswer;
                  const isCorrectOpt = option === q.correct_answer;

                  let optBg = theme.cardBg;
                  let optBorder = theme.cardBorder;
                  let optColor = theme.text;
                  let optOpacity = 1;

                  if (isLocked) {
                    if (isSelected && isCorrectOpt) {
                      optBg = "#dcfce7"; optBorder = "#16a34a"; optColor = "#15803d";
                    } else if (isSelected && !isCorrectOpt) {
                      optBg = "#fee2e2"; optBorder = "#dc2626"; optColor = "#b91c1c";
                    } else if (!isSelected && isCorrectOpt && isRevealed) {
                      optBg = "#dcfce7"; optBorder = "#16a34a"; optColor = "#15803d";
                    } else {
                      optOpacity = 0.5;
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleMCAnswer(qIdx, option)}
                      disabled={isLocked}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: `1.5px solid ${optBorder}`,
                        backgroundColor: optBg,
                        color: optColor,
                        cursor: isLocked ? "default" : "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        opacity: optOpacity,
                        transition: "all 200ms ease",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: "500" }}>{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* MS per-question submit button */}
              {isMS && !isLocked && (
                <div style={{ paddingLeft: "38px", marginTop: "12px" }}>
                  <button
                    onClick={() => handleMSSubmit(qIdx)}
                    disabled={msSelected.length === 0}
                    style={{
                      backgroundColor: msSelected.length === 0 ? theme.cardBorder : theme.accent,
                      color: msSelected.length === 0 ? theme.textMuted : accentText,
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 18px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: msSelected.length === 0 ? "not-allowed" : "pointer",
                      transition: "all 150ms ease",
                      fontFamily: "inherit",
                    }}
                  >
                    Submit Answer
                  </button>
                </div>
              )}

              {/* Explanation shown after answering */}
              {isLocked && isRevealed && q.explanation && (
                <div style={{ paddingLeft: "38px", marginTop: "12px" }}>
                  <div
                    style={{
                      backgroundColor: theme.cardBgHover,
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "12px",
                      color: theme.textMuted,
                      lineHeight: "1.6",
                    }}
                  >
                    <span style={{ fontWeight: "600", color: theme.accent }}>Explanation: </span>
                    {q.explanation}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky bottom bar with Finish Quiz button */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.bg,
          borderTop: `1px solid ${theme.cardBorder}`,
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: "13px", color: theme.textMuted }}>
          {lockedQuestions.size} / {questions.length} answered
        </span>
        <button
          onClick={handleFinishQuiz}
          disabled={!allAnswered || isSubmitting}
          style={{
            backgroundColor: allAnswered ? theme.accent : theme.cardBorder,
            color: allAnswered ? accentText : theme.textMuted,
            border: "none",
            borderRadius: "8px",
            padding: "10px 24px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: allAnswered && !isSubmitting ? "pointer" : "not-allowed",
            transition: "all 150ms ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontFamily: "inherit",
          }}
        >
          {isSubmitting ? (
            <>
              <span
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.35)",
                  borderTopColor: "#fff",
                  display: "inline-block",
                  animation: "spin 0.6s linear infinite",
                }}
              />
              Submitting…
            </>
          ) : (
            "Finish Quiz"
          )}
        </button>
      </div>
    </div>
  );
}

function QuizResults({ theme, result, totalCount, onRetry, onReturnToDashboard, onNewQuiz }) {
  const score = result ? result.score : null;
  const correctCount = result ? result.correct_count : 0;
  const total = result ? result.total_count : totalCount;
  const accentText = theme === lightTheme ? "#fff" : darkTheme.pillText;

  let emoji, message;
  if (score === null) {
    emoji = "📊"; message = "Quiz complete!";
  } else if (score >= 80) {
    emoji = "🎉"; message = "Great job!";
  } else if (score >= 60) {
    emoji = "👍"; message = "Good effort!";
  } else {
    emoji = "📖"; message = "Keep practicing!";
  }

  const scoreColor = score === null ? theme.accent
    : score >= 80 ? "#16a34a"
    : score >= 60 ? "#d97706"
    : "#dc2626";

  return (
    <div
      className="flex flex-col flex-1 items-center justify-center"
      style={{ padding: "40px 32px" }}
    >
      <div
        style={{
          backgroundColor: theme.cardBg,
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: "20px",
          padding: "48px 56px",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: "52px", marginBottom: "12px" }}>{emoji}</div>
        <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: "800", color: theme.text }}>
          {message}
        </h2>

        {score !== null ? (
          <>
            <div
              style={{
                fontSize: "60px",
                fontWeight: "800",
                color: scoreColor,
                lineHeight: 1,
                margin: "20px 0 8px",
              }}
            >
              {score}%
            </div>
            <p style={{ margin: "0 0 24px", fontSize: "15px", color: theme.textMuted }}>
              {correctCount} / {total} correct
            </p>
            {/* Progress bar */}
            <div
              style={{
                height: "8px",
                borderRadius: "9999px",
                backgroundColor: theme.cardBorder,
                overflow: "hidden",
                marginBottom: "32px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${score}%`,
                  borderRadius: "9999px",
                  backgroundColor: scoreColor,
                  transition: "width 600ms ease",
                }}
              />
            </div>
          </>
        ) : (
          <p style={{ margin: "0 0 32px", fontSize: "14px", color: theme.textMuted }}>
            {correctCount} / {total} answered
          </p>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={onRetry}
            style={{
              backgroundColor: "transparent",
              color: theme.text,
              border: `1.5px solid ${theme.cardBorder}`,
              borderRadius: "8px",
              padding: "10px 22px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 150ms ease",
            }}
          >
            Try Again
          </button>
          <button
            onClick={onReturnToDashboard}
            style={{
              backgroundColor: "transparent",
              color: theme.text,
              border: `1.5px solid ${theme.cardBorder}`,
              borderRadius: "8px",
              padding: "10px 22px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 150ms ease",
            }}
          >
            Dashboard
          </button>
          <button
            onClick={onNewQuiz}
            style={{
              backgroundColor: theme.accent,
              color: accentText,
              border: "none",
              borderRadius: "8px",
              padding: "10px 22px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 150ms ease",
            }}
          >
            New Quiz
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Flashcard Components ─────────────────────────────────────────────────────

const CARD_TYPE_STYLES = {
  concept:    { bg: "#ede9fe", text: "#7c3aed", border: "#c4b5fd", label: "Concept"    },
  definition: { bg: "#dcfce7", text: "#16a34a", border: "#86efac", label: "Definition" },
  qa:         { bg: "#fff7ed", text: "#c2410c", border: "#fdba74", label: "Q & A"      },
};

function FlashcardsView({ theme, flashcardData, user, onReviewAgain, onReturnToDashboard, onNewDeck }) {
  const { cards, title } = flashcardData;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped]       = useState(false);
  const [ratings, setRatings]           = useState({});
  const [isRating, setIsRating]         = useState(false);
  const [sessionPhase, setSessionPhase] = useState("active");

  const card       = cards[currentIndex];
  const totalCards = cards.length;
  const typeStyle  = CARD_TYPE_STYLES[card.card_type] || CARD_TYPE_STYLES.concept;
  const isRated    = ratings[card.id] !== undefined;

  const handlePrev = () => {
    if (currentIndex === 0) return;
    setIsFlipped(false);
    setCurrentIndex(i => i - 1);
  };

  const handleNext = () => {
    if (currentIndex === totalCards - 1) return;
    setIsFlipped(false);
    setCurrentIndex(i => i + 1);
  };

  const handleRate = async (quality) => {
    if (isRating) return;
    setIsRating(true);
    setRatings(prev => ({ ...prev, [card.id]: quality }));

    try {
      await fetch(`${API_ENDPOINT}/study/flashcards/${card.id}/progress`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({ quality }),
      });
    } catch (err) {
      console.error("Progress update failed:", err);
    } finally {
      setIsRating(false);
    }

    if (currentIndex < totalCards - 1) {
      setIsFlipped(false);
      setCurrentIndex(i => i + 1);
    } else {
      setSessionPhase("complete");
    }
  };

  if (sessionPhase === "complete") {
    return (
      <FlashcardSessionComplete
        theme={theme}
        cards={cards}
        ratings={ratings}
        onReviewAgain={() => {
          setCurrentIndex(0);
          setIsFlipped(false);
          setRatings({});
          setSessionPhase("active");
          if (onReviewAgain) onReviewAgain();
        }}
        onReturnToDashboard={onReturnToDashboard}
        onNewDeck={onNewDeck}
      />
    );
  }

  const cardSceneStyle = {
    perspective: "1200px",
    width: "100%",
    maxWidth: "560px",
    height: "320px",
    cursor: "pointer",
    userSelect: "none",
  };

  const cardInnerStyle = {
    position: "relative",
    width: "100%",
    height: "100%",
    transformStyle: "preserve-3d",
    transition: "transform 480ms cubic-bezier(0.4, 0, 0.2, 1)",
    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
  };

  const faceBaseStyle = {
    position: "absolute",
    inset: 0,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    borderRadius: "16px",
    border: `1px solid ${theme.cardBorder}`,
    backgroundColor: theme.cardBg,
    boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    padding: "24px",
    overflow: "hidden",
  };

  const backFaceStyle = {
    ...faceBaseStyle,
    transform: "rotateY(180deg)",
    border: `1px solid ${theme.cardBorderHover}`,
    backgroundColor: theme.cardBgHover,
  };

  const arrowBtn = (disabled) => ({
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    border: `1.5px solid ${disabled ? theme.cardBorder : theme.accent}`,
    backgroundColor: "transparent",
    color: disabled ? theme.cardBorder : theme.accent,
    cursor: disabled ? "default" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "22px",
    lineHeight: 1,
    transition: "all 150ms ease",
    fontFamily: "inherit",
  });

  return (
    <div className="flex flex-col flex-1" style={{ paddingBottom: "80px" }}>
      {/* Header */}
      <div style={{ padding: "0 32px 20px", maxWidth: "760px", width: "100%", margin: "0 auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: theme.text }}>
            {title}
          </h2>
          <span style={{ fontSize: "13px", color: theme.textMuted, fontWeight: "600" }}>
            {currentIndex + 1} / {totalCards}
          </span>
        </div>
        <div style={{ height: "6px", borderRadius: "9999px", backgroundColor: theme.cardBorder, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${((currentIndex + 1) / totalCards) * 100}%`,
              borderRadius: "9999px",
              backgroundColor: theme.accent,
              transition: "width 400ms ease",
            }}
          />
        </div>
      </div>

      {/* Card + Arrows */}
      <div
        className="flex flex-1 items-center justify-center"
        style={{ padding: "0 24px", gap: "16px" }}
      >
        {/* Left arrow */}
        <button onClick={handlePrev} disabled={currentIndex === 0} style={arrowBtn(currentIndex === 0)}>
          ‹
        </button>

        {/* 3D flip card */}
        <div style={cardSceneStyle} onClick={() => setIsFlipped(f => !f)}>
          <div style={cardInnerStyle}>

            {/* Front face */}
            <div style={faceBaseStyle}>
              <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
                <span
                  style={{
                    backgroundColor: typeStyle.bg,
                    color: typeStyle.text,
                    border: `1px solid ${typeStyle.border}`,
                    borderRadius: "9999px",
                    padding: "3px 10px",
                    fontSize: "11px",
                    fontWeight: "600",
                  }}
                >
                  {typeStyle.label}
                </span>
                {isRated && (
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: ratings[card.id] >= 4 ? "#16a34a" : "#dc2626",
                      display: "inline-block",
                    }}
                  />
                )}
              </div>
              <div className="flex flex-1 items-center justify-center">
                <p
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: "600",
                    color: theme.text,
                    lineHeight: "1.6",
                    textAlign: "center",
                  }}
                >
                  {card.front}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: theme.textMuted, textAlign: "center" }}>
                Click to reveal answer
              </p>
            </div>

            {/* Back face */}
            <div style={backFaceStyle}>
              <div style={{ marginBottom: "16px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: theme.accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Answer
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center" style={{ overflowY: "auto" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: "500",
                    color: theme.text,
                    lineHeight: "1.7",
                    textAlign: "center",
                  }}
                >
                  {card.back}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: theme.textMuted, textAlign: "center" }}>
                How well did you know this?
              </p>
            </div>

          </div>
        </div>

        {/* Right arrow */}
        <button onClick={handleNext} disabled={currentIndex === totalCards - 1} style={arrowBtn(currentIndex === totalCards - 1)}>
          ›
        </button>
      </div>

      {/* Fixed bottom rating bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.bg,
          borderTop: `1px solid ${theme.cardBorder}`,
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => handleRate(1)}
          disabled={isRating}
          style={{
            backgroundColor: "#fee2e2",
            color: "#b91c1c",
            border: "1.5px solid #fca5a5",
            borderRadius: "8px",
            padding: "10px 28px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: isRating ? "not-allowed" : "pointer",
            opacity: isRating ? 0.6 : 1,
            transition: "all 150ms ease",
            fontFamily: "inherit",
          }}
        >
          Needs Work
        </button>
        <button
          onClick={() => handleRate(4)}
          disabled={isRating}
          style={{
            backgroundColor: "#dcfce7",
            color: "#15803d",
            border: "1.5px solid #86efac",
            borderRadius: "8px",
            padding: "10px 28px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: isRating ? "not-allowed" : "pointer",
            opacity: isRating ? 0.6 : 1,
            transition: "all 150ms ease",
            fontFamily: "inherit",
          }}
        >
          Already Solid
        </button>
      </div>
    </div>
  );
}

function FlashcardSessionComplete({ theme, cards, ratings, onReviewAgain, onReturnToDashboard, onNewDeck }) {
  const solidCount     = Object.values(ratings).filter(q => q >= 4).length;
  const needsWorkCount = Object.values(ratings).filter(q => q < 4).length;
  const total          = cards.length;
  const ratedCount     = Object.keys(ratings).length;
  const accentText     = theme === lightTheme ? "#fff" : darkTheme.pillText;

  const solidRatio = ratedCount > 0 ? solidCount / ratedCount : 0;
  let emoji, message;
  if (solidRatio >= 0.8)      { emoji = "🎉"; message = "Excellent recall!";  }
  else if (solidRatio >= 0.5) { emoji = "👍"; message = "Good progress!";     }
  else                        { emoji = "📖"; message = "Keep reviewing!";     }

  return (
    <div
      className="flex flex-col flex-1 items-center justify-center"
      style={{ padding: "40px 32px" }}
    >
      <div
        style={{
          backgroundColor: theme.cardBg,
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: "20px",
          padding: "48px 56px",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: "52px", marginBottom: "12px" }}>{emoji}</div>
        <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: "800", color: theme.text }}>
          {message}
        </h2>
        <p style={{ margin: "0 0 28px", fontSize: "14px", color: theme.textMuted }}>
          Session complete — {total} cards reviewed
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              backgroundColor: "#dcfce7",
              border: "1px solid #86efac",
              borderRadius: "12px",
              padding: "16px 12px",
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#15803d" }}>{solidCount}</div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#16a34a" }}>Already Solid</div>
          </div>
          <div
            style={{
              backgroundColor: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "12px",
              padding: "16px 12px",
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#b91c1c" }}>{needsWorkCount}</div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#dc2626" }}>Needs Work</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={onReviewAgain}
            style={{
              backgroundColor: "transparent",
              color: theme.text,
              border: `1.5px solid ${theme.cardBorder}`,
              borderRadius: "8px",
              padding: "10px 22px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 150ms ease",
            }}
          >
            Review Again
          </button>
          <button
            onClick={onReturnToDashboard}
            style={{
              backgroundColor: "transparent",
              color: theme.text,
              border: `1.5px solid ${theme.cardBorder}`,
              borderRadius: "8px",
              padding: "10px 22px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 150ms ease",
            }}
          >
            Dashboard
          </button>
          <button
            onClick={onNewDeck}
            style={{
              backgroundColor: theme.accent,
              color: accentText,
              border: "none",
              borderRadius: "8px",
              padding: "10px 22px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 150ms ease",
            }}
          >
            New Deck
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Components ─────────────────────────────────────────────────────

const difficultyColors = {
  easy: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  medium: { bg: "#fef9c3", text: "#a16207", border: "#fde047" },
  hard: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
};

function QuizDashboard({ theme, quizList, isLoading, error, onSelectQuiz, onNewQuiz }) {
  const [hoveredCard, setHoveredCard] = useState(null);
  const accentText = theme === lightTheme ? "#fff" : darkTheme.pillText;

  return (
    <div className="flex flex-col flex-1 px-8" style={{ paddingBottom: "48px" }}>
      <div style={{ maxWidth: "900px", width: "100%", margin: "0 auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "24px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: theme.text }}>My Quizzes</h2>
          <button
            onClick={onNewQuiz}
            style={{
              backgroundColor: theme.accent,
              color: accentText,
              border: "none",
              borderRadius: "8px",
              padding: "9px 18px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + New Quiz
          </button>
        </div>

        {isLoading && <Spinner theme={theme} />}

        {!isLoading && error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "10px", padding: "16px 20px", color: "#b91c1c", fontSize: "14px" }}>
            {error}
          </div>
        )}

        {!isLoading && !error && quizList && quizList.length === 0 && (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: "60px", color: theme.textMuted }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
            <p style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 8px", color: theme.text }}>No quizzes yet</p>
            <p style={{ fontSize: "13px", margin: 0 }}>Create your first quiz to get started!</p>
          </div>
        )}

        {!isLoading && !error && quizList && quizList.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
            {quizList.map((quiz, i) => {
              const dc = difficultyColors[quiz.difficulty] || difficultyColors.medium;
              return (
                <button
                  key={quiz.id}
                  onClick={() => onSelectQuiz(quiz)}
                  onMouseEnter={() => setHoveredCard(i)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    textAlign: "left",
                    padding: "18px",
                    backgroundColor: hoveredCard === i ? theme.cardBgHover : theme.cardBg,
                    border: `1.5px solid ${hoveredCard === i ? theme.cardBorderHover : theme.cardBorder}`,
                    borderRadius: "14px",
                    cursor: "pointer",
                    transition: "all 180ms ease",
                    transform: hoveredCard === i ? "translateY(-3px)" : "translateY(0)",
                    boxShadow: hoveredCard === i ? "0 10px 30px rgba(0,0,0,0.12)" : "0 2px 8px rgba(0,0,0,0.05)",
                    color: theme.text,
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: "700", marginBottom: "10px", lineHeight: "1.4", color: theme.text }}>{quiz.title}</span>
                  <span style={{ backgroundColor: dc.bg, color: dc.text, border: `1px solid ${dc.border}`, borderRadius: "9999px", padding: "2px 9px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize", marginBottom: "8px" }}>
                    {quiz.difficulty}
                  </span>
                  <span style={{ fontSize: "12px", color: theme.textMuted, marginBottom: "4px" }}>{quiz.questions.length} questions</span>
                  <span style={{ fontSize: "11px", color: theme.textMuted }}>
                    {new Date(quiz.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FlashcardDashboard({ theme, deckList, isLoading, error, onSelectDeck, onNewDeck }) {
  const [hoveredCard, setHoveredCard] = useState(null);
  const accentText = theme === lightTheme ? "#fff" : darkTheme.pillText;

  return (
    <div className="flex flex-col flex-1 px-8" style={{ paddingBottom: "48px" }}>
      <div style={{ maxWidth: "900px", width: "100%", margin: "0 auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "24px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: theme.text }}>My Flashcard Decks</h2>
          <button
            onClick={onNewDeck}
            style={{
              backgroundColor: theme.accent,
              color: accentText,
              border: "none",
              borderRadius: "8px",
              padding: "9px 18px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + New Deck
          </button>
        </div>

        {isLoading && <Spinner theme={theme} />}

        {!isLoading && error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "10px", padding: "16px 20px", color: "#b91c1c", fontSize: "14px" }}>
            {error}
          </div>
        )}

        {!isLoading && !error && deckList && deckList.length === 0 && (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: "60px", color: theme.textMuted }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🃏</div>
            <p style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 8px", color: theme.text }}>No decks yet</p>
            <p style={{ fontSize: "13px", margin: 0 }}>Create your first flashcard deck to get started!</p>
          </div>
        )}

        {!isLoading && !error && deckList && deckList.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
            {deckList.map((deck, i) => (
              <button
                key={deck.id}
                onClick={() => onSelectDeck(deck)}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  textAlign: "left",
                  padding: "18px",
                  backgroundColor: hoveredCard === i ? theme.cardBgHover : theme.cardBg,
                  border: `1.5px solid ${hoveredCard === i ? theme.cardBorderHover : theme.cardBorder}`,
                  borderRadius: "14px",
                  cursor: "pointer",
                  transition: "all 180ms ease",
                  transform: hoveredCard === i ? "translateY(-3px)" : "translateY(0)",
                  boxShadow: hoveredCard === i ? "0 10px 30px rgba(0,0,0,0.12)" : "0 2px 8px rgba(0,0,0,0.05)",
                  color: theme.text,
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: "700", marginBottom: "10px", lineHeight: "1.4", color: theme.text }}>{deck.title}</span>
                <span style={{ fontSize: "12px", color: theme.textMuted, marginBottom: "6px" }}>{deck.cards.length} cards</span>
                {deck.tags && deck.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                    {deck.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{ backgroundColor: theme.cardBgHover, color: theme.textMuted, borderRadius: "9999px", padding: "2px 8px", fontSize: "10px", fontWeight: "600" }}>{tag}</span>
                    ))}
                    {deck.tags.length > 3 && (
                      <span style={{ color: theme.textMuted, fontSize: "10px" }}>+{deck.tags.length - 3} more</span>
                    )}
                  </div>
                )}
                <span style={{ fontSize: "11px", color: theme.textMuted }}>
                  {new Date(deck.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuizCreateModal({ theme, form, onChange, onSubmit, onClose, isCreating, error }) {
  const accentText = theme === lightTheme ? "#fff" : darkTheme.pillText;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "16px", padding: "28px 32px", width: "360px", maxWidth: "90vw", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: theme.text }}>New Quiz</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: theme.textMuted, lineHeight: 1, padding: "2px 4px" }}>✕</button>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: theme.textMuted, marginBottom: "6px" }}>Title</label>
          <input
            value={form.title}
            onChange={e => onChange(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Week 3 Review"
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${theme.cardBorder}`, backgroundColor: theme.bg, color: theme.text, fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: theme.textMuted, marginBottom: "8px" }}>Difficulty</label>
          <div style={{ display: "flex", gap: "8px" }}>
            {["easy", "medium", "hard"].map(d => {
              const dc = difficultyColors[d];
              const isActive = form.difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => onChange(prev => ({ ...prev, difficulty: d }))}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize", transition: "all 150ms ease",
                    backgroundColor: isActive ? dc.bg : "transparent",
                    color: isActive ? dc.text : theme.textMuted,
                    border: `1.5px solid ${isActive ? dc.border : theme.cardBorder}`,
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: theme.textMuted, marginBottom: "8px" }}>
            Questions: <span style={{ color: theme.accent }}>{form.num_questions}</span>
          </label>
          <input
            type="range" min={3} max={25} value={form.num_questions}
            onChange={e => onChange(prev => ({ ...prev, num_questions: Number(e.target.value) }))}
            style={{ width: "100%", accentColor: theme.accent }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: theme.textMuted, marginTop: "4px" }}>
            <span>3</span><span>25</span>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", color: "#b91c1c", fontSize: "12px", marginBottom: "14px" }}>
            {error}
          </div>
        )}

        <button
          onClick={onSubmit}
          disabled={isCreating}
          style={{
            width: "100%", padding: "11px", borderRadius: "8px", border: "none", backgroundColor: theme.accent, color: accentText,
            fontSize: "13px", fontWeight: "600", cursor: isCreating ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: isCreating ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {isCreating ? (
            <>
              <span style={{ width: "13px", height: "13px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
              Generating…
            </>
          ) : "Generate Quiz"}
        </button>
      </div>
    </div>
  );
}

function DeckCreateModal({ theme, form, onChange, onSubmit, onClose, isCreating, error }) {
  const accentText = theme === lightTheme ? "#fff" : darkTheme.pillText;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "16px", padding: "28px 32px", width: "360px", maxWidth: "90vw", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: theme.text }}>New Flashcard Deck</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: theme.textMuted, lineHeight: 1, padding: "2px 4px" }}>✕</button>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: theme.textMuted, marginBottom: "6px" }}>Title</label>
          <input
            value={form.title}
            onChange={e => onChange(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Data Structures"
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${theme.cardBorder}`, backgroundColor: theme.bg, color: theme.text, fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: theme.textMuted, marginBottom: "6px" }}>
            Tags <span style={{ fontWeight: "400" }}>(comma-separated, optional)</span>
          </label>
          <input
            value={form.tags}
            onChange={e => onChange(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="e.g. trees, graphs, sorting"
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${theme.cardBorder}`, backgroundColor: theme.bg, color: theme.text, fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: theme.textMuted, marginBottom: "8px" }}>
            Cards: <span style={{ color: theme.accent }}>{form.num_cards}</span>
          </label>
          <input
            type="range" min={5} max={30} value={form.num_cards}
            onChange={e => onChange(prev => ({ ...prev, num_cards: Number(e.target.value) }))}
            style={{ width: "100%", accentColor: theme.accent }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: theme.textMuted, marginTop: "4px" }}>
            <span>5</span><span>30</span>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", color: "#b91c1c", fontSize: "12px", marginBottom: "14px" }}>
            {error}
          </div>
        )}

        <button
          onClick={onSubmit}
          disabled={isCreating}
          style={{
            width: "100%", padding: "11px", borderRadius: "8px", border: "none", backgroundColor: theme.accent, color: accentText,
            fontSize: "13px", fontWeight: "600", cursor: isCreating ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: isCreating ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {isCreating ? (
            <>
              <span style={{ width: "13px", height: "13px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
              Generating…
            </>
          ) : "Generate Deck"}
        </button>
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function SlidingPillNav({ theme, items, activeKey, onSelect }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const activeIndex = items.findIndex(item => item.key === activeKey);
  const pillIndex = hoveredIndex !== null ? hoveredIndex : activeIndex;
  const pct = 100 / items.length;

  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setHoveredIndex(null)}>
      {/* Sliding pill */}
      <div
        style={{
          position: "absolute",
          top: "4px",
          bottom: "4px",
          left: `calc(${pillIndex} * ${pct}% + 4px)`,
          width: `calc(${pct}% - 8px)`,
          backgroundColor: theme.pillBg,
          borderRadius: "9999px",
          transition: "left 200ms ease, opacity 150ms ease",
          opacity: pillIndex >= 0 ? 1 : 0,
          zIndex: 0,
        }}
      />
      {/* Nav buttons */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${items.length}, 1fr)`,
          padding: "4px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {items.map((item, i) => {
          const isHighlighted = pillIndex === i;
          return (
            <button
              key={item.key}
              onMouseEnter={() => setHoveredIndex(i)}
              onClick={() => onSelect(item.key)}
              style={{
                background: "none",
                border: "none",
                padding: "9px 20px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                color: isHighlighted ? theme.pillText : theme.textMuted,
                borderRadius: "9999px",
                transition: "color 150ms ease",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HomePage({ theme, onNavigate }) {
  const [hoveredCard, setHoveredCard] = useState(null);

  return (
    <div className="flex flex-col items-center flex-1 px-6" style={{ paddingBottom: "48px" }}>
      {/* Hero */}
      <section
        className="flex flex-col items-center text-center"
        style={{ paddingTop: "64px", paddingBottom: "48px", maxWidth: "560px" }}
      >
        <div style={{ fontSize: "52px", marginBottom: "20px" }}>📚</div>
        <h1
          style={{
            color: theme.accent,
            fontSize: "clamp(2rem, 5vw, 3rem)",
            fontWeight: "800",
            margin: "0 0 16px 0",
            lineHeight: "1.15",
          }}
        >
          Study Materials
        </h1>
        <p
          style={{
            color: theme.textMuted,
            fontSize: "1rem",
            margin: 0,
            lineHeight: "1.7",
          }}
        >
          practice and understand concepts from piazza course — learn faster!
        </p>
      </section>

      {/* Navigation cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          width: "100%",
          maxWidth: "640px",
          marginTop: "8px",
        }}
      >
        {SECTION_ITEMS.map((item, i) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            onMouseEnter={() => setHoveredCard(i)}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              padding: "28px 16px",
              backgroundColor: hoveredCard === i ? theme.cardBgHover : theme.cardBg,
              border: `1.5px solid ${hoveredCard === i ? theme.cardBorderHover : theme.cardBorder}`,
              borderRadius: "14px",
              cursor: "pointer",
              transition: "all 180ms ease",
              transform: hoveredCard === i ? "translateY(-3px)" : "translateY(0)",
              boxShadow:
                hoveredCard === i
                  ? "0 10px 30px rgba(0,0,0,0.12)"
                  : "0 2px 8px rgba(0,0,0,0.05)",
              color: theme.text,
            }}
          >
            <span style={{ fontSize: "30px", marginBottom: "12px" }}>{item.icon}</span>
            <span style={{ fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>
              {item.label}
            </span>
            <span style={{ fontSize: "11px", color: theme.textMuted, lineHeight: "1.5" }}>
              {item.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionView({ theme, view, isLoading, result, error }) {
  return (
    <div className="flex flex-col flex-1 px-6" style={{ paddingBottom: "48px" }}>
      {/* Content area */}
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ maxWidth: "720px", width: "100%", margin: "0 auto" }}
      >
        {isLoading && <Spinner theme={theme} />}

        {!isLoading && error && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              padding: "16px 20px",
              color: "#b91c1c",
              fontSize: "14px",
              width: "100%",
            }}
          >
            {error}
          </div>
        )}

        {!isLoading && result && (
          <div
            style={{
              backgroundColor: theme.cardBg,
              borderRadius: "14px",
              border: `1px solid ${theme.cardBorder}`,
              overflow: "hidden",
              width: "100%",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: `1px solid ${theme.cardBorder}`,
              }}
            >
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: theme.text }}>
                {SECTION_ITEMS.find(n => n.key === view)?.label}
              </h3>
            </div>
            <pre
              style={{
                padding: "16px 20px",
                fontSize: "12px",
                color: theme.textMuted,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner({ theme }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="animate-spin"
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          border: `5px solid ${theme.spinnerTrack}`,
          borderTopColor: theme.spinnerFill,
        }}
      />
      <p style={{ color: theme.textMuted, fontSize: "14px", margin: 0 }}>
        Generating content…
      </p>
    </div>
  );
}
