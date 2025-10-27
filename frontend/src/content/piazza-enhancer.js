const { initRoot, getRoot, teardownAllRoots } = window.ThreadSenseRoot;
const { renderSearchBar } = window.ThreadSenseUI;
const { STORAGE_KEYS } = window.ThreadSenseContracts;

console.log("🧠 content entry loaded");
window.piazzaAILoaded = true;

// TS : thread Sense State
if (!window.__TS__) window.__TS__ = { initing: false }; 

function hasRoot() { return !!getRoot?.(); }  // TODO ? 

function safeInit() {
  if (window.__TS__.initing) return;
  if (hasRoot()) return;
  window.__TS__.initing = true;
  try {
    initRoot();
    if (hasRoot()) {
      renderSearchBar();
      console.log("Shadow root initialized");
    }
    else {
      console.error("renderSearchBar() not found or Root missing");
    }
  } finally {
    window.__TS__.initing = false;
  }
}
function safeTeardown() {
  try { teardownAllRoots?.(); } catch {}
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "TEST") {
    const ok = !!getRoot();
    sendResponse({ success: ok, message: ok ? "root OK" : "root missing" });
    // return false (sync). Only return true if you will reply async.
  }

  if (msg?.type === "TS_TOGGLE") {
      msg.enabled ? safeInit() : safeTeardown();
    }  

});

async function initThreadSense() {
  const res = await chrome.storage.sync.get({ [STORAGE_KEYS.ENABLED]: true });
  const enabled = !!res[STORAGE_KEYS.ENABLED];
  enabled ? safeInit() : safeTeardown();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initThreadSense());
} else {
  initThreadSense();
}

// TODO: for the testing purpose, this is dev only should be removed for production
window.ThreadSense = { initRoot, getRoot, teardownAllRoots };
