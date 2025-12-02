import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";

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

function ChatbotApp() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [sessionId, setSessionId] = useState(null);
  const [user, setUser] = useState(null);

  // Fetch user info on mount
  useEffect(() => {
    /* global chrome */
    chrome.storage.local.get(["user", "authToken", "tokenExpiry"], (result) => {
      if (result.user && result.authToken) {
        // Check if token is expired
        if (result.tokenExpiry && Date.now() > result.tokenExpiry) {
          console.warn("Token expired");
          setMessages([
            {
              role: "assistant",
              content:
                "Session expired. Please open the extension icon to log in again.",
            },
          ]);
          return;
        }
        setUser({ ...result.user, access_token: result.authToken });
      }
    });

    // Listen for messages from popup
    const messageListener = (request, sender, sendResponse) => {
      if (request.type === "OPEN_CHAT_SESSION") {
        setSessionId(request.sessionId);
        setIsExpanded(true);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  // Fetch most recent session or messages when needed
  useEffect(() => {
    if (isExpanded && user && !sessionId) {
      fetchMostRecentSession();
    } else if (isExpanded && user && sessionId) {
      fetchMessages(sessionId);
    }
  }, [isExpanded, user, sessionId]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const convertLatexToMarkdown = (text) => {
    // Replace display math: \[ ... \] -> $$...$$
    let converted = text.replace(
      /\\\[\s*([^\]]+?)\s*\\\]/g,
      (match, content) => {
        return `\n$$\n${content.trim()}\n$$\n`;
      }
    );

    // Replace inline math: \( ... \) -> $...$
    converted = converted.replace(
      /\\\(\s*([^)]+?)\s*\\\)/g,
      (match, content) => {
        return `$${content.trim()}$`;
      }
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
        }
      );

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (response.ok) {
        const sessions = await response.json();
        if (sessions.length > 0) {
          setSessionId(sessions[0].id);
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
      }
    } catch (error) {
      console.error("Error creating session:", error);
    }
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
        }
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
        // Should have been created by fetchMostRecentSession, but just in case
        await createNewSession(threadId);
        // We can't easily wait for state update here, so we might fail this first request's history
        // But fetchMostRecentSession is called on expand, so it should be fine.
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
          session_id: sessionId, // Pass the session ID
        }),
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Convert LaTeX notation and add AI response
      const convertedContent = convertLatexToMarkdown(data.response);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: convertedContent,
          sources: data.sources || [],
          threadId: threadId,
        },
      ]);
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
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex-shrink-0"></div>
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
          <div className="bg-gradient-to-r from-purple-500 to-purple-700 text-white px-5 py-4 flex justify-between items-center">
            <h3 className="m-0 text-base font-semibold">AI Assistant</h3>
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
                        ? "bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-br-sm"
                        : "bg-white text-gray-800 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            // Customize code blocks
                            code: ({
                              node,
                              inline,
                              className,
                              children,
                              ...props
                            }) => {
                              return inline ? (
                                <code
                                  className="bg-purple-50 text-purple-600 px-1 py-0.5 rounded text-xs inline"
                                  {...props}
                                >
                                  {children}
                                </code>
                              ) : (
                                <code
                                  className="block bg-gray-100 text-gray-800 p-2 rounded text-xs overflow-x-auto"
                                  {...props}
                                >
                                  {children}
                                </code>
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
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounceDot [animation-delay:-0.32s]"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounceDot [animation-delay:-0.16s]"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounceDot"></span>
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
              className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-none transition-colors focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="w-10 h-10 rounded-full border-none bg-gradient-to-br from-purple-500 to-purple-700 text-white text-lg cursor-pointer flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
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
