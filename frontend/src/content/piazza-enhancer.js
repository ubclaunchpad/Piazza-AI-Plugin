const { initRoot, getRoot, teardownRoot } = window.ThreadSenseRoot;

console.log("🧠 content entry loaded");
window.piazzaAILoaded = true;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "TEST") {
    const ok = !!getRoot();
    sendResponse({ success: ok, message: ok ? "root OK" : "root missing" });
    // return false (sync). Only return true if you will reply async.
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initRoot());
} else {
  initRoot();
}

// TODO: for the testing purpose, this is dev only should be removed for production
window.ThreadSense = { initRoot, getRoot, teardownRoot };
