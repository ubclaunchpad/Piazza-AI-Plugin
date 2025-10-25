// src/content/contracts.js
(function () {
  /**
   * ThreadSense Shared Contracts
   * -----------------------------
   * Defines shared constants and event types used across content scripts
   * and injected UI. Keeps all identifiers centralized to avoid drift.
   */

  // Global namespace tag
  const TS_NS = "threadsense";

  // Event types shared between content scripts and injected UI
  const EVENT_TYPES = {
    REQUEST_SEARCH: "REQUEST_SEARCH",
    REQUEST_AI_SUMMARY: "REQUEST_AI_SUMMARY",
    REQUEST_AI_SUGGESTION: "REQUEST_AI_SUGGESTION",
    SEARCH_RESULT: "SEARCH_RESULT",
    AI_SUMMARY_RESULT: "AI_SUMMARY_RESULT",
  };

  // DOM identifiers used for locating or preventing duplicate injections
  const DOM_IDS = {
    ROOT_ID: "threadsense-root",
    SEARCHBAR_ID: "threadsense-search-bar",
    RESPONSECARD_ID: "threadsense-response-card",
    CARD_ATTR: "data-threadsense-card",
  };

  // Storage keys for user preferences and toggles
  const STORAGE_KEYS = {
    ENABLED: "ts_enabled",
  };

  // Utility to verify if a message belongs to ThreadSense namespace
  function isTsEvent(msg) {
    return msg && msg.source === TS_NS && typeof msg.type === "string";
  }

  // Expose everything to the global namespace so other scripts can access it
  window.ThreadSenseContracts = {
    TS_NS,
    EVENT_TYPES,
    DOM_IDS,
    STORAGE_KEYS,
    isTsEvent,
  };
})();
