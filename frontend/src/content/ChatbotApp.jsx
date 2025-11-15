import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";

function ChatbotApp() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Handle clicking outside (works with Shadow DOM)
  useEffect(() => {
    function handleClickOutside(event) {
      if (chatRef.current && !chatRef.current.contains(event.target)) {
        setIsExpanded(false);
      }
    }

    if (isExpanded) {
      // Add listener to the shadow root where the component lives
      const shadowRoot = chatRef.current?.getRootNode();

      // Small delay to prevent the click that opens the chat from immediately triggering the close
      const timer = setTimeout(() => {
        if (shadowRoot) {
          shadowRoot.addEventListener("mousedown", handleClickOutside);
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        if (shadowRoot) {
          shadowRoot.removeEventListener("mousedown", handleClickOutside);
        }
      };
    }
  }, [isExpanded]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  // Convert LaTeX notation to markdown math format
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Call the backend API
      const API_ENDPOINT =
        process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_ENDPOINT}/llm/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: userMessage }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Convert LaTeX notation and add AI response
      const convertedContent = convertLatexToMarkdown(data.response);
      console.log("Original:", data.response);
      console.log("Converted:", convertedContent);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: convertedContent,
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
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 bg-gray-50 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                <p>👋 Hi! How can I help you today?</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex mb-2 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
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
              ➤
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ChatbotApp;
