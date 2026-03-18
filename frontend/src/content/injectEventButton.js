import React from "react";
import { createRoot } from "react-dom/client";
import InjectedEventButton from "./InjectedEventButton.jsx";

export function getCurrentThreadArticleElement() {
  const container = document.querySelector("div#qanda-content");
  if (!container) return null;
  return container.querySelector("article#qaContentViewId");
}

export function getCurrentThreadId() {
  const header = document.querySelector("header#post-header");
  if (!header) return null;

  const button = header.querySelector("span button");
  const raw = button?.textContent;
  if (!raw) return null;

  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Handles either two-line format ("@" then "252") or single token ("@252")
  const candidate = lines[lines.length - 1] ?? null;
  if (!candidate) return null;

  const cleaned = candidate.replace(/^@+/, "").trim();
  return cleaned || null;
}

export function readCurrentThreadArticleContent() {
  const article = getCurrentThreadArticleElement();
  if (!article) return null;

  const summaryEl = article.querySelector("h2#postViewSummaryId");
  const updateTextEl = article.querySelector("div.update_text");
  const updateTimeEl = updateTextEl
    ? updateTextEl.querySelector("time[datetime]")
    : null;
  const bodyEl = article.querySelector('[data-id="renderHtmlId"]');

  return {
    threadId: getCurrentThreadId(),
    threadSummary: summaryEl ? summaryEl.innerText.trim() : null,
    threadUpdatedAt: updateTimeEl
      ? updateTimeEl.getAttribute("datetime")?.trim() || null
      : null,
    threadContent: bodyEl ? bodyEl.innerText.trim() : null,
  };
}

export default function injectEventButtonToPosts() {
  const containers = document.querySelectorAll("div#qanda-content");

  containers.forEach((container) => {
    const article = container.querySelector("article#qaContentViewId");
    if (article && !article.querySelector(".my-injected-link")) {
      const mountDiv = document.createElement("div");
      article.appendChild(mountDiv);
      createRoot(mountDiv).render(<InjectedEventButton />);
    }
  });
}
