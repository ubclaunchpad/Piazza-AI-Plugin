import React from "react";
import { createRoot } from "react-dom/client";
import InjectedEventButton from "./InjectedEventButton.jsx";
import calendarInjectCss from "./calendarInject.css?raw";

const MOUNT_WRAPPER_CLASS = "piazza-ai-calendar-mount";

let calendarStylesInjected = false;

function ensureCalendarInjectStyles() {
  if (calendarStylesInjected || typeof document === "undefined") return;
  calendarStylesInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-piazza-ai-calendar-styles", "1");
  style.textContent = calendarInjectCss;
  (document.head || document.documentElement).appendChild(style);
}

function parsePostNumberFromHeader(header) {
  if (!header) return null;
  const button = header.querySelector("span button");
  const raw = button?.textContent;
  if (!raw) return null;

  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const candidate = lines[lines.length - 1] ?? null;
  if (!candidate) return null;

  const cleaned = candidate.replace(/^@+/, "").trim();
  return cleaned || null;
}

/**
 * Resolve @post number for the column that contains this article (split view safe).
 */
export function getThreadIdForArticle(articleElement) {
  if (!articleElement) return null;
  const container = articleElement.closest("div#qanda-content");
  if (container) {
    const fromColumn = parsePostNumberFromHeader(
      container.querySelector("header#post-header"),
    );
    if (fromColumn) return fromColumn;
  }
  return parsePostNumberFromHeader(
    document.querySelector("header#post-header"),
  );
}

export function getCurrentThreadArticleElement() {
  const container = document.querySelector("div#qanda-content");
  if (!container) return null;
  return container.querySelector("article#qaContentViewId");
}

export function getCurrentThreadId() {
  return parsePostNumberFromHeader(
    document.querySelector("header#post-header"),
  );
}

/**
 * Piazza post / conversation id from ?cid=… (same signal the popup uses as postId).
 */
export function getPiazzaCidFromLocation() {
  try {
    const cid = new URL(window.location.href).searchParams.get("cid");
    if (cid == null) return null;
    const t = String(cid).trim();
    return t !== "" ? t : null;
  } catch {
    return null;
  }
}

/**
 * Read structured text from a specific post article (not always the first column).
 */
export function readArticleContent(articleElement) {
  if (!articleElement) return null;

  const summaryEl = articleElement.querySelector("h2#postViewSummaryId");
  const updateTextEl = articleElement.querySelector("div.update_text");
  const updateTimeEl = updateTextEl
    ? updateTextEl.querySelector("time[datetime]")
    : null;
  const bodyEl = articleElement.querySelector('[data-id="renderHtmlId"]');

  const threadFromDom = getThreadIdForArticle(articleElement);
  const threadFromUrl = getPiazzaCidFromLocation();

  return {
    threadId: threadFromDom ?? threadFromUrl,
    piazzaCourseId: getPiazzaCourseIdFromLocation(),
    threadSummary: summaryEl ? summaryEl.innerText.trim() : null,
    threadUpdatedAt: updateTimeEl
      ? updateTimeEl.getAttribute("datetime")?.trim() || null
      : null,
    threadContent: bodyEl ? bodyEl.innerText.trim() : null,
  };
}

export function readCurrentThreadArticleContent() {
  const article = getCurrentThreadArticleElement();
  return readArticleContent(article);
}

/**
 * Piazza class / network id (text) from the URL.
 * Handles /class/{networkId}/… and hash routes like #/class/{networkId}/…
 */
export function getPiazzaCourseIdFromLocation() {
  try {
    const { pathname, hash } = window.location;

    const fromPath = (p) => {
      const m = p.match(/\/class\/([^/?#]+)/i);
      return m && m[1] ? decodeURIComponent(m[1].trim()) : null;
    };

    let id = fromPath(pathname);
    if (id) return id;

    if (hash) {
      id = fromPath(hash);
      if (id) return id;
    }

    const pathParts = pathname.split("/").filter(Boolean);
    if (pathParts[0] === "class" && pathParts[1]) {
      return decodeURIComponent(pathParts[1].trim());
    }

    // Match popup Dashboard: second segment as class id on older paths
    if (pathParts.length >= 2 && pathParts[1]) {
      return decodeURIComponent(pathParts[1].trim());
    }

    return null;
  } catch {
    return null;
  }
}

export default function injectEventButtonToPosts() {
  ensureCalendarInjectStyles();
  const containers = document.querySelectorAll("div#qanda-content");

  containers.forEach((container) => {
    const article = container.querySelector("article#qaContentViewId");
    if (!article || article.querySelector(`.${MOUNT_WRAPPER_CLASS}`)) {
      return;
    }
    const mountDiv = document.createElement("div");
    mountDiv.className = MOUNT_WRAPPER_CLASS;
    article.appendChild(mountDiv);
    createRoot(mountDiv).render(<InjectedEventButton article={article} />);
  });
}
