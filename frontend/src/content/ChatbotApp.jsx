import { useState, useRef, useEffect } from "react";

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
      // Get the shadow root element
      const shadowRoot = chatRef.current?.getRootNode();

      // Check if click is outside the shadow DOM or outside the chatbot
      if (chatRef.current && !chatRef.current.contains(event.target)) {
        setIsExpanded(false);
      }
    }

    if (isExpanded) {
      // Listen on both document and shadow root
      document.addEventListener("mousedown", handleClickOutside);
      const shadowRoot = chatRef.current?.getRootNode();
      if (shadowRoot && shadowRoot !== document) {
        shadowRoot.addEventListener("mousedown", handleClickOutside);
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      const shadowRoot = chatRef.current?.getRootNode();
      if (shadowRoot && shadowRoot !== document) {
        shadowRoot.removeEventListener("mousedown", handleClickOutside);
      }
    };
  }, [isExpanded]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I received your message: "${userMessage}". This is a demo response. Connect to your AI API here!`,
        },
      ]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div ref={chatRef} className="chatbot-container">
      {!isExpanded ? (
        <button
          className={`chatbot-button ${isHovered ? "hovered" : ""}`}
          onClick={handleToggle}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="button-content">
            <div className="circle"></div>
            {isHovered && <span className="button-text">Ask AI!</span>}
          </div>
        </button>
      ) : (
        <div className="chatbot-expanded">
          <div className="chat-header">
            <h3>AI Assistant</h3>
            <button
              className="close-button"
              onClick={() => setIsExpanded(false)}
            >
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-state">
                <p>👋 Hi! How can I help you today?</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="message assistant">
                <div className="message-content loading">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="chat-input"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="send-button"
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
