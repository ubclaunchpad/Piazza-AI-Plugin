import React, { useEffect, useState } from "react";
import "./popup.css";

/* global chrome */
export default function App() {
  const [status, setStatus] = useState("Ready");
  const [version, setVersion] = useState("v1.0.0");

  useEffect(() => {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) setVersion(`v${manifest.version}`);
    } catch {
      // ignore in non-extension environments
    }
  }, []);

  const handleTest = async () => {
    setStatus("Testing...");
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      const isPiazza = tab && tab.url && tab.url.includes("piazza.com");

      if (isPiazza) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: "TEST",
          });
          setStatus(
            response
              ? "✅ Extension working!"
              : "⚠️ Content script not responding"
          );
        } catch (error) {
          if (
            error.message &&
            error.message.includes("Could not establish connection")
          ) {
            setStatus("⚠️ Content script not loaded - try refreshing Piazza");
          } else {
            setStatus("❌ Communication error");
            console.error("Message error:", error);
          }
        }
      } else {
        setStatus("ℹ️ Please navigate to a Piazza page");
      }
    } catch (error) {
      setStatus("❌ Test failed");
      console.error("Test error:", error);
    }
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>Piazza AI Plugin</h1>
        <span className="version" id="version">
          {version}
        </span>
      </header>

      <div className="main">
        <p className="description">AI-powered enhancements for Piazza</p>

        <button id="testBtn" className="primary-btn" onClick={handleTest}>
          Test Extension
        </button>

        <div className="status" id="status">
          {status}
        </div>
      </div>
    </div>
  );
}
