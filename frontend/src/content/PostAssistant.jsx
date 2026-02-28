import React, { useState, useEffect } from "react";
import { SimplifyIcon, SummarizeIcon, SolveIcon, TranslateIcon, ConceptIcon, ActionButton, ResultDisplay, LoadingSpinner, ProficiencySelector } from "./PostAssistantUI.jsx";

const API_BASE_URL = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";

export default function PostAssistant({ threadId, postNum, content }) {
  const [activeAction, setActiveAction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [proficiency, setProficiency] = useState(0); // 0: Beginner, 1: Advanced

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(["user", "authToken"], (data) => {
        if (data.user && data.authToken) {
          setUser({ ...data.user, access_token: data.authToken });
        }
      });
    }
  }, []);

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
      // Construct endpoint based on action
      let endpoint = `${API_BASE_URL}`;
      
      switch (action) {
        case 'simplify':
          endpoint += `/simplify/${proficiency}`;
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
        case 'link_concepts':
          endpoint += '/link_concepts';
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
          post_num: postNum,
          thread_id: threadId,
          session_id: null, // Optional for one-off tasks
          content: content  // Send content just in case backend needs it
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
            onClick={() => handleAction('summarize')} 
            isActive={activeAction === 'summarize'}
        />
        <ActionButton 
            icon={<SolveIcon />} 
            label="Solve" 
            onClick={() => handleAction('solve')} 
            isActive={activeAction === 'solve'}
        />
        <ActionButton 
            icon={<TranslateIcon />} 
            label="Translate" 
            onClick={() => handleAction('translate')} 
            isActive={activeAction === 'translate'}
        />
        <ActionButton 
            icon={<ConceptIcon />} 
            label="Concepts" 
            onClick={() => handleAction('link_concepts')} 
            isActive={activeAction === 'link_concepts'}
        />
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