import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

/* global chrome */

const PiazzaContext = createContext(null);

export function PiazzaProvider({ children }) {
  const [currentTab, setCurrentTab] = useState(null);
  const [piazzaInfo, setPiazzaInfo] = useState(null);
  const [isPiazzaLoading, setIsPiazzaLoading] = useState(true);

  // Fetch current tab and Piazza info
  const refreshPiazzaInfo = useCallback(async () => {
    setIsPiazzaLoading(true);
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
      setIsPiazzaLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    refreshPiazzaInfo();
  }, [refreshPiazzaInfo]);

  const value = {
    // State
    currentTab,
    piazzaInfo,
    isPiazzaLoading,

    // Actions
    refreshPiazzaInfo,
  };

  return (
    <PiazzaContext.Provider value={value}>{children}</PiazzaContext.Provider>
  );
}

export function usePiazza() {
  const context = useContext(PiazzaContext);
  if (!context) {
    throw new Error("usePiazza must be used within a PiazzaProvider");
  }
  return context;
}

export default PiazzaContext;
