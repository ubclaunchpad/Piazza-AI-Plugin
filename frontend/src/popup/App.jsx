import { useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import AssistantPage from "./AssistantPage";

/* global chrome */
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("dashboard"); // 'dashboard' or 'assistant'

  // Check if user is already logged in
  useEffect(() => {
    chrome.storage.local.get(["user", "authToken"], (result) => {
      if (result.user && result.authToken) {
        setUser(result.user);
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    });
  }, []);

  const handleLogin = async (email, password) => {
    // TODO: Replace with actual API call to your backend
    try {
      // Simulated login - replace with actual API call
      const mockUser = {
        email: email,
        name: email.split("@")[0],
        id: Date.now(),
      };

      const mockToken = "mock_token_" + Date.now();

      // Store user and token
      await chrome.storage.local.set({
        user: mockUser,
        authToken: mockToken,
      });

      setUser(mockUser);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Login failed" };
    }
  };

  const handleSignup = async (email, password, name) => {
    // TODO: Replace with actual API call to your backend
    try {
      // Simulated signup - replace with actual API call
      const mockUser = {
        email: email,
        name: name || email.split("@")[0],
        id: Date.now(),
      };

      const mockToken = "mock_token_" + Date.now();

      // Store user and token
      await chrome.storage.local.set({
        user: mockUser,
        authToken: mockToken,
      });

      setUser(mockUser);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error("Signup error:", error);
      return { success: false, error: "Signup failed" };
    }
  };

  const handleLogout = async () => {
    await chrome.storage.local.remove(["user", "authToken"]);
    setUser(null);
    setIsAuthenticated(false);
    setCurrentPage("dashboard");
  };

  if (isLoading) {
    return (
      <div className="w-[380px] min-h-[500px] bg-white flex flex-col">
        <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-purple-500 rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[380px] min-h-[500px] bg-white flex flex-col">
      {isAuthenticated ? (
        currentPage === "dashboard" ? (
          <DashboardPage
            user={user}
            onLogout={handleLogout}
            onNavigateToAssistant={() => setCurrentPage("assistant")}
          />
        ) : (
          <AssistantPage
            user={user}
            onBack={() => setCurrentPage("dashboard")}
          />
        )
      ) : (
        <LoginPage onLogin={handleLogin} onSignup={handleSignup} />
      )}
    </div>
  );
}
