import { useEffect, useState } from "react";

/* global chrome */
export default function DashboardPage({
  user,
  onLogout,
  onNavigateToAssistant,
}) {
  const [currentTab, setCurrentTab] = useState(null);
  const [piazzaInfo, setPiazzaInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCurrentTabInfo();
  }, []);

  const getCurrentTabInfo = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      setCurrentTab(tab);

      if (tab && tab.url && tab.url.includes("piazza.com")) {
        // Parse Piazza URL
        const url = new URL(tab.url);
        const pathParts = url.pathname.split("/").filter(Boolean);

        const info = {
          isPiazza: true,
          fullUrl: tab.url,
          classId: pathParts[1] || null,
          postId: url.searchParams.get("cid") || null,
          pathname: url.pathname,
          threadName: null,
        };

        // Try to get thread name from content script
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: "GET_PIAZZA_INFO",
          });
          if (response && response.success && response.threadName) {
            info.threadName = response.threadName;
          }
        } catch (error) {
          console.log("Could not get thread name from content script:", error);
        }

        setPiazzaInfo(info);
      } else {
        setPiazzaInfo({ isPiazza: false });
      }
    } catch (error) {
      console.error("Error getting tab info:", error);
      setPiazzaInfo({ isPiazza: false, error: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    getCurrentTabInfo();
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      onLogout();
    }
  };

  return (
    <div className="flex flex-col min-h-[500px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-700 p-5 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-base border-2 border-white/30">
            {user.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div>
            <h2 className="text-base font-semibold m-0">{user.name}</h2>
            <p className="text-xs m-0 mt-0.5 opacity-90">{user.email}</p>
          </div>
        </div>
        <button
          className="bg-white/20 border-none text-white w-8 h-8 rounded-md cursor-pointer text-lg flex items-center justify-center transition-colors hover:bg-white/30"
          onClick={handleLogout}
          title="Log out"
        >
          <span>↗</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col gap-5 bg-gray-50">
        {/* Current Page Section */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 m-0">
              Current Page
            </h3>
            <button
              className="bg-transparent border-none cursor-pointer text-base p-1 opacity-60 transition-opacity hover:opacity-100"
              onClick={handleRefresh}
              title="Refresh"
            >
              🔄
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 p-3 text-gray-600 text-sm">
              <span className="w-4 h-4 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin inline-block"></span>
              <span>Loading...</span>
            </div>
          ) : piazzaInfo?.isPiazza ? (
            <div className="flex flex-col gap-3">
              {/* Success Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-emerald-100 text-emerald-800 self-start">
                <span className="text-sm">✓</span>
                On Piazza
              </div>

              {/* Info Grid */}
              <div className="flex flex-col gap-2">
                {piazzaInfo.classId && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-600 font-medium min-w-[70px]">
                      Class ID:
                    </span>
                    <span className="text-gray-900 font-semibold font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                      {piazzaInfo.classId}
                    </span>
                  </div>
                )}

                {piazzaInfo.threadName && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-600 font-medium min-w-[70px]">
                      Thread:
                    </span>
                    <span className="text-gray-900 font-semibold bg-purple-50 px-1.5 py-0.5 rounded">
                      {piazzaInfo.threadName}
                    </span>
                  </div>
                )}

                {piazzaInfo.postId && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-600 font-medium min-w-[70px]">
                      Post ID:
                    </span>
                    <span className="text-gray-900 font-semibold font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                      {piazzaInfo.postId}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-gray-600 font-medium">URL:</span>
                  <a
                    href={piazzaInfo.fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 no-underline break-all text-xs hover:underline"
                  >
                    {piazzaInfo.pathname}
                  </a>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={onNavigateToAssistant}
                  className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:bg-gray-200 hover:border-gray-300"
                >
                  <span>📊</span>
                  Assistant
                </button>
                <button className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:bg-gray-200 hover:border-gray-300">
                  <span>📥</span>
                  Ingest Thread
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center p-3">
              {/* Neutral Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-200 text-gray-700 mb-3">
                <span className="text-sm">ℹ️</span>
                Not on Piazza
              </div>
              <p className="text-gray-600 text-sm my-2 leading-relaxed">
                Navigate to a Piazza page to use ThreadSense AI features.
              </p>
              {currentTab?.url && (
                <div className="flex flex-col gap-1 mt-3 p-2 bg-gray-50 rounded-md text-xs">
                  <span className="text-gray-600 font-medium">
                    Current site:
                  </span>
                  <span className="text-gray-900 font-semibold">
                    {new URL(currentTab.url).hostname}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats Section */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 m-0 mb-3">
            Quick Stats
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 mb-1">0</div>
              <div className="text-[11px] text-gray-600 font-medium uppercase tracking-wider">
                Queries Today
              </div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 mb-1">0</div>
              <div className="text-[11px] text-gray-600 font-medium uppercase tracking-wider">
                Posts Analyzed
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
