import { useState, useEffect } from "react";

/* global chrome */
export default function AssistantPage({ user, onBack, onLogout }) {
  const [activeTab, setActiveTab] = useState("chats"); // 'chats' or 'files'
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [piazzaClassId, setPiazzaClassId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchPiazzaInfo();
  }, []);

  useEffect(() => {
    if (piazzaClassId) {
      fetchChats();
    }
  }, [piazzaClassId]);

  const fetchPiazzaInfo = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab && tab.url && tab.url.includes("piazza.com")) {
        const url = new URL(tab.url);
        const pathParts = url.pathname.split("/").filter(Boolean);
        const classId = pathParts[1];
        setPiazzaClassId(classId);
      }
    } catch (error) {
      console.error("Error getting Piazza info:", error);
    }
  };

  const fetchChats = async () => {
    setIsLoading(true);
    try {
      const API_ENDPOINT =
        process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
      const response = await fetch(
        `${API_ENDPOINT}/chat-sessions?piazza_course_id=${piazzaClassId}`,
        {
          headers: {
            Authorization: `Bearer ${user.access_token}`,
          },
        }
      );
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setChats(data);
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChat = async () => {
    if (!piazzaClassId) return;
    setIsCreating(true);
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
          piazza_course_id: piazzaClassId,
          title: "New Chat",
        }),
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (response.ok) {
        const newChat = await response.json();
        setChats([newChat, ...chats]);
      } else {
        console.error("Failed to create chat");
      }
    } catch (error) {
      console.error("Error creating chat:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      const API_ENDPOINT =
        process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_ENDPOINT}/chat-sessions/${chatId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${user.access_token}`,
        },
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (response.ok) {
        setChats(chats.filter((c) => c.id !== chatId));
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  const handleChatClick = async (chatId) => {
    console.log("Opening chat:", chatId);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          type: "OPEN_CHAT_SESSION",
          sessionId: chatId,
        });
        // Close popup
        window.close();
      }
    } catch (error) {
      console.error("Error opening chat:", error);
    }
  };

  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      console.log(
        "Files selected:",
        Array.from(files).map((f) => f.name)
      );
      // TODO: Handle file upload
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
        <div>
          <h2 className="text-base font-semibold m-0">AI Assistant</h2>
          <p className="text-xs m-0 mt-0.5 opacity-90">{user.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex-1 px-4 py-3 text-sm font-medium border-none cursor-pointer transition-all ${
              activeTab === "chats"
                ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50/50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            💬 Chats
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`flex-1 px-4 py-3 text-sm font-medium border-none cursor-pointer transition-all ${
              activeTab === "files"
                ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50/50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            📁 Files
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {activeTab === "chats" ? (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-gray-700 m-0">
                Recent Chats
              </h3>
              <button
                onClick={handleCreateChat}
                disabled={isCreating || !piazzaClassId}
                className="bg-purple-600 text-white border-none px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "+ New Chat"}
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Loading chats...
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleChatClick(chat.id)}
                    className="bg-white p-4 rounded-lg shadow-sm cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border border-gray-100 group relative"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 m-0 flex-1 truncate pr-6">
                        {chat.title || "Untitled Chat"}
                      </h4>
                      <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                        {new Date(chat.updated_at).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-transparent border-none cursor-pointer"
                      title="Delete chat"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && chats.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No chats yet</p>
                <p className="text-gray-400 text-xs mt-1">
                  Start a conversation with the AI assistant
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            {/* File Upload Area */}
            <div className="mb-4">
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <span className="text-4xl mb-2">📤</span>
                  <p className="mb-2 text-sm text-gray-600">
                    <span className="font-semibold">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, TXT, DOCX (Max. 10MB)
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.txt,.docx,.doc"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            {/* Uploaded Files List (Placeholder) */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 m-0">
                Uploaded Files
              </h4>
              <div className="flex flex-col gap-2">
                {/* Placeholder - no files yet */}
                <div className="text-center py-8">
                  <span className="text-4xl block mb-2">📂</span>
                  <p className="text-gray-500 text-sm">No files uploaded</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Upload files to analyze with AI
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
