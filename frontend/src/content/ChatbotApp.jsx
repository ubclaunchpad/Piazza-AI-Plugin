import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { searchContent, searchSimilar } from "../api/searchApi";

const FORMULA_TOKEN_PATTERN =
  /\\[a-zA-Z]+|[A-Za-z]+(?:_[A-Za-z0-9]+)?|[0-9]+(?:\.[0-9]+)?|[+\-*/=^_(){}\[\]]/g;

function normalizeFormulaText(text) {
  return (text || "")
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\cdot/g, "*")
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\geq/g, ">=")
    .replace(/\\leq/g, "<=")
    .replace(/\\neq/g, "!=")
    .replace(/\\approx/g, "~")
    .replace(/\\,/g, "")
    .replace(/\\!/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function extractFormulaTokens(text) {
  return normalizeFormulaText(text).match(FORMULA_TOKEN_PATTERN) || [];
}

function SourcesDropdown({ sources, threadId }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-1 ml-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-purple-600 hover:text-purple-800 bg-transparent border-none cursor-pointer flex items-center gap-1 p-0 font-medium transition-colors"
      >
        {isOpen ? "▼" : "▶"} Sources ({sources.length})
      </button>

      {isOpen && (
        <div className="mt-1 ml-2 flex flex-col gap-1 animate-fadeIn">
          {sources.map((source, idx) => (
            <a
              key={idx}
              href={`https://piazza.com/class/${threadId}/post/${source}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-purple-600 hover:underline transition-colors block"
            >
              Post {source}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ result, currentCourseId, onFindSimilar }) {
  const metadata = result.metadata || {};
  const courseId = metadata.piazza_course_id || currentCourseId;
  const postId = result.external_id || metadata.post_number || metadata.post_id;
  const canOpenPost = !!courseId && !!postId;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800 m-0 truncate">
          {result.title || "Untitled Result"}
        </p>
        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
          {(result.score || 0).toFixed(2)}
        </span>
      </div>
      <p className="text-xs text-gray-600 mt-2 mb-2 line-clamp-3">
        {result.excerpt}
      </p>
      <div className="flex items-center gap-2">
        {canOpenPost && (
          <a
            href={`https://piazza.com/class/${courseId}/post/${postId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline"
          >
            Open Post
          </a>
        )}
        {currentCourseId && postId && (
          <button
            onClick={() => onFindSimilar(postId)}
            className="text-[11px] text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded px-2 py-1"
          >
            Find similar
          </button>
        )}
      </div>
    </div>
  );
}

function FormulaPreview({ query }) {
  const normalized = normalizeFormulaText(query);
  const tokens = extractFormulaTokens(query);

  if (!normalized) return null;

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="m-0 text-[11px] font-semibold text-amber-800">
        Parsed Formula
      </p>
      <p className="mt-1 mb-2 break-all font-mono text-[11px] text-amber-900">
        {normalized}
      </p>
      <div className="flex flex-wrap gap-1">
        {tokens.slice(0, 16).map((token, idx) => (
          <span
            key={`${token}-${idx}`}
            className="rounded-full bg-white px-2 py-0.5 text-[10px] text-amber-800 border border-amber-200"
          >
            {token}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChatbotApp() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [sessionId, setSessionId] = useState(null);
  const [sessionTitle, setSessionTitle] = useState(null);
  const [user, setUser] = useState(null);
  const [launcherPosition, setLauncherPosition] = useState({
    top: 60,
    left: 260,
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("semantic");
  const [searchScopeCourseOnly, setSearchScopeCourseOnly] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [contextPostId, setContextPostId] = useState(null);
  const [contextCourseId, setContextCourseId] = useState(null);
  const [contextCourseName, setContextCourseName] = useState(null);

  const loadStoredAuth = () => {
    chrome.storage.local.get(["user", "authToken", "tokenExpiry"], (result) => {
      if (result.user && result.authToken) {
        if (result.tokenExpiry && Date.now() > result.tokenExpiry) {
          setUser(null);
          return;
        }
        setUser({ ...result.user, access_token: result.authToken });
      } else {
        setUser(null);
      }
    });
  };

  const getAccessToken = async () => {
    if (user?.access_token) {
      return user.access_token;
    }

    const result = await chrome.storage.local.get(["authToken", "tokenExpiry"]);
    if (
      result.authToken &&
      (!result.tokenExpiry || Date.now() <= result.tokenExpiry)
    ) {
      return result.authToken;
    }

    return null;
  };

  // Fetch user info on mount
  useEffect(() => {
    /* global chrome */
    loadStoredAuth();

    // Listen for messages from popup
    const messageListener = (request, sender, sendResponse) => {
      if (request.type === "OPEN_CHAT_SESSION") {
        setSessionId(request.sessionId);
        if (request.title) {
          setSessionTitle(request.title);
        }
        setIsExpanded(true);
      }
    };

    const storageListener = (changes, areaName) => {
      if (areaName !== "local") return;
      if (changes.user || changes.authToken || changes.tokenExpiry) {
        loadStoredAuth();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    chrome.storage.onChanged.addListener(storageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  // Fetch most recent session or messages when needed
  useEffect(() => {
    if (isExpanded && user && !sessionId) {
      fetchMostRecentSession();
    } else if (isExpanded && user && sessionId) {
      fetchMessages(sessionId);
    }
  }, [isExpanded, user, sessionId]);

  // Position search launcher over the right edge of Piazza's native search bar.
  useEffect(() => {
    const updateLauncherPosition = () => {
      const anchor =
        document.querySelector('input[placeholder*="Search posts"]') ||
        document.querySelector('input[placeholder*="Search Posts"]') ||
        document.querySelector('input[aria-label*="Search posts"]') ||
        document.querySelector('input[type="search"]');

      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      setLauncherPosition({
        top: Math.max(8, Math.round(rect.top + rect.height / 2 - 17)),
        left: Math.round(rect.right - 35),
      });
    };

    updateLauncherPosition();
    window.addEventListener("resize", updateLauncherPosition);
    window.addEventListener("scroll", updateLauncherPosition, true);

    const observer = new MutationObserver(updateLauncherPosition);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", updateLauncherPosition);
      window.removeEventListener("scroll", updateLauncherPosition, true);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const syncContextFromUrl = () => {
      try {
        const classMatch = window.location.pathname.match(/\/class\/([^/?]+)/);
        const url = new URL(window.location.href);
        const courseNameElement = document.querySelector(
          "#topbar_current_class_number"
        );
        setContextCourseId(classMatch ? classMatch[1] : null);
        setContextPostId(url.searchParams.get("cid"));
        setContextCourseName(
          courseNameElement?.textContent?.trim() || null
        );
      } catch (_) {
        setContextCourseId(null);
        setContextPostId(null);
        setContextCourseName(null);
      }
    };

    syncContextFromUrl();
    window.addEventListener("popstate", syncContextFromUrl);
    return () => window.removeEventListener("popstate", syncContextFromUrl);
  }, []);

  useEffect(() => {
    const handleFindSimilar = (event) => {
      const postId = event.detail?.postId;
      if (postId) {
        runSimilarSearch(postId);
      }
    };

    window.addEventListener("threadsense-find-similar", handleFindSimilar);
    return () =>
      window.removeEventListener("threadsense-find-similar", handleFindSimilar);
  }, [contextCourseId, user, searchType, searchScopeCourseOnly]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const convertLatexToMarkdown = (text) => {
    // Replace display math: \[ ... \] -> $$...$$
    let converted = text.replace(
      /\\\[\s*([^\]]+?)\s*\\\]/g,
      (match, content) => {
        return `\n$$\n${content.trim()}\n$$\n`;
      },
    );

    // Replace inline math: \( ... \) -> $...$
    converted = converted.replace(
      /\\\(\s*([^)]+?)\s*\\\)/g,
      (match, content) => {
        return `$${content.trim()}$`;
      },
    );

    return converted;
  };
  const handleAuthError = () => {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "Authentication failed. Please open the extension icon to log in again.",
      },
    ]);
    // Optionally clear user state
    // setUser(null);
  };

  const runSearch = async ({
    queryText,
    mode = searchType,
    forceCourseId = undefined,
  }) => {
    const token = await getAccessToken();
    if (!token) {
      setSearchError("Please log in from the extension popup first.");
      return;
    }

    const query = (queryText || searchQuery).trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError("");

    try {
      const response = await searchContent({
        token,
        query,
        searchType: mode,
        piazzaCourseId:
          forceCourseId !== undefined
            ? forceCourseId
            : searchScopeCourseOnly
              ? contextCourseId
              : null,
      });
      setSearchResults(response.results || []);
    } catch (error) {
      setSearchError(error.message || "Search failed");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const runSimilarSearch = async (piazzaPostId) => {
    const token = await getAccessToken();
    if (!token) {
      setSearchError("Please log in from the extension popup first.");
      return;
    }
    if (!contextCourseId || !piazzaPostId) {
      setSearchError("Open a Piazza class post first to run similar search.");
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setSearchType("semantic");
    setIsSearchOpen(true);

    try {
      const response = await searchSimilar({
        token,
        piazzaCourseId: contextCourseId,
        piazzaPostId: String(piazzaPostId),
      });
      setSearchResults(response.results || []);
      setSearchQuery(response.query || "");
    } catch (error) {
      setSearchError(error.message || "Similar search failed");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchMostRecentSession = async () => {
    try {
      const threadIdMatch = window.location.pathname.match(/\/class\/([^/?]+)/);
      const threadId = threadIdMatch ? threadIdMatch[1] : null;
      if (!threadId) return;

      const API_ENDPOINT =
        process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
      const response = await fetch(
        `${API_ENDPOINT}/chat-sessions?piazza_course_id=${threadId}`,
        {
          headers: { Authorization: `Bearer ${user.access_token}` },
        },
      );

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (response.ok) {
        const sessions = await response.json();
        if (sessions.length > 0) {
          setSessionId(sessions[0].id);
          setSessionTitle(sessions[0].title);
        } else {
          // Create a new session automatically if none exist?
          // Or just let the first message create it?
          // For now, let's create one.
          createNewSession(threadId);
        }
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  };

  const createNewSession = async (courseId) => {
    try {
      const API_ENDPOINT =
        process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_ENDPOINT}/chat-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({
          piazza_course_id: courseId,
          title: "New Chat",
        }),
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (response.ok) {
        const newChat = await response.json();
        setSessionId(newChat.id);
        setSessionTitle(newChat.title);
        return newChat;
      }
    } catch (error) {
      console.error("Error creating session:", error);
    }

    return null;
  };

  const fetchMessages = async (sid) => {
    setIsLoading(true);
    try {
      const API_ENDPOINT =
        process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
      const response = await fetch(
        `${API_ENDPOINT}/chat-sessions/${sid}/messages`,
        {
          headers: { Authorization: `Bearer ${user.access_token}` },
        },
      );

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        // Transform messages to UI format
        const formattedMessages = data.map((msg) => {
          const content = msg.message.data
            ? msg.message.data.content
            : msg.message.content;
          const type = msg.message.type;

          // Extract sources from metadata
          let sources = [];
          if (type === "ai") {
            const metadata = msg.message.data
              ? msg.message.data.response_metadata
              : msg.message.response_metadata;
            if (metadata && metadata.sources) {
              sources = metadata.sources;
            }
          }

          // Get current threadId from URL for links
          const threadIdMatch =
            window.location.pathname.match(/\/class\/([^/?]+)/);
          const currentThreadId = threadIdMatch ? threadIdMatch[1] : null;

          return {
            role: type === "human" ? "user" : "assistant",
            content: content,
            sources: sources,
            threadId: currentThreadId,
          };
        });
        setMessages(formattedMessages);
        // Scroll to bottom after loading messages
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Extract thread_id (network_id) from URL
      const threadIdMatch = window.location.pathname.match(/\/class\/([^/?]+)/);
      const threadId = threadIdMatch ? threadIdMatch[1] : null;

      if (!threadId) {
        throw new Error("Could not determine course ID from URL");
      }

      // Ensure we have a session
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        // Create a new session and use the returned ID immediately.
        const newSession = await createNewSession(threadId);
        currentSessionId = newSession?.id ?? null;
      }

      if (!currentSessionId) {
        throw new Error("Could not create a chat session");
      }

      // Call the backend API
      const API_ENDPOINT =
        process.env.API_ENDPOINT || "http://localhost:8000/api/v1";

      const response = await fetch(`${API_ENDPOINT}/llm/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.access_token}`,
        },
        body: JSON.stringify({
          query: userMessage,
          thread_id: threadId,
          session_id: currentSessionId,
        }),
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Initialize empty AI message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          sources: [],
          threadId: threadId,
        },
      ]);

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponseContent = "";
      let aiSources = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === "content") {
              aiResponseContent += data.content;

              // Update the last message with new content
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.role === "assistant") {
                  lastMsg.content = convertLatexToMarkdown(aiResponseContent);
                }
                return newMessages;
              });

              // Scroll to bottom periodically or on every chunk
              scrollToBottom();
            } else if (data.type === "sources") {
              aiSources = data.sources;

              // Update sources
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.role === "assistant") {
                  lastMsg.sources = aiSources;
                }
                return newMessages;
              });
            }
          } catch (e) {
            console.error("Error parsing JSON chunk", e);
          }
        }
      }
    } catch (error) {
      console.error("Failed to get AI response:", error);

      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={chatRef} className="fixed bottom-5 left-5 z-[999999] font-sans">
      <div
        className="fixed z-[999999]"
        style={{
          top: `${launcherPosition.top}px`,
          left: `${launcherPosition.left}px`,
        }}
      >
        {!isSearchOpen ? (
          <div className="relative group">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full border-2 border-white text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
              aria-label="Advanced Search"
            >
              🔎
            </button>
            <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
              Advanced Search
            </div>
          </div>
        ) : (
          <div className="w-[400px] max-h-[70vh] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden animate-slideUp flex flex-col mt-11 -ml-[330px]">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <p className="m-0 text-sm font-semibold">Advanced Search</p>
                <p className="m-0 text-[11px] opacity-80">
                  {searchScopeCourseOnly && contextCourseId
                    ? `Course: ${contextCourseName || contextCourseId}`
                    : "Cross-course"}
                </p>
              </div>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="bg-white/20 border-none text-white w-7 h-7 rounded-full cursor-pointer text-base flex items-center justify-center hover:bg-white/30"
              >
                &times;
              </button>
            </div>

            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search posts by meaning..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => runSearch({})}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-blue-600 text-white border-none rounded-lg px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Search
                </button>
              </div>
              {searchType === "formula" && (
                <FormulaPreview query={searchQuery} />
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white"
                >
                  <option value="semantic">Semantic</option>
                  <option value="code">Code</option>
                  <option value="formula">Formula</option>
                </select>
                <label className="text-xs text-gray-600 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={searchScopeCourseOnly}
                    onChange={(e) => setSearchScopeCourseOnly(e.target.checked)}
                  />
                  This course only
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 bg-gray-50 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {isSearching && (
                <p className="text-sm text-gray-500 m-0">Searching...</p>
              )}
              {!isSearching && searchError && (
                <p className="text-sm text-red-600 m-0">{searchError}</p>
              )}
              {!isSearching && !searchError && searchResults.length === 0 && (
                <p className="text-sm text-gray-500 m-0">
                  Start searching to see results.
                </p>
              )}
              {!isSearching &&
                !searchError &&
                searchResults.map((result, idx) => (
                  <SearchResultCard
                    key={`${result.chunk_id}-${idx}`}
                    result={result}
                    currentCourseId={contextCourseId}
                    onFindSimilar={runSimilarSearch}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
      {!isExpanded ? (
        <button
          className={`bg-black border-none rounded-full cursor-pointer p-0 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 overflow-hidden ${
            isHovered ? "pr-3" : ""
          }`}
          onClick={handleToggle}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex items-center p-3 gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex-shrink-0"></div>
            {isHovered && (
              <span className="text-white font-semibold text-sm whitespace-nowrap transition-all duration-300">
                Ask AI!
              </span>
            )}
          </div>
        </button>
      ) : (
        <div
          className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideUp"
          style={{ width: "50vw", height: "70vh" }}
        >
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-5 py-4 flex justify-between items-center">
            <div className="flex flex-col">
              <h3 className="m-0 text-base font-semibold">AI Assistant</h3>
              {sessionTitle && sessionTitle !== "New Chat" && (
                <span className="text-xs opacity-80 font-medium truncate max-w-[200px]">
                  {sessionTitle}
                </span>
              )}
            </div>
            <button
              className="bg-white/20 border-none text-white w-7 h-7 rounded-full cursor-pointer text-base flex items-center justify-center transition-colors hover:bg-white/30"
              onClick={() => setIsExpanded(false)}
            >
              &times;
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 bg-gray-50 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                <p>Hi! How can I help you today?</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex mb-2 flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-br-sm"
                        : "bg-white text-gray-800 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex, rehypeRaw]}
                          components={{
                            // Customize code blocks
                            code: ({
                              node,
                              inline,
                              className,
                              children,
                              ...props
                            }) => {
                              const isInline =
                                inline ||
                                (node &&
                                  node.position &&
                                  node.position.start.line ===
                                    node.position.end.line);
                              const match = /language-(\w+)/.exec(
                                className || "",
                              );

                              return !isInline && match ? (
                                <SyntaxHighlighter
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded-md text-xs"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                              ) : isInline ? (
                                <code
                                  className="bg-blue-50 text-blue-600 px-1 py-0.5 rounded text-xs inline-block"
                                  {...props}
                                >
                                  {children}
                                </code>
                              ) : (
                                <SyntaxHighlighter
                                  style={vscDarkPlus}
                                  language="text"
                                  PreTag="div"
                                  className="rounded-md text-xs"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                              );
                            },
                            // Customize paragraphs
                            p: ({ children }) => (
                              <p className="my-1.5 leading-relaxed">
                                {children}
                              </p>
                            ),
                            // Customize lists
                            ul: ({ children }) => (
                              <ul className="my-1.5 ml-4 list-disc">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="my-1.5 ml-4 list-decimal">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="my-0.5">{children}</li>
                            ),
                            // Customize headings
                            h1: ({ children }) => (
                              <h1 className="text-base font-bold my-2">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-sm font-bold my-2">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm font-semibold my-1.5">
                                {children}
                              </h3>
                            ),
                            // Customize tables
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-2">
                                <table className="min-w-full text-xs border-collapse border border-gray-300">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-gray-100">{children}</thead>
                            ),
                            tbody: ({ children }) => <tbody>{children}</tbody>,
                            tr: ({ children }) => (
                              <tr className="border-b border-gray-300">
                                {children}
                              </tr>
                            ),
                            th: ({ children }) => (
                              <th className="border border-gray-300 px-2 py-1 text-left font-semibold">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-gray-300 px-2 py-1">
                                {children}
                              </td>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "assistant" &&
                    msg.sources &&
                    msg.sources.length > 0 && (
                      <SourcesDropdown
                        sources={msg.sources}
                        threadId={msg.threadId}
                      />
                    )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start mb-2">
                <div className="bg-white px-3.5 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1">
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounceDot"
                    style={{ animationDelay: "0s" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounceDot"
                    style={{ animationDelay: "0.15s" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounceDot"
                    style={{ animationDelay: "0.3s" }}
                  ></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="flex p-4 bg-white border-t border-gray-200 gap-2"
            onSubmit={handleSubmit}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="w-10 h-10 rounded-full border-none bg-gradient-to-br from-blue-500 to-blue-700 text-white text-lg cursor-pointer flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!inputValue.trim() || isLoading}
            >
              &rarr;
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ChatbotApp;
