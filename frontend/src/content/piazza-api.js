console.log("🧠 Piazza AI Plugin: Content script loaded");
window.piazzaAILoaded = true;

/**
 * Extract CSRF token from the Piazza page
 */
function getCSRFToken() {
  const metaToken = document.querySelector('meta[name="csrf_token"]')?.content;
  if (metaToken) return metaToken;

  console.warn("CSRF token not found");
  return null;
}

/**
 * Extract the network (class) ID from the current Piazza URL.
 *
 * @returns {string|null} The network ID if present in the URL, otherwise null.
 *
 * @example
 * // If the URL is "https://piazza.com/class/abc123"
 * const nid = getNetworkId(); // "abc123"
 */
function getNetworkId() {
  const match = window.location.pathname.match(/\/class\/([A-Za-z0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * Make authenticated API call to Piazza
 * Uses session cookies automatically attached by the browser
 * 
 * @param {string} method - Piazza API method (e.g., "network.get_my_feed")
 * @param {object} params - Parameters for the API call
 * @returns {Promise<object>} - API response data
 */
async function callPiazzaAPI(method, params = {}) {
  const csrfToken = getCSRFToken();
  
  if (!csrfToken) {
    throw new Error("CSRF token not available");
  }

  try {
    const response = await fetch("https://piazza.com/logic/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": csrfToken,
      },
      credentials: "include", // Ensure cookies are sent
      body: JSON.stringify({
        method: method,
        params: params
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Piazza API call failed:", error);
    throw error;
  }
}

/**
 * Fetch user's feed for the current class
 */
async function fetchMyFeed() {
  const nid = getNetworkId();
  if (!nid) {
    throw new Error("Not on a class page");
  }

  console.log("Fetching feed for class:", nid);
  const data = await callPiazzaAPI("network.get_my_feed", { nid });
  console.log("Feed data:", data);
  return data;
}

/**
 * Fetch all posts for the current class
 * Note: This might be a heavy operation
 */
async function fetchAllPosts() {
  const nid = getNetworkId();
  if (!nid) {
    throw new Error("Not on a class page");
  }

  console.log("Fetching all posts for class:", nid);
  const data = await callPiazzaAPI("network.get_all_posts", { nid });
  console.log("All posts data:", data);
  return data;
}

/**
 * Fetch user profile information
 */
async function fetchUserProfile() {
  console.log("Fetching user profile");
  const data = await callPiazzaAPI("get_user_profile", {});
  console.log("User profile:", data);
  return data;
}

/**
 * Fetch statistics for the current class
 */
async function fetchClassStats() {
  const nid = getNetworkId();
  if (!nid) {
    throw new Error("Not on a class page");
  }

  console.log("Fetching class statistics:", nid);
  const data = await callPiazzaAPI("network.get_stats", { nid });
  console.log("Class stats:", data);
  return data;
}

/**
 * Send CSRF token to background script
 * Allows background script to make authenticated requests
 */
function sendCSRFToBackground() {
  const csrfToken = getCSRFToken();
  if (csrfToken) {
    chrome.runtime.sendMessage({
      type: "CSRF_TOKEN",
      token: csrfToken,
      networkId: getNetworkId()
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to send CSRF token:", chrome.runtime.lastError.message);
      } else {
        console.log("CSRF token sent successfully");
      }
    });
  } else {
    console.warn("sendCSRFToBackground: CSRF token is null or undefined. Token not sent to background script.", {
      networkId: getNetworkId()
    });
  }
}

/**
 * Send fetched data to background script for processing
 */
function sendDataToBackground(dataType, data) {
  chrome.runtime.sendMessage({
    type: "PIAZZA_DATA",
    dataType: dataType,
    data: data,
    timestamp: Date.now()
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(`Failed to send ${dataType} data:`, chrome.runtime.lastError.message);
    } else {
      console.log(`${dataType} data sent successfully`);
    }
  });
}

// Listen for messages from popup and background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received:", message);

  const handleAsync = async () => {
    try {
      switch (message.type) {
        case "TEST":
          return { success: true, message: "Content script is working!" };

        case "GET_CSRF":
          return { success: true, token: getCSRFToken(), networkId: getNetworkId() };

        case "FETCH_FEED":
          const feedData = await fetchMyFeed();
          return { success: true, data: feedData };

        case "FETCH_ALL_POSTS":
          const postsData = await fetchAllPosts();
          return { success: true, data: postsData };

        case "FETCH_USER_PROFILE":
          const profileData = await fetchUserProfile();
          return { success: true, data: profileData };

        case "FETCH_CLASS_STATS":
          const statsData = await fetchClassStats();
          return { success: true, data: statsData };

        default:
          return { success: false, error: "Unknown message type" };
      }
    } catch (error) {
      console.error("Error handling message:", error);
      return { success: false, error: error.message };
    }
  };

  handleAsync().then(sendResponse);
  return true;
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
  document.addEventListener("DOMContentLoaded", () => {
    enhance();
    sendCSRFToBackground();
  });
} else {
  enhance();
  sendCSRFToBackground();
}
