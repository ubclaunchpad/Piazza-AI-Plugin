/**
 * Create (if missing) and return the extension's Shadow DOM root.
 * Also renders a temporary badge for visibility in dev mode.
 */

// shadow dom root registry 
const CREATED_ROOT_IDS = new Set();  

(function () {

  const DOM_IDS = window.ThreadSenseContracts.DOM_IDS;

  /**
   * Creates a shadow dom root with rootID placed after beforeNode
   * @param rootID - id for root container
   * @param beforeNode - root will be positioned after this node
   * @returns 
   */
  function initRoot(rootID, beforeNode) {
    const id = rootID ? rootID : DOM_IDS.ROOT_ID;

    if (!Object.values(DOM_IDS).includes(id)) {
      console.error(`initRoot: DOM_IDS does not contain key '${id}'`);
      return null;
    }

    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement("div");
      host.id = id;

      let parentNode = document.body;
      let referenceNode = null;

      if (beforeNode) {
        referenceNode = document.querySelector(beforeNode);
        parentNode = referenceNode ? referenceNode.parentNode : null;
      }

      parentNode.insertBefore(host, referenceNode?.nextSibling);
    }

    // add to shadow registry 
    CREATED_ROOT_IDS.add(host.id);

    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
      
    // TODO: temporary dev badge remove this in production
    if (!shadow.querySelector("[data-ts-badge]")) {
      const badge = document.createElement("div");
      badge.setAttribute("data-ts-badge", "true");
      badge.textContent = "🧠 AI";
      badge.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg,#667eea 0%,#764ba2 100%);
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        z-index: 2147483647;
        font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
        pointer-events: none;
      `;
      shadow.appendChild(badge);
      setTimeout(() => badge.remove(), 3000);
    }

    return shadow;
  }

  /**
   * Return the existing shadowRoot, or null if not initialized.
   */
  function getRoot(rootID) {
    const id = rootID ? rootID : DOM_IDS.ROOT_ID;
    return document.getElementById(id)?.shadowRoot ?? null;
  }

  /**
   * Cleanup registry for teardown callbacks 
   */
  const __cleanups = new Set();
  function registerCleanup(fn) {
    if (typeof fn === "function") __cleanups.add(fn);
    return () => __cleanups.delete(fn);
  }

  function runCleanups() {
    for (const fn of __cleanups) {
      try { fn(); } catch (_) {}
    }
    __cleanups.clear();
  }

  function teardownRootById(rootID) {
    try { document.getElementById(rootID)?.remove(); } catch(_) {}
    CREATED_ROOT_IDS.delete(rootID);
    return null;
  }

  /**
   * Remove the shadow host and run cleanup callbacks.
   */
  function teardownAllRoots() {
    runCleanups();
    for (const id of Array.from(CREATED_ROOT_IDS)) {
      teardownRootById(id);
    }
    return null;
  }

  window.ThreadSenseRoot = { initRoot, getRoot, teardownAllRoots, registerCleanup };
})();