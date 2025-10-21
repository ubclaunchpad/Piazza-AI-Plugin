/**
 * ThreadSense Shared Contracts
 * -----------------------------
 * Shared constants and event definitions used by both A (Platform/Infra)
 * and B (UI Injection). Contains no runtime logic.
 *
 * Purpose:
 * - Avoid naming drift between modules
 * - Keep all shared event names, DOM identifiers, and storage keys in one place
 *
 * Note:
 * Currently used only within the Content Injection Scripts feature.
 * Safe to extend as new shared events or constants are added.
 */

// Namespace to tag all ThreadSense events
export const TS_NS = "threadsense";

/**
 * Event types shared between content scripts and injected UI.
 * These act as “message names” across A and B.
 */
export const EVENT_TYPES = {
  REQUEST_SEARCH: "REQUEST_SEARCH",
  REQUEST_AI_SUMMARY: "REQUEST_AI_SUMMARY",
  REQUEST_AI_SUGGESTION: "REQUEST_AI_SUGGESTION",
  SEARCH_RESULT: "SEARCH_RESULT",
  AI_SUMMARY_RESULT: "AI_SUMMARY_RESULT",
};

/**
 * DOM identifiers — used for locating or preventing duplicate injections.
 */
export const DOM_IDS = {
  ROOT_ID: "threadsense-root",              // Shadow DOM root container
  CARD_ATTR: "data-threadsense-card",       // Marks injected AI summary cards
};

/**
 * Storage keys for user preferences, toggles, etc.
 */
export const STORAGE_KEYS = {
  ENABLED: "ts_enabled",                    // whether ThreadSense UI is active
};

/**
 * Utility: quick check to confirm if a window message belongs to ThreadSense.
 */
export function isTsEvent(msg) {
  return msg && msg.source === TS_NS && typeof msg.type === "string";
}
