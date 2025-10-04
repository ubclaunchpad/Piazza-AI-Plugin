/**
 * Simple Background Service Worker
 */

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Piazza AI Plugin installed:", details.reason);

  if (details.reason === "install") {
    console.log("Welcome to Piazza AI Plugin!");
  }
});

// Handle basic messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received:", message.type);

  // Simple echo for testing
  sendResponse({ received: true, timestamp: Date.now() });
});
