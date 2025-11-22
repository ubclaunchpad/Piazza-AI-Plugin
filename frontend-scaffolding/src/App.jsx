import { useState, useEffect, useRef } from "react";

export default function App() {

    const [isHovered, setIsHovered] = useState(false);
    const [isClicked, setIsClicked] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const messageEndRef = useRef(null);

    const placeholderSrc = chrome.runtime.getURL('icons/placeholder.svg');

    function handleToggle() {
        setIsHovered(false);
        setIsClicked(!isClicked);
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!inputValue.trim() || isLoading) return;

        const userMessage = inputValue.trim();
        setInputValue('');

        setMessages(prev => [...prev, {content: userMessage,role: "user"}]);

        setIsLoading(true);

        // ------------------------ MAKE API RESPONSE --------------------------- //
        
        // As of right now I will just try to simulate the api response here.
        setTimeout(() => {
            setMessages(prev => [...prev, {content: `I recieved your message: ${userMessage}. This is a demo response. Connect to your API here!`, role: "ai"}]);
            setIsLoading(false);
        }, 1000);
    }


    return (
        <div className="chatbot-container">
            {!isClicked ?
                (
                    <div className={`state-logo ${isHovered && "hover"}`}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        onClick={handleToggle}
                    >
                        <img src={placeholderSrc} alt="placeholder" />
                        {isHovered && <p className="hover-state-description">Ask AI!</p>}
                    </div>
                ) : (
                    <div className="chatbot-expanded">
                        <div className="chatbot-header">
                            <h3>Ask ThreadSense! ✨✨</h3>
                            <button className="exit-chatbot" onClick={() => setIsClicked(false)}>✕</button>
                        </div>
                        <div className="chat-messages">
                            {messages.length === 0 ? (
                                <div className="empty-state">
                                    <p>👋 Hi! How may I help you today?</p>
                                </div>
                            ) : (
                                messages.map((msg, id) => (
                                    <div key={id} className={`message ${msg.role}`}>
                                        <div className="message-content">
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isLoading && (
                                <div className="message ai">
                                    <div className="message-content loading">
                                        <span className="dot"></span>
                                        <span className="dot"></span>
                                        <span className="dot"></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messageEndRef}></div>
                        </div>

                        <form className="chat-input-form" onSubmit={handleSubmit}>
                            <input type="text"
                                value={inputValue}
                                onChange={(event) => { setInputValue(event.target.value) }}
                                placeholder="Type your message ..."
                                className="chat-input"
                                disabled={isLoading}></input>
                            <button type="submit" className="send-button" disabled={!inputValue.trim() || isLoading}>➤</button>
                        </form>
                    </div>
                )
            }

        </div>
    );
}