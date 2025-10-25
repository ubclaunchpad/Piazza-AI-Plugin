const { initRoot, getRoot, teardownRoot } = window.ThreadSenseRoot;
const { renderSearchBar } = window.ThreadSenseUI;

console.log("🧠 content entry loaded");
window.piazzaAILoaded = true;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "TEST") {
    const ok = !!getRoot();
    sendResponse({ success: ok, message: ok ? "root OK" : "root missing" });
    // return false (sync). Only return true if you will reply async.
  }
});

function initThreadSense() {
  initRoot();
  console.log("Shadow root initialized");

  if (!!getRoot()) {
    renderSearchBar();
  } else {
    console.error("renderSearchBar() not found or Root missing");
  }

  console.log("🧠 ThreadSense initialized");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initThreadSense());
} else {
  initThreadSense();
}

// TODO: for the testing purpose, this is dev only should be removed for production
window.ThreadSense = { initRoot, getRoot, teardownRoot };
