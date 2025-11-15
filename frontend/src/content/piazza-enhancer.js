/**
 * Simple Content Script for Piazza AI Plugin
 */
import "./piazza-styles.css";
console.log("🧠 Piazza AI Plugin: Content script loaded");

// Set a flag to indicate this script is loaded
window.piazzaAILoaded = true;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received:", message);

  if (message.type === "TEST") {
    sendResponse({ success: true, message: "Content script is working!" });
    return true;
  }

  // TODO: Add more message handlers as needed
});

// Simple page enhancement
function enhance() {
  // Add a small indicator that the extension is active
  const indicator = document.createElement("div");
  indicator.innerHTML = "🧠 AI";
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  `;

  document.body.appendChild(indicator);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.remove();
    }
  }, 3000);
}

// Run enhancement when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enhance);
} else {
  enhance();
}
