import React, { useState, useEffect } from "react";
import {
  SimplifyIcon,
  SummarizeIcon,
  SolveIcon,
  TranslateIcon,
  ActionButton,
  ResultDisplay,
  LoadingSpinner,
  ProficiencySelector,
} from "./PostAssistantUI.jsx";

const API_BASE_URL = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
const TOOLBAR_SESSION_EVENT = "piazza-ai-open-session";

export default function PostAssistant({ threadId, postNum, content }) {
  const [activeAction, setActiveAction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [translateLanguage, setTranslateLanguage] = useState('English');
  // Initialize from sessionStorage to persist user preference across reloads
  const [proficiency, setProficiency] = useState(() => {
    const saved = sessionStorage.getItem("piazza-ai-proficiency");
    return saved ? Number(saved) : 1;
  });

  // Save to sessionStorage whenever proficiency changes
  useEffect(() => {
    sessionStorage.setItem("piazza-ai-proficiency", proficiency);
  }, [proficiency]);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(["user", "authToken"], (data) => {
        if (data.user && data.authToken) {
          setUser({ ...data.user, access_token: data.authToken });
        }
      });
    }
  }, []);

  const createToolbarSession = async () => {
    const response = await fetch(`${API_BASE_URL}/chat-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: user ? `Bearer ${user.access_token}` : "",
      },
      body: JSON.stringify({
        piazza_course_id: threadId,
        title: "New Chat",
      }),
    });

    if (response.status === 401) {
      throw new Error("Authentication failed. Please log in via the extension.");
    }

    if (!response.ok) {
      throw new Error("Failed to create chat session.");
    }

    return response.json();
  };

  const openChatSession = (sessionId, title) => {
    window.dispatchEvent(
      new CustomEvent(TOOLBAR_SESSION_EVENT, {
        detail: {
          sessionId,
          title,
          source: "post-assistant",
        },
      })
    );
  };

  const mapSimplifyProficiency = (value) => {
    // Keep the UI at 3 tiers and map directly to backend path param.
    if (value <= 1) return 1;
    if (value >= 3) return 3;
    return 2;
  };

  const handleAction = async (action) => {
    // Toggle off if clicking the active button (allow closing even if error occurred)
    if (activeAction === action) {
      if (!isLoading) setActiveAction(null);
      return;
    }

    setActiveAction(action);
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      if (!user?.access_token) {
        throw new Error("Please log in via the extension.");
      }

      if (!threadId || !postNum || !content?.trim()) {
        throw new Error("Could not resolve current post context.");
      }

      const newSession = await createToolbarSession();
      const sessionId = newSession.id;

      // Construct endpoint based on action
      let endpoint = `${API_BASE_URL}/per-post`;
      const simplifyLevel = mapSimplifyProficiency(proficiency);
      
      switch (action) {
        case 'simplify':
          endpoint += `/simplify/${simplifyLevel}`;
          break;
        case 'summarize':
          endpoint += '/summarize';
          break;
        case 'solve':
          endpoint += '/solve';
          break;
        case 'translate':
          endpoint += '/translate';
          break;
        default:
          endpoint += `/${action}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": user ? `Bearer ${user.access_token}` : ""
        },
        body: JSON.stringify({
          post_num: Number(postNum),
          thread_id: threadId,
          session_id: sessionId,
          ...(action === 'translate' && { language: translateLanguage }),
        })
      });

      if (response.status === 401) {
        throw new Error("Authentication failed. Please log in via the extension.");
      }
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      // Handle Streaming Response (NDJSON)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === "content" && data.content) {
              accumulatedText += data.content;
              setResult(accumulatedText);
            }
          } catch (e) {
            console.warn("Error parsing JSON chunk:", e);
          }
        }
      }

      openChatSession(sessionId, newSession.title);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-sans my-6 w-full">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl">
        {/* Header / Toolbar */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">AI</div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assistant</span>
          </div>
          <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>
          <div className="flex gap-2 flex-wrap">
        <ActionButton 
            icon={<SimplifyIcon />} 
            label="Simplify"
            title="Make the post easier to understand" 
            onClick={() => handleAction('simplify')} 
            isActive={activeAction === 'simplify'}
        />
        {/* Show proficiency selector only when Simplify is active */}
        {activeAction === 'simplify' && (
            <ProficiencySelector value={proficiency} onChange={setProficiency} />
        )}
        <ActionButton 
            icon={<SummarizeIcon />} 
            label="Summarize"
            title="Provide a short summary of the post" 
            onClick={() => handleAction('summarize')} 
            isActive={activeAction === 'summarize'}
        />
        <ActionButton 
            icon={<SolveIcon />} 
            label="Solve"
            title="Help solve the problem in the post" 
            onClick={() => handleAction('solve')} 
            isActive={activeAction === 'solve'}
        />
        <ActionButton 
            icon={<TranslateIcon />} 
            label="Translate"
            title="Translate the post into another language" 
            onClick={() => handleAction('translate')} 
            isActive={activeAction === 'translate'}
        />
        {activeAction === 'translate' && (
            <select 
                value={translateLanguage} 
                onChange={e => setTranslateLanguage(e.target.value)}
                className="text-xs font-medium text-gray-600 bg-gray-100 border border-black rounded-md px-2 py-1.5 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="English">English</option>
                <option value="Chinese">Chinese</option>
                <option value="Korean">Korean</option>
                <option value="French">French</option>
                <option value="Russian">Russian</option>
                <option value="Spanish">Spanish</option>
            </select>
        )}
      </div>
        </div>

      {(isLoading || result || error) && (
        <div className="p-5 bg-white animate-fadeIn">
            {isLoading && (
                <LoadingSpinner />
            )}
            
            {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                    {error}
                </div>
            )}

            {result && (
                <ResultDisplay result={result} />
            )}
        </div>
      )}
      </div>
    </div>
  );
}
