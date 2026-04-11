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
  LanguageSelector,
} from "./PostAssistantUI.jsx";

const API_BASE_URL = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
const TOOLBAR_SESSION_EVENT = "piazza-ai-open-session";
const PROFICIENCY_STORAGE_KEY = "piazza-ai-proficiency";
const TRANSLATE_LANGUAGE_STORAGE_KEY = "piazza-ai-translate-language";
const ONE_OFF_STORAGE_PREFIX = "piazza-ai-one-off";

function getOneOffStorageKey(userId, threadId, postNum, action) {
  return `${ONE_OFF_STORAGE_PREFIX}:${userId}:${threadId}:${postNum}:${action}`;
}

export default function PostAssistant({ threadId, postNum, content }) {
  const [activeAction, setActiveAction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [resultAction, setResultAction] = useState(null);
  const [resultSessionId, setResultSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [translateLanguage, setTranslateLanguage] = useState(() => {
    return sessionStorage.getItem(TRANSLATE_LANGUAGE_STORAGE_KEY) || "English";
  });
  const [usedActions, setUsedActions] = useState({});
  const [proficiency, setProficiency] = useState(() => {
    const saved = sessionStorage.getItem(PROFICIENCY_STORAGE_KEY);
    return saved ? Number(saved) : 1;
  });

  useEffect(() => {
    sessionStorage.setItem(PROFICIENCY_STORAGE_KEY, proficiency);
  }, [proficiency]);

  useEffect(() => {
    sessionStorage.setItem(TRANSLATE_LANGUAGE_STORAGE_KEY, translateLanguage);
  }, [translateLanguage]);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(["user", "authToken"], (data) => {
        if (data.user && data.authToken) {
          setUser({ ...data.user, access_token: data.authToken });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!user?.id || !threadId || !postNum) {
      setUsedActions({});
      return;
    }

    try {
      setUsedActions({
        simplify:
          localStorage.getItem(
            getOneOffStorageKey(user.id, threadId, postNum, "simplify")
          ) === "used",
        summarize:
          localStorage.getItem(
            getOneOffStorageKey(user.id, threadId, postNum, "summarize")
          ) === "used",
        solve:
          localStorage.getItem(
            getOneOffStorageKey(user.id, threadId, postNum, "solve")
          ) === "used",
        translate:
          localStorage.getItem(
            getOneOffStorageKey(user.id, threadId, postNum, "translate")
          ) === "used",
      });
    } catch (storageError) {
      console.warn("Unable to load one-off usage state.", storageError);
      setUsedActions({});
    }
  }, [user?.id, threadId, postNum]);

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

  const openChatSession = (sessionId) => {
    window.dispatchEvent(
      new CustomEvent(TOOLBAR_SESSION_EVENT, {
        detail: {
          sessionId,
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

  const markActionUsed = (action) => {
    if (!user?.id || !threadId || !postNum) {
      return;
    }

    try {
      localStorage.setItem(
        getOneOffStorageKey(user.id, threadId, postNum, action),
        "used"
      );
    } catch (storageError) {
      console.warn("Unable to persist one-off usage state.", storageError);
    }

    setUsedActions((prev) => ({
      ...prev,
      [action]: true,
    }));
  };

  const isActionUsed = (action) => Boolean(usedActions[action]);

  const handleAction = async (action) => {
    if (isLoading) {
      return;
    }

    if (isActionUsed(action)) {
      setError("This one-off response has already been generated for this post.");
      return;
    }

    setActiveAction(action);
    setIsLoading(true);
    setResult(null);
    setResultAction(null);
    setResultSessionId(null);
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

      let endpoint = `${API_BASE_URL}/per-post`;
      const simplifyLevel = mapSimplifyProficiency(proficiency);

      switch (action) {
        case "simplify":
          endpoint += `/simplify/${simplifyLevel}`;
          break;
        case "summarize":
          endpoint += "/summarize";
          break;
        case "solve":
          endpoint += "/solve";
          break;
        case "translate":
          endpoint += "/translate";
          break;
        default:
          endpoint += `/${action}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: user ? `Bearer ${user.access_token}` : "",
        },
        body: JSON.stringify({
          post_num: Number(postNum),
          thread_id: threadId,
          session_id: sessionId,
          ...(action === "translate" && { language: translateLanguage }),
        }),
      });

      if (response.status === 401) {
        throw new Error("Authentication failed. Please log in via the extension.");
      }
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error("The assistant response stream was unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let sawSources = false;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          try {
            const data = JSON.parse(line);
            if (data.type === "content" && data.content) {
              accumulatedText += data.content;
              setResult(accumulatedText);
            } else if (data.type === "sources") {
              sawSources = true;
            }
          } catch (e) {
            console.warn("Error parsing JSON chunk:", e);
          }
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        const data = JSON.parse(buffer);
        if (data.type === "content" && data.content) {
          accumulatedText += data.content;
          setResult(accumulatedText);
        } else if (data.type === "sources") {
          sawSources = true;
        }
      }

      if (!accumulatedText.trim()) {
        throw new Error("The assistant returned an empty response.");
      }
      if (!sawSources) {
        throw new Error("The response did not finish successfully. Please try again.");
      }

      setResultAction(action);
      setResultSessionId(sessionId);
      markActionUsed(action);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUp = () => {
    if (!resultSessionId) {
      return;
    }

    openChatSession(resultSessionId);
  };

  return (
    <div className="font-sans my-6 w-full">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl">
        {/* Header / Toolbar */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">AI</div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assistant</span>
            </div>
            <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>
            <div className="flex gap-2 flex-wrap">
              <ActionButton
                icon={<SimplifyIcon />}
                label="Simplify"
                title={
                  isActionUsed("simplify")
                    ? "Simplify has already been used for this post."
                    : "Make the post easier to understand"
                }
                onClick={() => handleAction("simplify")}
                isActive={activeAction === "simplify"}
                disabled={isActionUsed("simplify")}
              />
              <ActionButton
                icon={<SummarizeIcon />}
                label="Summarize"
                title={
                  isActionUsed("summarize")
                    ? "Summarize has already been used for this post."
                    : "Provide a short summary of the post"
                }
                onClick={() => handleAction("summarize")}
                isActive={activeAction === "summarize"}
                disabled={isActionUsed("summarize")}
              />
              <ActionButton
                icon={<SolveIcon />}
                label="Solve"
                title={
                  isActionUsed("solve")
                    ? "Solve has already been used for this post."
                    : "Help solve the problem in the post"
                }
                onClick={() => handleAction("solve")}
                isActive={activeAction === "solve"}
                disabled={isActionUsed("solve")}
              />
              <ActionButton
                icon={<TranslateIcon />}
                label="Translate"
                title={
                  isActionUsed("translate")
                    ? "Translate has already been used for this post."
                    : "Translate the post into another language"
                }
                onClick={() => handleAction("translate")}
                isActive={activeAction === "translate"}
                disabled={isActionUsed("translate")}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ProficiencySelector
              value={proficiency}
              onChange={setProficiency}
              disabled={isLoading}
            />
            <LanguageSelector
              value={translateLanguage}
              onChange={setTranslateLanguage}
              disabled={isLoading}
            />
            <span className="text-xs text-gray-500">
              Each one-off response can be generated once per feature for this post.
            </span>
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
                <div className="space-y-4">
                    <ResultDisplay result={result} />
                    {resultSessionId && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                            <div>
                                <p className="text-sm font-medium text-blue-900">
                                    Continue in chat
                                </p>
                                <p className="text-xs text-blue-700">
                                    {resultAction
                                      ? `Open chat to ask follow-up questions about this ${resultAction} response.`
                                      : "Open chat to continue the conversation."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleFollowUp}
                                className="rounded-full bg-gradient-to-br from-blue-500 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform duration-200 hover:scale-[1.02]"
                            >
                                Follow up
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
      </div>
    </div>
  );
}
