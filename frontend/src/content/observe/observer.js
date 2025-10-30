/**
 * ThreadSense DOM Observer (Content Script)
 * - Observes document.body (childList + subtree)
 * - Debounces notifications to ~200ms
 * - Starts only when the ThreadSense root exists
 * - Auto-stops via ThreadSenseRoot.registerCleanup
 */

(function () {
  const Contracts = window.ThreadSenseContracts || {};
  const Root = window.ThreadSenseRoot || {};
  const ROOT_ID = Contracts?.DOM_IDS?.ROOT_ID || "threadsense-root";

  let observer = null;
  let running = false;
  let pending = 0;
  let timer = null;
  const callbacks = new Set();

  function hasRoot() {
    return !!document.getElementById(ROOT_ID);
  }

  function flush() {
    const count = pending;
    pending = 0;
    for (const cb of callbacks) {
      try { cb({ mutationCount: count, at: Date.now() }); } catch (_) {}
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!hasRoot()) { stop(); return; }
      flush();
    }, 200);
  }

  function start() {
    if (running) return false;
    if (!hasRoot()) return false;

    try {
      observer = new MutationObserver((mutations) => {
        pending += mutations?.length || 0;
        schedule();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      running = true;
      console.log("TS observe: started");

      try { Root.registerCleanup?.(() => stop()); } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }

  function stop() {
    if (!running) return false;
    try { observer?.disconnect?.(); } catch (_) {}
    observer = null;
    running = false;
    pending = 0;
    if (timer) { clearTimeout(timer); timer = null; }
    console.log("TS observe: stopped");
    return true;
  }

  function onDomChanged(cb) {
    if (typeof cb === "function") callbacks.add(cb);
    return () => offDomChanged(cb);
  }

  function offDomChanged(cb) {
    callbacks.delete(cb);
  }

  window.ThreadSenseObserver = { start, stop, onDomChanged, offDomChanged };
})();

