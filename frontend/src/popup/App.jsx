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
    try {
      // Call the backend API
      const API_ENDPOINT =
        process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_ENDPOINT}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error responses from backend
        if (response.status === 401) {
          return {
            success: false,
            error: data.detail || "Invalid email or password",
          };
        } else if (response.status === 404) {
          return { success: false, error: "User not found" };
        }
        return { success: false, error: data.detail || "Login failed" };
      }

      // Extract user data and tokens from response
      const userData = data.user;
      const { access_token, refresh_token, expires_in } = data;

      // Store user, tokens, and expiry in chrome storage
      await chrome.storage.local.set({
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
        },
        authToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry: Date.now() + expires_in * 1000, // Convert to milliseconds
      });

      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
      });
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: error.message || "Unable to connect to server",
      };
    }
  };

  const handleSignup = async (email, password, name) => {
    try {
      // Call the backend API
      const API_ENDPOINT =
        process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_ENDPOINT}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
          display_name: name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error responses from backend
        if (response.status === 409) {
          return { success: false, error: "Email already registered" };
        } else if (response.status === 422) {
          return {
            success: false,
            error: data.detail || "Password must be at least 8 characters",
          };
        }
        return { success: false, error: data.detail || "Signup failed" };
      }

      // Signup successful! User needs to confirm their email before logging in
      return {
        success: true,
        message:
          "Signup successful! Please check your email to confirm your account before logging in.",
      };
    } catch (error) {
      console.error("Signup error:", error);
      return {
        success: false,
        error: error.message || "Unable to connect to server",
      };
    }
  };

  const handleLogout = async () => {
    await chrome.storage.local.remove([
      "user",
      "authToken",
      "refreshToken",
      "tokenExpiry",
    ]);
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
