import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../popup/popup.css";
import StudyMaterialsPage from "../popup/StudyMaterialsPage";

/* global chrome */

const courseId = new URLSearchParams(window.location.search).get("course_id");

function StudyTab() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    chrome.storage.local.get(["user", "authToken", "tokenExpiry"], (result) => {
      if (result.user && result.authToken) {
        if (result.tokenExpiry && Date.now() > result.tokenExpiry) {
          setUser(null);
        } else {
          setUser({ ...result.user, access_token: result.authToken });
        }
      }
      setIsLoading(false);
    });
  }, []);

  const handleLogout = () => {
    chrome.storage.local.remove(
      ["user", "authToken", "refreshToken", "tokenExpiry"],
      () => window.close()
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Not authenticated. Please log in via the extension popup.
      </div>
    );
  }

  return (
    <StudyMaterialsPage
      user={user}
      piazzaCourseId={courseId}
      onLogout={handleLogout}
    />
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<StudyTab />);
