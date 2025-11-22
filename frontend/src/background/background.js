// Background script for handling extension logic
chrome.runtime.onInstalled.addListener(() => {
  console.log("ThreadSense extension installed");
});

// Handle messages from content script if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_RESPONSE") {
    // Handle chat API calls here
    sendResponse({ message: "Response from background" });
    return true;
  }

  if (request.type === "GET_PIAZZA_COOKIE") {
    // Use chrome.cookies API to get all Piazza cookies (including HttpOnly ones)
    const requiredCookies = [
      "AWSALB",
      "AWSALBCORS",
      "last_piaz_user",
      "piazza_session",
      "session_id",
    ];

    // Get all cookies for piazza.com domain
    chrome.cookies.getAll({ domain: "piazza.com" }, (cookies) => {
      const piazzaCookies = {};

      // Filter and extract required cookies
      cookies.forEach((cookie) => {
        if (requiredCookies.includes(cookie.name)) {
          piazzaCookies[cookie.name] = cookie.value;
        }
      });

      // Format cookies as a single cookie string for the API
      const cookieString = Object.entries(piazzaCookies)
        .map(([name, value]) => `${name}=${value}`)
        .join(";\n");

      sendResponse({
        success: true,
        cookie: cookieString,
        cookieData: piazzaCookies,
      });
    });

    return true; // Keep message channel open for async response
  }

  return true;
});
