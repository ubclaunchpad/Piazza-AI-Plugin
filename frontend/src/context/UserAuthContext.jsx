import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

/* global chrome */

const UserContext = createContext(null);

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    chrome.storage.local.get(["user", "authToken"], (result) => {
      if (result.user && result.authToken) {
        setUser(result.user);
        setIsAuthenticated(true);
      }
      setIsUserLoading(false);
    });
  }, []);

  const login = async (email, password) => {
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
      return { success: false, error: "Login failed" + error.message };
    }
  };

  const signup = async (email, password, name) => {
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

  const logout = async () => {
    await chrome.storage.local.remove(["user", "authToken"]);
    setUser(null);
    setIsAuthenticated(false);
    setCurrentPage("dashboard");
  };

  const value = {
    // user state
    isAuthenticated,
    isUserLoading,
    user,
    // user actions
    login,
    logout,
    signup,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

export default UserContext;
