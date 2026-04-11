import { useState, useEffect } from "react";
import { useDocuments, useDocumentDownloadUrl } from "../queries/useDocument";
import { uploadDocument } from "../api/documentApi";
import {
  deleteSavedSearch,
  listSavedSearches,
  saveSearch,
  searchContent,
} from "../api/searchApi";

/* global chrome */
export default function AssistantPage({ user, onBack, onLogout }) {
  const [activeTab, setActiveTab] = useState("chats"); // 'chats' | 'files' | 'search'
  const [page, setPage] = useState(1);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const perPage = 5;
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [piazzaClassId, setPiazzaClassId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("semantic");
  const [crossCourse, setCrossCourse] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [savedSearches, setSavedSearches] = useState([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isSavingSearch, setIsSavingSearch] = useState(false);

  // Fetch documents for this user/thread (using Piazza class ID as thread ID)
  const {
    data: documentsData,
    isLoading: isLoadingDocuments,
    isError: isDocumentsError,
    refetch: refetchDocuments,
  } = useDocuments({
    uploaderId: user?.id,
    piazzaCourseId: piazzaClassId,
    page,
    perPage,
    enabled: !!piazzaClassId && !!user?.id,
  });

  // Get download URL for selected document
  const { data: downloadData } = useDocumentDownloadUrl(
    selectedDocumentId,
    3600,
    {
      enabled: !!selectedDocumentId,
    },
  );

  useEffect(() => {
    fetchPiazzaInfo();
  }, []);

  useEffect(() => {
    if (piazzaClassId) {
      fetchChats();
    }
  }, [piazzaClassId]);

  useEffect(() => {
    if (activeTab === "search") {
      fetchSavedSearches();
    }
  }, [activeTab, piazzaClassId, crossCourse]);

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
        },
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

  const fetchSavedSearches = async () => {
    setIsLoadingSaved(true);
    try {
      const data = await listSavedSearches({
        token: user.access_token,
        piazzaCourseId: crossCourse ? null : piazzaClassId,
      });
      setSavedSearches(data);
    } catch (error) {
      console.error("Error loading saved searches:", error);
      setSavedSearches([]);
    } finally {
      setIsLoadingSaved(false);
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
        // Find the chat object to get the title
        const chat = chats.find((c) => c.id === chatId);
        await chrome.tabs.sendMessage(tab.id, {
          type: "OPEN_CHAT_SESSION",
          sessionId: chatId,
          title: chat ? chat.title : null,
        });
        // Close popup
        window.close();
      }
    } catch (error) {
      console.error("Error opening chat:", error);
    }
  };

  const handleRunSearch = async (
    queryOverride = null,
    typeOverride = null,
    forceCourseId = undefined
  ) => {
    const query = (queryOverride ?? searchQuery).trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError("");

    try {
      const data = await searchContent({
        token: user.access_token,
        query,
        searchType: typeOverride || searchType,
        piazzaCourseId:
          forceCourseId !== undefined
            ? forceCourseId
            : crossCourse
              ? null
              : piazzaClassId,
      });
      setSearchResults(data.results || []);
      setSearchQuery(query);
      if (typeOverride) {
        setSearchType(typeOverride);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setSearchError(error.message || "Search failed");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setIsSavingSearch(true);
    try {
      await saveSearch({
        token: user.access_token,
        query,
        searchType,
        piazzaCourseId: crossCourse ? null : piazzaClassId,
      });
      await fetchSavedSearches();
    } catch (error) {
      console.error("Failed to save search:", error);
      setSearchError(error.message || "Failed to save search");
    } finally {
      setIsSavingSearch(false);
    }
  };

  const handleDeleteSavedSearch = async (savedSearchId) => {
    try {
      await deleteSavedSearch({
        token: user.access_token,
        savedSearchId,
      });
      setSavedSearches((prev) => prev.filter((item) => item.id !== savedSearchId));
    } catch (error) {
      console.error("Failed to delete saved search:", error);
      setSearchError(error.message || "Failed to delete saved search");
    }
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!piazzaClassId || !user?.id) {
      alert(
        "Unable to upload: Please ensure you are on a Piazza page and logged in.",
      );
      return;
    }
    if (files && files.length > 0) {
      setIsUploading(true);
      try {
        // Upload each file
        for (const file of Array.from(files)) {
          await uploadDocument({
            uploaderId: user.id,
            piazzaCourseId: piazzaClassId,
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
      <div className="bg-gradient-to-r from-blue-500 to-blue-700 p-5 flex items-center gap-3 text-white">
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
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            💬 Chats
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`flex-1 px-4 py-3 text-sm font-medium border-none cursor-pointer transition-all ${
              activeTab === "files"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            📁 Files
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 px-4 py-3 text-sm font-medium border-none cursor-pointer transition-all ${
              activeTab === "search"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            🔎 Search
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
                className="bg-blue-600 text-white border-none px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
        ) : activeTab === "files" ? (
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
        ) : (
          <div className="p-4 flex flex-col gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 m-0 mb-3">
                Search Posts
              </h4>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by meaning, code, or formula..."
                  className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => handleRunSearch()}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-blue-600 text-white border-none px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="border border-gray-200 rounded-md px-2 py-1 text-xs"
                >
                  <option value="semantic">Semantic</option>
                  <option value="code">Code</option>
                  <option value="formula">Formula</option>
                </select>
                <label className="text-xs text-gray-600 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={crossCourse}
                    onChange={(e) => setCrossCourse(e.target.checked)}
                  />
                  Cross-course search
                </label>
                <button
                  onClick={handleSaveSearch}
                  disabled={isSavingSearch || !searchQuery.trim()}
                  className="border border-gray-200 bg-gray-100 px-2 py-1 rounded text-xs text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                >
                  {isSavingSearch ? "Saving..." : "Save Search"}
                </button>
              </div>
              {searchError && <p className="text-xs text-red-600 mt-2 mb-0">{searchError}</p>}
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 m-0 mb-3">
                Search Results
              </h4>
              {isSearching ? (
                <p className="text-sm text-gray-500 m-0">Searching...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-gray-500 m-0">No results yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {searchResults.map((result, idx) => {
                    const courseId = result.metadata?.piazza_course_id || piazzaClassId;
                    const postId =
                      result.external_id ||
                      result.metadata?.post_number ||
                      result.metadata?.post_id;
                    return (
                      <div
                        key={`${result.chunk_id}-${idx}`}
                        className="border border-gray-200 rounded-md p-3 bg-gray-50"
                      >
                        <div className="flex justify-between gap-2">
                          <p className="text-xs font-semibold text-gray-800 m-0 truncate">
                            {result.title || "Untitled Result"}
                          </p>
                          <span className="text-[10px] text-blue-700 bg-blue-100 rounded px-1.5 py-0.5">
                            {(result.score || 0).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 mb-1 line-clamp-3">
                          {result.excerpt}
                        </p>
                        {courseId && postId && (
                          <a
                            href={`https://piazza.com/class/${courseId}/post/${postId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            Open Post
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 m-0">
                  Saved Searches
                </h4>
                <button
                  onClick={fetchSavedSearches}
                  className="text-xs border border-gray-200 bg-gray-100 px-2 py-1 rounded text-gray-700 hover:bg-gray-200"
                >
                  Refresh
                </button>
              </div>
              {isLoadingSaved ? (
                <p className="text-sm text-gray-500 m-0">Loading saved searches...</p>
              ) : savedSearches.length === 0 ? (
                <p className="text-sm text-gray-500 m-0">No saved searches.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedSearches.map((saved) => (
                    <div
                      key={saved.id}
                      className="border border-gray-200 rounded-md p-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-gray-800 m-0">
                            {saved.query}
                          </p>
                          <p className="text-[11px] text-gray-500 m-0 mt-1">
                            {saved.search_type}
                            {saved.piazza_course_id
                              ? ` • ${saved.piazza_course_id}`
                              : " • cross-course"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              handleRunSearch(
                                saved.query,
                                saved.search_type,
                                saved.piazza_course_id || null
                              )
                            }
                            className="text-[11px] border border-gray-200 bg-white px-2 py-1 rounded hover:bg-gray-100"
                          >
                            Run
                          </button>
                          <button
                            onClick={() => handleDeleteSavedSearch(saved.id)}
                            className="text-[11px] border border-red-200 text-red-600 bg-red-50 px-2 py-1 rounded hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
