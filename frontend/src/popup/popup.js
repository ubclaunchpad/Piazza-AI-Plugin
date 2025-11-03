/**
 * Simple Popup Controller
 */
document.addEventListener("DOMContentLoaded", () => {
  // Load configuration
  const config = window.ExtensionConfig || {
    get: (key) => {
      // These should match your .env values as fallbacks
      const defaults = {
        API_BASE_URL:
          window.EXTENSION_ENV?.API_BASE_URL || "http://localhost:8000",
        VERSION: window.EXTENSION_ENV?.VERSION || "1.0.0",
        NODE_ENV: window.EXTENSION_ENV?.NODE_ENV || "development",
      };
      return defaults[key];
    },
    getApiUrl: (endpoint) => {
      const baseUrl =
        window.EXTENSION_ENV?.API_BASE_URL || "http://localhost:8000";
      return endpoint ? `${baseUrl}/${endpoint.replace(/^\//, "")}` : baseUrl;
    },
    isDevelopment: () =>
      (window.EXTENSION_ENV?.NODE_ENV || "development") === "development",
  };

  const testBtn = document.getElementById("testBtn");
  const status = document.getElementById("status");
  const versionElement = document.getElementById("version");
  const tsToggle = document.getElementById("tsToggle");

  // Set version from config
  if (versionElement) {
    versionElement.textContent = `v${config.get("VERSION")}`;
  }

  // chrome sync toggle option
  chrome.storage.sync.get({ ts_enabled: true }, ({ ts_enabled }) => {  
    if (tsToggle) tsToggle.checked = !!ts_enabled;
  });

  tsToggle?.addEventListener("change", async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.sync.set({ ts_enabled: enabled});

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    if (tab?.url.includes("piazza.com")) {
      chrome.tabs.sendMessage(tab.id, { type: "TS_TOGGLE", enabled }).catch(() => {});
    }
  })

  testBtn.addEventListener("click", async () => {
    status.textContent = "Testing...";

    try {
      // Check if we're on Piazza
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (config.isDevelopment()) {
        console.log("Active tab:", tab.url);
      }

      const isPiazza = tab.url && tab.url.includes("piazza.com");

      if (isPiazza) {
        // First, try to inject the content script if it's not already loaded
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // Simple test to see if content script is loaded
              return window.piazzaAILoaded || false;
            },
          });
        } catch (injectionError) {
          console.log("Script injection check failed:", injectionError);
        }

        // Send message to content script with proper error handling
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: "TEST",
          });
          status.textContent = response
            ? "✅ Extension working!"
            : "⚠️ Content script not responding";
        } catch (error) {
          // Check if it's a connection error (content script not loaded)
          if (
            error.message &&
            error.message.includes("Could not establish connection")
          ) {
            status.textContent =
              "⚠️ Content script not loaded - try refreshing Piazza";
          } else {
            status.textContent = "❌ Communication error";
            console.error("Message error:", error);
          }
        }
      } else {
        status.textContent = "ℹ️ Please navigate to a Piazza page";
      }
    } catch (error) {
      status.textContent = "❌ Test failed";
      console.error("Test error:", error);
    }
  });
});
