import { createRoot } from "react-dom/client";
import ChatbotApp from "./ChatbotApp.jsx";
// Import CSS as a raw string - we'll inject it into shadow DOM
import cssText from "./content.css?raw";

const CONTAINER_ID = "ai-chatbot-extension-root";
let root = null;
let shadowRoot = null;
let observer = null;

// Function to inject styles into shadow DOM
function injectStyles(shadowRoot) {
  const style = document.createElement("style");
  style.textContent = cssText;
  shadowRoot.appendChild(style);
}

// Function to inject the chatbot
function injectChatbot() {
  // Check if container already exists
  let container = document.getElementById(CONTAINER_ID);

  if (!container) {
    console.log("🚀 Creating new chatbot container with Shadow DOM...");

    // Create container (host element for shadow DOM)
    container = document.createElement("div");
    container.id = CONTAINER_ID;

    // Add minimal styles to the host element
    container.style.position = "fixed";
    container.style.zIndex = "2147483647"; // Maximum z-index value
    container.style.bottom = "0";
    container.style.left = "0";
    container.style.pointerEvents = "none";

    // Append to body
    document.body.appendChild(container);

    // Create shadow DOM for complete style isolation
    if (!shadowRoot) {
      shadowRoot = container.attachShadow({ mode: "open" });

      // Inject styles into shadow DOM
      injectStyles(shadowRoot);

      // Create mount point inside shadow DOM
      const shadowContainer = document.createElement("div");
      shadowContainer.id = "shadow-app-root";
      shadowContainer.style.pointerEvents = "auto"; // Re-enable pointer events for chatbot
      shadowRoot.appendChild(shadowContainer);

      // Render React app only once
      root = createRoot(shadowContainer);
      root.render(<ChatbotApp />);
      console.log("✅ ThreadSense chatbot injected with Shadow DOM isolation");
    }
  } else {
    console.log("✓ Chatbot container already exists");
  }
}

// Setup observer to watch for removal
function setupObserver() {
  if (!document.body) {
    console.log("⏳ Body not ready, waiting...");
    setTimeout(setupObserver, 10);
    return;
  }

  // Disconnect existing observer if any
  if (observer) {
    observer.disconnect();
  }

  // Watch for DOM changes and re-inject if removed
  observer = new MutationObserver((mutations) => {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
      console.warn("⚠️ Chatbot removed from DOM, re-injecting...");
      // Reset references so they can be recreated
      shadowRoot = null;
      root = null;
      setTimeout(injectChatbot, 50);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: false, // Only watch direct children of body
  });

  console.log("👁️ Observer started watching for DOM changes");
}

// Wait for DOM to be ready
function init() {
  if (document.body) {
    injectChatbot();
    setupObserver();
  } else {
    // Retry until body is available
    setTimeout(init, 10);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received:", message);

  if (message.type === "TEST") {
    sendResponse({ success: true, message: "Content script is working!" });
    return true;
  }

  // TODO: Add more message handlers as needed
});

// Start initialization
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Handle navigation in single-page apps
let lastUrl = location.href;
setInterval(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log("🔄 URL changed, checking chatbot...");
    setTimeout(injectChatbot, 200);
  }
}, 500);
