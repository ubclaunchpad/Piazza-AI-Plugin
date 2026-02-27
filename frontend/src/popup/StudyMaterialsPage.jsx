import { useEffect, useState } from "react";

/* global chrome */
const API_ENDPOINT = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";

export default function StudyMaterialsPage({ user, onBack, onLogout }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null); // { quiz, flashcards, summary }

  useEffect(() => {
    generateAll();
  }, []);

  const generateAll = async () => {
    setIsLoading(true);
    setError(null);

    // Detect Piazza class ID from active tab
    let piazza_course_id;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.includes("piazza.com")) {
        const url = new URL(tab.url);
        const pathParts = url.pathname.split("/").filter(Boolean);
        piazza_course_id = pathParts[1];
      }
    } catch (err) {
      console.error("Error reading tab info:", err);
    }

    if (!piazza_course_id) {
      setError("No Piazza course detected. Navigate to a Piazza class page first.");
      setIsLoading(false);
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${user.access_token}`,
    };

    try {
      const [quizRes, flashcardsRes, summaryRes] = await Promise.all([
        fetch(`${API_ENDPOINT}/study/quiz/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            piazza_course_id,
            title: "Auto Quiz",
            difficulty: "medium",
            num_questions: 5,
          }),
        }),
        fetch(`${API_ENDPOINT}/study/flashcards/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            piazza_course_id,
            title: "Auto Flashcards",
          }),
        }),
        fetch(`${API_ENDPOINT}/study/summary/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            piazza_course_id,
            title: "Auto Summary",
            summary_type: "weekly",
          }),
        }),
      ]);

      // Handle 401 on any call
      if (
        quizRes.status === 401 ||
        flashcardsRes.status === 401 ||
        summaryRes.status === 401
      ) {
        onLogout();
        return;
      }

      const [quiz, flashcards, summary] = await Promise.all([
        quizRes.json(),
        flashcardsRes.json(),
        summaryRes.json(),
      ]);

      setResults({ quiz, flashcards, summary });
    } catch (err) {
      setError(`Failed to generate study materials: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[500px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-700 p-5 flex items-center gap-3 text-white">
        <button
          onClick={onBack}
          className="bg-white/20 border-none text-white w-8 h-8 rounded-md cursor-pointer text-base flex items-center justify-center transition-colors hover:bg-white/30"
          title="Back"
        >
          ←
        </button>
        <div className="flex-1">
          <h2 className="text-base font-semibold m-0">Study Materials</h2>
          <p className="text-xs m-0 mt-0.5 opacity-90">{user.name}</p>
        </div>
        <button
          onClick={onLogout}
          className="bg-white/20 border-none text-white px-3 py-1.5 rounded-md cursor-pointer text-xs transition-colors hover:bg-white/30"
        >
          Logout
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16">
            <div className="w-10 h-10 border-3 border-gray-200 border-t-purple-500 rounded-full animate-spin"></div>
            <p className="text-gray-600 text-sm">Generating study materials…</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {results && !isLoading && (
          <>
            <Section title="Quiz" data={results.quiz} />
            <Section title="Flashcards" data={results.flashcards} />
            <Section title="Summary" data={results.summary} />
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, data }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800 m-0">{title}</h3>
      </div>
      <pre className="p-4 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words m-0">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
