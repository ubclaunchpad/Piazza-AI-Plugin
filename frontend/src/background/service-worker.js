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

// Messaging bridge: handle REQUEST_* and return mocked *_RESULT
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (!message || message.source !== "threadsense" || typeof message.type !== "string") {
      return; // ignore unrelated or malformed messages silently
    }

    // REQUEST_SEARCH => SEARCH_RESULT
    if (message.type === "REQUEST_SEARCH") {
      console.log("TS bg: REQUEST_SEARCH", message.payload);
      const query = message?.payload?.query ?? "";
      sendResponse({
        type: "SEARCH_RESULT",
        payload: { query, results: [], echoedAt: Date.now() },
      });
      return; // sync response
    }

    // REQUEST_AI_SUMMARY => AI_SUMMARY_RESULT
    if (message.type === "REQUEST_AI_SUMMARY") {
      console.log("TS bg: REQUEST_AI_SUMMARY", message.payload);
      sendResponse({
        type: "AI_SUMMARY_RESULT",
        payload: {
          summary: "Mock summary from background",
          echoedAt: Date.now(),
        },
      });
      return; // sync response
    }

    // threadsense-scoped but unknown: ignore silently
  } catch (_) {
    // swallow errors to avoid noisy logs
  }
});
