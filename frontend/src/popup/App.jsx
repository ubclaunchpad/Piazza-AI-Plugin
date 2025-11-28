import { useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import AssistantPage from "./AssistantPage";
import { useUser } from "../context/UserAuthContext";
/* global chrome */
export default function App() {
  const { isAuthenticated, isUserLoading } = useUser();
  const [currentPage, setCurrentPage] = useState("dashboard"); // 'dashboard' or 'assistant'

  if (isUserLoading) {
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
            onNavigateToAssistant={() => setCurrentPage("assistant")}
          />
        ) : (
          <AssistantPage onBack={() => setCurrentPage("dashboard")} />
        )
      ) : (
        <LoginPage />
      )}
    </div>
  );
}
