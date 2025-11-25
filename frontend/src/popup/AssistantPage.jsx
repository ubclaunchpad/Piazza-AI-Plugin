import { useState } from "react";

/* global chrome */
export default function AssistantPage({ user, onBack }) {
  const [activeTab, setActiveTab] = useState("chats"); // 'chats' or 'files'

  // Dummy chat data
  const dummyChats = [
    {
      id: 1,
      title: "Understanding recursion in @95",
      lastMessage: "Thanks! That makes sense now.",
      timestamp: "2 hours ago",
      messageCount: 8,
    },
    {
      id: 2,
      title: "Question about async/await",
      lastMessage: "Can you explain the difference?",
      timestamp: "Yesterday",
      messageCount: 5,
    },
    {
      id: 3,
      title: "Help with Project 2",
      lastMessage: "How do I implement the cache?",
      timestamp: "2 days ago",
      messageCount: 12,
    },
    {
      id: 4,
      title: "Clarification on lecture notes",
      lastMessage: "What does this diagram mean?",
      timestamp: "3 days ago",
      messageCount: 3,
    },
  ];

  const handleChatClick = (chatId) => {
    console.log("Opening chat:", chatId);
    // TODO: Navigate to chat detail view
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
            <div className="flex flex-col gap-2">
              {dummyChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleChatClick(chat.id)}
                  className="bg-white p-4 rounded-lg shadow-sm cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900 m-0 flex-1">
                      {chat.title}
                    </h4>
                    <span className="text-xs text-gray-500 ml-2">
                      {chat.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 m-0 mb-2">
                    {chat.lastMessage}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <span>💬</span>
                      {chat.messageCount} messages
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {dummyChats.length === 0 && (
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
