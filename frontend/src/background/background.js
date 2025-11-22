// Background script for handling extension logic
chrome.runtime.onInstalled.addListener(() => {
  console.log("ThreadSense extension installed");
});

// Handle messages from content script if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_RESPONSE") {
    // Handle chat API calls here
    sendResponse({ message: "Response from background" });
  }
  return true;
});

// (Optional) Helper for popup scripts to query preconfirmation quickly
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CHECK_PRECONFIRMED") {
    chrome.storage.local.get(["preconfirmed", "preconfirmedAt"], (data) => {
      sendResponse({
        preconfirmed: !!data.preconfirmed,
        ageMs: data.preconfirmedAt ? Date.now() - data.preconfirmedAt : null,
      });
    });
    return true; // async
  }
});
