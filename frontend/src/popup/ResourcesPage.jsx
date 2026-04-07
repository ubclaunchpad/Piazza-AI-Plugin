import { useState, useEffect } from "react";
import { searchResources, getResourceLibrary, saveResource, deleteResource } from "../api/resourcesApi";

const PROVIDERS = [
  { id: "youtube", label: "YouTube" },
  { id: "stackoverflow", label: "Stack Overflow" },
  { id: "khan_academy", label: "Khan Academy" },
  { id: "wikipedia", label: "Wikipedia" },
];

const PROVIDER_COLORS = {
  youtube: "bg-red-100 text-red-700",
  stackoverflow: "bg-orange-100 text-orange-700",
  khan_academy: "bg-blue-100 text-blue-700",
  wikipedia: "bg-gray-100 text-gray-700",
  other: "bg-gray-100 text-gray-700",
};

function ResourceBadge({ type }) {
  const colors = PROVIDER_COLORS[type] || PROVIDER_COLORS.other;
  const label = PROVIDERS.find((p) => p.id === type)?.label || type;
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors}`}>
      {label}
    </span>
  );
}

function SearchTab({ user, piazzaCourseId }) {
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savingIds, setSavingIds] = useState(new Set());
  const [savedMessage, setSavedMessage] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const data = await searchResources({
        query: query.trim(),
        piazzaCourseId,
        filters: selectedFilters.length > 0 ? selectedFilters : undefined,
        limit: 10,
      });
      const list = Array.isArray(data.results) ? data.results : [];
      setResults(list);
      if (list.length === 0) {
        setError("No resources found. Try a different search.");
      }
    } catch (err) {
      setError(err.message || "Failed to search resources. Please try again.");
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveResource = async (resource) => {
    if (!user) return;

    setSavingIds((prev) => new Set(prev).add(resource.url));

    try {
      await saveResource({
        payload: {
          piazza_course_id: piazzaCourseId,
          topic: query.trim(),
          resource_type: resource.resource_type,
          title: resource.title,
          url: resource.url,
          description: resource.description || "",
          relevance_score: resource.relevance_score,
        },
        token: user.access_token,
      });

      setSavedMessage("Resource saved to library!");
      setTimeout(() => setSavedMessage(null), 3000);
    } catch (err) {
      setError(err.message || "Failed to save resource");
      console.error("Save error:", err);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(resource.url);
        return next;
      });
    }
  };

  const toggleFilter = (filterId) => {
    setSelectedFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((f) => f !== filterId)
        : [...prev, filterId]
    );
  };

  return (
    <div className="flex flex-col gap-4 flex-1">
      <form onSubmit={handleSearch} className="flex flex-col gap-3">
        {/* Search Input */}
        <div>
          <input
            type="text"
            placeholder="Search for resources..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Provider Filters */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Source Providers
          </label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => toggleFilter(provider.id)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  selectedFilters.includes(provider.id)
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {provider.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 rounded-md text-sm transition-colors"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Messages */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}
      {savedMessage && (
        <div className="p-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          ✓ {savedMessage}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="flex flex-col gap-3">
            {results.map((resource) => (
              <div
                key={resource.url}
                className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline line-clamp-2"
                  >
                    {resource.title}
                  </a>
                </div>

                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  {resource.description}
                </p>

                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ResourceBadge type={resource.resource_type} />
                    {resource.relevance_score == null ? (
                      <span className="text-xs text-gray-500">Unscored</span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        Match: {Math.round(resource.relevance_score * 100)}%
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSaveResource(resource)}
                    disabled={savingIds.has(resource.url)}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:bg-gray-200 disabled:text-gray-500 rounded-md font-medium transition-colors"
                  >
                    {savingIds.has(resource.url) ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && results.length === 0 && !error && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Search to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LibraryTab({ user, piazzaCourseId }) {
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());

  useEffect(() => {
    if (user) {
      fetchLibrary();
    }
  }, [user]);

  const fetchLibrary = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getResourceLibrary({
        piazzaCourseId,
        token: user.access_token,
      });
      setResources(data.saved_resources || []);
    } catch (err) {
      setError(err.message || "Failed to load library");
      console.error("Library error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteResource = async (id) => {
    if (!confirm("Are you sure you want to delete this resource?")) return;

    setDeletingIds((prev) => new Set(prev).add(id));

    try {
      await deleteResource({
        id,
        token: user.access_token,
      });
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete resource");
      console.error("Delete error:", err);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-800">My Resources</h3>
        <button
          onClick={fetchLibrary}
          disabled={isLoading}
          className="text-xs px-2 py-1 text-gray-600 hover:text-gray-900 disabled:text-gray-400"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        )}

        {!isLoading && resources.length > 0 && (
          <div className="flex flex-col gap-3">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline line-clamp-2"
                  >
                    {resource.title}
                  </a>
                </div>

                <p className="text-xs text-gray-600 mb-1 line-clamp-1">
                  <span className="font-medium">Topic:</span> {resource.topic}
                </p>

                {resource.description && (
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {resource.description}
                  </p>
                )}

                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ResourceBadge type={resource.resource_type} />
                    {resource.relevance_score == null ? (
                      <span className="text-xs text-gray-500">Unscored</span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        Match: {Math.round(resource.relevance_score * 100)}%
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(resource.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteResource(resource.id)}
                    disabled={deletingIds.has(resource.id)}
                    className="text-xs px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 disabled:bg-gray-200 disabled:text-gray-500 rounded-md font-medium transition-colors"
                  >
                    {deletingIds.has(resource.id) ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && resources.length === 0 && !error && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No saved resources yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Search and save resources to build your library
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResourcesPage({ user, onBack }) {
  const [activeTab, setActiveTab] = useState("search");
  const [piazzaCourseId, setPiazzaCourseId] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const getCurrentPiazzaCourse = async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab && tab.url && tab.url.includes("piazza.com")) {
          const url = new URL(tab.url);
          const pathParts = url.pathname.split("/").filter(Boolean);
          const classId = pathParts[1];
          if (classId) {
            setPiazzaCourseId(classId);
          }
        }
      } catch (error) {
        console.error("Error detecting Piazza course:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    getCurrentPiazzaCourse();
  }, []);

  if (isInitializing) {
    return (
      <div className="flex flex-col min-h-[500px] p-4 items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!piazzaCourseId) {
    return (
      <div className="flex flex-col min-h-[500px] p-4">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4"
        >
          ← Back
        </button>
        <div className="text-center py-8">
          <p className="text-sm text-gray-700 mb-2">Could not detect Piazza course</p>
          <p className="text-xs text-gray-500">
            Make sure you are viewing a Piazza class
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[500px] bg-white">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-200">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-3"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900 mb-3">Resources</h1>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "search"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "library"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            My Library
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {activeTab === "search" ? (
          <SearchTab user={user} piazzaCourseId={piazzaCourseId} />
        ) : (
          <LibraryTab user={user} piazzaCourseId={piazzaCourseId} />
        )}
      </div>
    </div>
  );
}

