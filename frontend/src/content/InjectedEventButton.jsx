import React, { useEffect, useState } from "react";
import {
  readArticleContent,
  getPiazzaCourseIdFromLocation,
  getPiazzaCidFromLocation,
} from "./injectEventButton.js";
import {
  fingerprintArticleContent,
  getCachedParse,
  setCachedParse,
} from "./parseCache.js";

const CONFIDENCE_THRESHOLD = 0.7;
const PARSE_DEBOUNCE_MS = 280;

const API_ENDPOINT = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";

function CalendarIcon({ variant = "default" }) {
  return (
    <svg
      className={`piazza-ai-calendar-icon piazza-ai-calendar-icon--${variant}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/**
 * JSON body for POST /calendar/events — aligns with backend AddEventRequest:
 * title, start_time, end_time, piazza_course_id?, source_post_number?,
 * source_context?, reminder_settings?
 */
function buildAddEventRequestBody(suggestion, articleContent, piazzaCourseId) {
  const body = {
    title: suggestion.event_name,
    start_time: suggestion.start_time,
    end_time: suggestion.end_time,
  };

  const courseRaw =
    piazzaCourseId ??
    articleContent?.piazzaCourseId ??
    getPiazzaCourseIdFromLocation();
  if (courseRaw != null && String(courseRaw).trim() !== "") {
    body.piazza_course_id = String(courseRaw).trim();
  }

  const postNr = articleContent?.threadId ?? getPiazzaCidFromLocation();
  if (postNr != null && String(postNr).trim() !== "") {
    body.source_post_number = String(postNr).trim();
  }

  const sc = {};
  if (
    articleContent?.threadSummary != null &&
    articleContent.threadSummary !== ""
  ) {
    sc.thread_summary = articleContent.threadSummary;
  }
  if (
    articleContent?.threadUpdatedAt != null &&
    articleContent.threadUpdatedAt !== ""
  ) {
    sc.thread_updated_at = articleContent.threadUpdatedAt;
  }
  if (Object.keys(sc).length > 0) {
    body.source_context = sc;
  }

  const reminder_settings = {};
  if (suggestion.event_type != null && suggestion.event_type !== "") {
    reminder_settings.event_type = suggestion.event_type;
  }
  if (suggestion.confidence != null && Number.isFinite(suggestion.confidence)) {
    reminder_settings.confidence = suggestion.confidence;
  }
  if (suggestion.display_text != null && suggestion.display_text !== "") {
    reminder_settings.parsed_display_text = suggestion.display_text;
  }
  if (typeof window !== "undefined" && window.location?.href) {
    reminder_settings.piazza_page_url = window.location.href;
  }
  if (Object.keys(reminder_settings).length > 0) {
    body.reminder_settings = reminder_settings;
  }

  return body;
}

export default function InjectedEventButton({ article }) {
  const [parsePhase, setParsePhase] = useState("checking");
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    if (!article || !(article instanceof Element)) {
      setParsePhase("done");
      return;
    }

    let cancelled = false;
    const ac = new AbortController();

    const timer = setTimeout(async () => {
      const content = readArticleContent(article);
      if (!content || cancelled) {
        setParsePhase("done");
        return;
      }

      const fp = fingerprintArticleContent(content);
      const cached = getCachedParse(fp);
      if (cached !== undefined) {
        if (!cancelled) {
          setSuggestion(cached);
          setParsePhase("done");
        }
        return;
      }

      try {
        const response = await fetch(
          `${API_ENDPOINT}/calendar/events/parse-thread`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: JSON.stringify(content),
            }),
            signal: ac.signal,
          },
        );

        if (cancelled) return;

        const data = await response.json();
        const parsed = data?.parsed_event ?? null;
        const confidence = parsed?.confidence ?? data?.confidence ?? 0;

        let next = null;
        if (parsed && confidence >= CONFIDENCE_THRESHOLD) {
          next = {
            event_name: parsed.event_name,
            event_type: parsed.event_type,
            start_time: parsed.start_time,
            end_time: parsed.end_time,
            display_text: parsed.display_text,
            confidence,
          };
        }

        setCachedParse(fp, next);
        setSuggestion(next);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch suggested event:", err);
        setSuggestion(null);
      } finally {
        if (!cancelled) {
          setParsePhase("done");
        }
      }
    }, PARSE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      ac.abort();
    };
  }, [article]);

  const handleClick = async () => {
    setStatus("loading");

    chrome.storage.local.get(["authToken"], async (result) => {
      const token = result.authToken;

      if (!token) {
        console.warn("No auth token found");
        setStatus("error");
        return;
      }

      if (!suggestion) {
        console.warn("No event suggestion available");
        setStatus("error");
        return;
      }

      try {
        const content = readArticleContent(article);
        const piazzaCourseId = getPiazzaCourseIdFromLocation();
        const payload = buildAddEventRequestBody(
          suggestion,
          content,
          piazzaCourseId,
        );

        const response = await fetch(`${API_ENDPOINT}/calendar/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => null);

        if (data && data.action === "link_required") {
          window.location.href = `${API_ENDPOINT}/calendar/auth`;
          return;
        }

        if (response.ok && data && data.status === "event_created") {
          setStatus("success");
        } else {
          console.error("Failed to create event", {
            status: response.status,
            data,
          });
          setStatus("error");
          setErrorMessage(data?.detail ?? "Failed to create event");
        }
      } catch (error) {
        console.error("Error while creating event", error);
        setStatus("error");
      }
    });
  };

  if (parsePhase === "checking") {
    return (
      <div className="piazza-ai-calendar-checking" aria-live="polite">
        Checking for dates…
      </div>
    );
  }

  if (!suggestion) {
    return null;
  }

  const labelText =
    suggestion.display_text ||
    `Possible ${suggestion.event_type ?? "event"}: ${
      suggestion.event_name ?? "Unnamed"
    }`;

  const variant =
    status === "success" ? "success" : status === "error" ? "error" : "idle";

  return (
    <button
      type="button"
      className={`piazza-ai-calendar-btn piazza-ai-calendar-btn--${variant}`}
      onClick={handleClick}
      disabled={status === "loading"}
    >
      {status === "success" ? (
        <>
          <CalendarIcon variant="success" />
          <span>Event added to Google Calendar</span>
        </>
      ) : status === "error" ? (
        <>
          <CalendarIcon variant="error" />
          <span>Failed to add event: {errorMessage}</span>
        </>
      ) : (
        <>
          <CalendarIcon variant="default" />
          <span>{labelText}</span>
        </>
      )}
    </button>
  );
}
