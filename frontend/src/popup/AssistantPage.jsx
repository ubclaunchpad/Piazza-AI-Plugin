import { useState } from "react";
import { useDocuments, useDocumentDownloadUrl } from "../queries/useDocument";
import { uploadDocument } from "../api/documentApi";

/* global chrome */
export default function AssistantPage({ user, onBack }) {
  const [activeTab, setActiveTab] = useState("chats"); // 'chats' or 'files'
  const [page, setPage] = useState(1);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const perPage = 5;

  // Mocked UUIDs - TODO: Replace with real context values
  const mockedUserUUID = "00000000-0000-0000-0000-000000000000";
  const mockedThreadUUID = "11111111-1111-1111-1111-111111111111";

  // Fetch documents for this user/thread
  const {
    data: documentsData,
    isLoading: isLoadingDocuments,
    isError: isDocumentsError,
    refetch: refetchDocuments,
  } = useDocuments({
    uploaderId: mockedUserUUID,
    threadId: mockedThreadUUID,
    page,
    perPage,
  });

  // Get download URL for selected document
  const { data: downloadData } = useDocumentDownloadUrl(
    selectedDocumentId,
    3600,
    {
      enabled: !!selectedDocumentId,
    }
  );

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

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      try {
        // Upload each file
        for (const file of Array.from(files)) {
          await uploadDocument({
            uploaderId: mockedUserUUID,
            threadId: mockedThreadUUID,
            permission: "private",
            file,
          });
        }
        alert("Files uploaded successfully!");
        refetchDocuments();
      } catch (error) {
        console.error("Error uploading files:", error);
        alert("Error uploading files. Please try again.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleFileClick = async (documentId) => {
    setSelectedDocumentId(documentId);
    // The download URL will be fetched by the useDocumentDownloadUrl hook
    // Once available, open in new tab
  };

  // Effect to open URL when download data is available
  if (downloadData?.download_url && selectedDocumentId) {
    window.open(downloadData.download_url, "_blank");
    setSelectedDocumentId(null); // Reset after opening
  }

  const totalPages = documentsData
    ? Math.ceil(documentsData.total / perPage)
    : 0;
  const documents = documentsData?.documents || [];

  // Helper to get file icon based on type
  const getFileIcon = (fileType) => {
    if (fileType?.includes("pdf")) return "📄";
    if (fileType?.includes("word") || fileType?.includes("docx")) return "📝";
    if (fileType?.includes("text")) return "📃";
    return "📁";
  };

  // Helper to format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
                className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg bg-white transition-colors ${
                  isUploading
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:bg-gray-50"
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isUploading ? (
                    <>
                      <span className="w-8 h-8 border-3 border-gray-300 border-t-purple-500 rounded-full animate-spin mb-2"></span>
                      <p className="text-sm text-gray-600">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl mb-2">📤</span>
                      <p className="mb-2 text-sm text-gray-600">
                        <span className="font-semibold">Click to upload</span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        PDF, TXT, DOCX (Max. 10MB)
                      </p>
                    </>
                  )}
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.txt,.docx,.doc"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            </div>

            {/* Uploaded Files List */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 m-0">
                  Uploaded Files
                </h4>
                {documentsData?.total > 0 && (
                  <span className="text-xs text-gray-500">
                    {documentsData.total} file
                    {documentsData.total !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {isLoadingDocuments ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="w-5 h-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin"></span>
                    <span className="ml-2 text-sm text-gray-500">
                      Loading...
                    </span>
                  </div>
                ) : isDocumentsError ? (
                  <div className="text-center py-8">
                    <span className="text-4xl block mb-2">⚠️</span>
                    <p className="text-red-500 text-sm">Error loading files</p>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-4xl block mb-2">📂</span>
                    <p className="text-gray-500 text-sm">No files uploaded</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Upload files to analyze with AI
                    </p>
                  </div>
                ) : (
                  <>
                    {/* File List */}
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                      >
                        <div
                          className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                          onClick={() => handleFileClick(doc.id)}
                        >
                          <span className="text-2xl flex-shrink-0">
                            {getFileIcon(doc.file_type)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate m-0">
                              {doc.file_name}
                            </p>
                            <p className="text-xs text-gray-500 m-0 mt-0.5">
                              {formatFileSize(doc.file_size)} •{" "}
                              {formatDate(doc.created_at)}
                            </p>
                          </div>
                        </div>
                        {doc.indexed && (
                          <span
                            className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex-shrink-0"
                            title="Indexed for AI"
                          >
                            ✓ Indexed
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          ← Previous
                        </button>
                        <span className="text-xs text-gray-500">
                          Page {page} of {totalPages}
                        </span>
                        <button
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={page === totalPages}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
