import { createRoot } from "react-dom/client";
import ChatbotApp from "./ChatbotApp.jsx";
import injectEventButtonToPosts, {
  readArticleContent,
} from "./injectEventButton.js";

const API_ENDPOINT = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";
// Import CSS as a raw string - we'll inject it into shadow DOM
import cssText from "./content.css?raw";
import { initPostInjector } from "./PostInjector.jsx";

const CONTAINER_ID = "ai-chatbot-extension-root";
const FIND_SIMILAR_BUTTON_ID = "threadsense-find-similar-button";
const PAGE_STYLE_ID = "threadsense-page-styles";
let root = null;
let shadowRoot = null;
let observer = null;
let feedObserver = null;
let injectDebounceTimer = null;

function scheduleInjectEventButtons() {
  clearTimeout(injectDebounceTimer);
  injectDebounceTimer = setTimeout(() => {
    injectEventButtonToPosts();
  }, 350);
}

async function sendArticleContentToBackend(content) {
  try {
    await fetch(`${API_ENDPOINT}/calendar/extract-dates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: content,
      }),
    });
  } catch (err) {
    console.error("Failed to send thread context to backend:", err);
  }
}

function publishVisibleThreadArticles() {
  const containers = document.querySelectorAll("div#qanda-content");
  let any = false;
  containers.forEach((container) => {
    const article = container.querySelector("article#qaContentViewId");
    if (!article) return;
    const content = readArticleContent(article);
    if (!content) return;
    any = true;
    console.log("PIAZZA thread article:", content);
    sendArticleContentToBackend(content);
  });
  return any;
}

// Function to inject styles into shadow DOM
function injectStyles(shadowRoot) {
  // Add KaTeX CSS via link tag (since @import doesn't work in Shadow DOM when injected as text)
  const katexLink = document.createElement("link");
  katexLink.rel = "stylesheet";
  katexLink.href =
    "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
  katexLink.crossOrigin = "anonymous";
  shadowRoot.appendChild(katexLink);

  // Add our custom styles
  const style = document.createElement("style");
  style.textContent = cssText;
  shadowRoot.appendChild(style);

  // Log to verify KaTeX is loading
  katexLink.onload = () => console.log("✅ KaTeX CSS loaded in Shadow DOM");
  katexLink.onerror = () => console.error("❌ Failed to load KaTeX CSS");
}

function ensurePageStyles() {
  if (document.getElementById(PAGE_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = PAGE_STYLE_ID;
  style.textContent = `
    .threadsense-find-similar {
      margin-top: 10px;
      margin-left: 8px;
      border: 1px solid #dbe4ff;
      background: #f7faff;
      color: #1d4ed8;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      position: relative;
      z-index: 10;
    }

    .threadsense-find-similar:hover {
      background: #eef4ff;
      border-color: #bfd2ff;
      transform: translateY(-1px);
    }

    .threadsense-find-similar-host {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
  `;
  document.head.appendChild(style);
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

function getCurrentPostId() {
  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("cid");
    if (fromQuery) return fromQuery;

    const pathnameMatch = url.pathname.match(/\/post\/([^/?#]+)/);
    if (pathnameMatch) return pathnameMatch[1];

    const hashMatch = url.hash.match(/cid=([^&]+)/);
    if (hashMatch) return hashMatch[1];

    return null;
  } catch (_) {
    return null;
  }
}

function findPostActionAnchor() {
  const selectors = [
    ".post_region_center",
    ".post_region_text",
    ".post_region_content",
    ".post_content",
    ".post_body",
    ".post_region .actions_bar",
    ".post_region .post_actions",
    ".post_region .post_tags",
    ".post_region .history_controls",
    ".post_region .history",
    "#id_post_region .actions_bar",
    "#id_post_region .post_actions",
    "#id_post_region .history",
    ".post_region",
    "#id_post_region",
    "#piazza_page .post_region",
    "#piazza_page .post_content",
    '[class*="post_region"]',
    '[class*="post_content"]',
    '[id*="post_region"]',
  ];

  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node && node.offsetParent !== null) {
      return node;
    }
  }

  return null;
}

function injectFindSimilarButton() {
  const existing = document.getElementById(FIND_SIMILAR_BUTTON_ID);
  if (existing) {
    existing.parentElement?.remove();
  }

  const postId = getCurrentPostId();
  const anchor = findPostActionAnchor();

  if (!postId || !anchor) return;

  ensurePageStyles();

  const host = document.createElement("div");
  host.className = "threadsense-find-similar-host";

  const button = document.createElement("button");
  button.id = FIND_SIMILAR_BUTTON_ID;
  button.type = "button";
  button.className = "threadsense-find-similar";
  button.textContent = "Find similar";
  button.addEventListener("click", () => {
    window.dispatchEvent(
      new CustomEvent("threadsense-find-similar", {
        detail: { postId },
      })
    );
  });

  host.appendChild(button);

  if (
    anchor.matches(
      ".post_region, #id_post_region, .post_region_center, .post_region_text, .post_region_content, .post_content, .post_body, [class*='post_region'], [class*='post_content'], [id*='post_region']"
    )
  ) {
    anchor.prepend(host);
  } else {
    anchor.appendChild(host);
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
      setTimeout(injectEventButtonToPosts, 50);
    }

    setTimeout(injectFindSimilarButton, 100);
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("👁️ Observer started watching for DOM changes");
}

function setupFeedObserver() {
  if (!document.body) return;
  if (feedObserver) {
    feedObserver.disconnect();
  }
  feedObserver = new MutationObserver(() => {
    scheduleInjectEventButtons();
  });
  feedObserver.observe(document.body, { childList: true, subtree: true });
}

// Wait for DOM to be ready
function init() {
  if (document.body) {
    ensurePageStyles();
    injectChatbot();
    injectFindSimilarButton();
    injectEventButtonToPosts();
    setTimeout(publishVisibleThreadArticles, 200);
    setupObserver();
    initPostInjector();
    setupFeedObserver();
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

  if (message.type === "GET_PIAZZA_INFO") {
    // Get the thread name from the Piazza page
    const threadNameElement = document.querySelector(
      "#topbar_current_class_number",
    );
    const threadName = threadNameElement
      ? threadNameElement.textContent.trim()
      : null;

    sendResponse({
      success: true,
      threadName: threadName,
    });
    return true;
  }

  if (message.type === "GET_PIAZZA_COOKIE") {
    // Forward request to background script since it has access to chrome.cookies API
    chrome.runtime.sendMessage({ type: "GET_PIAZZA_COOKIE" }, (response) => {
      sendResponse(response);
    });
    return true; // Keep message channel open for async response
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
    console.log("URL changed, checking chatbot...");
    setTimeout(injectChatbot, 200);
    setTimeout(injectFindSimilarButton, 250);
    setTimeout(injectEventButtonToPosts, 200);
    setTimeout(scheduleInjectEventButtons, 400);
  }
}, 500);
