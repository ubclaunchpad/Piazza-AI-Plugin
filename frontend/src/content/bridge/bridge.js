/**
 * ThreadSense Messaging Bridge (Content Script)
 * - Listens to page -> content via window.postMessage
 * 
 * - Forwards valid REQUEST_* events to background via chrome.runtime.sendMessage
 *  Example:
 * window.postMessage({
 * source: "threadsense",
 * type: "REQUEST_SEARCH",
 * payload: { query: "test" }
 * });
 * 
 * - Re-posts background responses back to the page context
 */



(function () {
  const Contracts = window.ThreadSenseContracts || {};
  const { TS_NS, isTsEvent } = Contracts;

  function isRequestType(type) {
    return typeof type === "string" && type.startsWith("REQUEST_");
  }

  // Page -> Content entry
  window.addEventListener("message", (evt) => {
    const msg = evt?.data;

    // Only accept ThreadSense events and REQUEST_* types
    if (!isTsEvent?.(msg)) return;
    if (!isRequestType(msg.type)) return;

    try {
      console.log(`TS bridge: forward ${msg.type}`, msg.payload ?? {});
      chrome.runtime.sendMessage(msg, (response) => {
        // Ignore errors and unrelated responses silently
        if (chrome?.runtime?.lastError) return;
        if (!response || typeof response !== "object" || typeof response.type !== "string") return;

        try {
          console.log(`TS bridge: post back ${response.type}`, response.payload ?? {});
          window.postMessage({ source: TS_NS, ...response }, "*");
        } catch (_) {
          // Swallow posting errors
        }
      });
    } catch (_) {
      // Swallow forwarding errors
    }
  });
})();

