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
  const [suggestions, setSuggestions] = useState([]);
  const [eventStatuses, setEventStatuses] = useState({});
  const [eventErrors, setEventErrors] = useState({});
  const [eventLinks, setEventLinks] = useState({});

  const getSuggestionKey = (item) =>
    `${item?.start_time ?? ""}|${item?.end_time ?? ""}|${item?.event_name ?? ""}`;

  const toEpoch = (value) => {
    if (!value) return null;
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? null : ts;
  };

  const sameInstant = (a, b) => {
    const ta = toEpoch(a);
    const tb = toEpoch(b);
    if (ta != null && tb != null) return ta === tb;
    return String(a ?? "") === String(b ?? "");
  };

  const suggestionMatchesExisting = (suggestion, existing) => {
    const existingTitle = existing?.title ?? existing?.event_name ?? "";
    const existingStart = existing?.event_start_at ?? existing?.start_time ?? "";
    const existingEnd = existing?.event_end_at ?? existing?.end_time ?? "";
    return (
      String(suggestion?.event_name ?? "").trim() === String(existingTitle).trim() &&
      sameInstant(suggestion?.start_time, existingStart) &&
      sameInstant(suggestion?.end_time, existingEnd)
    );
  };

  const markExistingSuggestions = (nextSuggestions, existingEvents) => {
    const nextStatuses = {};
    const nextLinks = {};
    for (const item of nextSuggestions) {
      const key = getSuggestionKey(item);
      const match = existingEvents.find((evt) => suggestionMatchesExisting(item, evt));
      if (match) {
        nextStatuses[key] = "exists";
      }
      if (match?.html_link) {
        nextLinks[key] = match.html_link;
      }
    }
    setEventStatuses(nextStatuses);
    setEventLinks(nextLinks);
  };

  useEffect(() => {
    setParsePhase("checking");
    setSuggestions([]);
    setEventStatuses({});
    setEventErrors({});
    setEventLinks({});

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

      const postNr = content?.threadId ?? getPiazzaCidFromLocation();
      const courseId =
        content?.piazzaCourseId ?? getPiazzaCourseIdFromLocation();
      let token = null;
      let existingEvents = [];
      try {
        token = await new Promise((resolve) => {
          chrome.storage.local.get(["authToken"], (result) => {
            resolve(result?.authToken || null);
          });
        });
      } catch (error) {
        if (!cancelled && error?.name !== "AbortError") {
          console.error("Failed to read auth token:", error);
        }
      }

      if (
        token &&
        postNr != null &&
        String(postNr).trim() !== "" &&
        !cancelled
      ) {
        try {
          const listResp = await fetch(`${API_ENDPOINT}/calendar/events?include_links=true`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: ac.signal,
          });
          if (listResp.ok && !cancelled) {
            const allEvents = await listResp.json();
            const postNumber = String(postNr).trim();
            const courseKey =
              courseId != null && String(courseId).trim() !== ""
                ? String(courseId).trim()
                : null;
            existingEvents = (Array.isArray(allEvents) ? allEvents : []).filter(
              (evt) =>
                String(evt?.source_post_number ?? "").trim() === postNumber &&
                (courseKey == null ||
                  String(evt?.piazza_course_id ?? "").trim() === courseKey),
            );
          }
        } catch (error) {
          if (!cancelled && error?.name !== "AbortError") {
            console.error("Failed to load existing calendar events:", error);
          }
        }
      }

      const fp = fingerprintArticleContent(content);
      const cached = getCachedParse(fp);
      if (cached !== undefined) {
        if (!cancelled) {
          if (Array.isArray(cached)) {
            setSuggestions(cached);
            markExistingSuggestions(cached, existingEvents);
          } else {
            const single = cached ? [cached] : [];
            setSuggestions(single);
            markExistingSuggestions(single, existingEvents);
          }
          setParsePhase("done");
        }
        return;
      }

      try {
        const response = await fetch(`${API_ENDPOINT}/calendar/extract-dates`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: content,
          }),
          signal: ac.signal,
        });

        if (cancelled) return;

        const data = await response.json();
        const rawEvents = Array.isArray(data?.events)
          ? data.events
          : data?.parsed_event
            ? [data.parsed_event]
            : [];
        const normalizedEvents = rawEvents
          .map((evt) => {
            const confidence = evt?.confidence ?? data?.confidence ?? 0;
            return {
              event_name: evt?.event_name,
              event_type: evt?.event_type,
              start_time: evt?.start_time,
              end_time: evt?.end_time,
              display_text: evt?.display_text,
              confidence,
            };
          })
          .filter(
            (evt) =>
              evt.event_name &&
              evt.start_time &&
              evt.end_time &&
              evt.confidence >= CONFIDENCE_THRESHOLD,
          );

        setCachedParse(fp, normalizedEvents);
        setSuggestions(normalizedEvents);
        markExistingSuggestions(normalizedEvents, existingEvents);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch suggested event:", err);
        setSuggestions([]);
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

  const handleClick = async (targetSuggestion) => {
    const suggestionKey = getSuggestionKey(targetSuggestion);
    const existingLinkForSuggestion = eventLinks[suggestionKey];
    if (
      eventStatuses[suggestionKey] === "success" ||
      eventStatuses[suggestionKey] === "exists"
    ) {
      window.open(
        existingLinkForSuggestion || "https://calendar.google.com/calendar/u/0/r",
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    setEventStatuses((prev) => ({ ...prev, [suggestionKey]: "loading" }));
    setEventErrors((prev) => ({ ...prev, [suggestionKey]: null }));

    chrome.storage.local.get(["authToken"], async (result) => {
      const token = result.authToken;

      if (!token) {
        console.warn("No auth token found");
        setEventStatuses((prev) => ({ ...prev, [suggestionKey]: "error" }));
        setEventErrors((prev) => ({
          ...prev,
          [suggestionKey]: "Missing auth token",
        }));
        return;
      }

      if (!targetSuggestion) {
        console.warn("No event suggestion available");
        setEventStatuses((prev) => ({ ...prev, [suggestionKey]: "error" }));
        setEventErrors((prev) => ({
          ...prev,
          [suggestionKey]: "No event suggestion available",
        }));
        return;
      }

      try {
        const content = readArticleContent(article);
        const piazzaCourseId = getPiazzaCourseIdFromLocation();
        const payload = buildAddEventRequestBody(
          targetSuggestion,
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

        if (response.ok && data) {
          setEventStatuses((prev) => ({
            ...prev,
            [suggestionKey]: data?.status === "exists" ? "exists" : "success",
          }));
          setEventLinks((prev) => ({
            ...prev,
            [suggestionKey]: data?.link ?? null,
          }));
        } else {
          console.error("Failed to create event", {
            status: response.status,
            data,
            suggestion: targetSuggestion,
          });
          setEventStatuses((prev) => ({ ...prev, [suggestionKey]: "error" }));
          setEventErrors((prev) => ({
            ...prev,
            [suggestionKey]: data?.detail ?? "Failed to create event",
          }));
        }
      } catch (error) {
        console.error("Error while creating event", error);
        setEventStatuses((prev) => ({ ...prev, [suggestionKey]: "error" }));
        setEventErrors((prev) => ({
          ...prev,
          [suggestionKey]: "Unexpected error while creating event",
        }));
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

  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="piazza-ai-calendar-btn-group">
      {suggestions.map((item) => {
        const key = getSuggestionKey(item);
        const itemStatus = eventStatuses[key] ?? "idle";
        const itemError = eventErrors[key];
        const itemLink = eventLinks[key];
        const labelText = `Possible event: ${item.event_name ?? "Unnamed"}`;
        const variant =
          itemStatus === "success" || itemStatus === "exists"
            ? "success"
            : itemStatus === "error"
              ? "error"
              : "idle";

        return (
          <button
            key={key}
            type="button"
            className={`piazza-ai-calendar-btn piazza-ai-calendar-btn--${variant}`}
            onClick={() => handleClick(item)}
            disabled={itemStatus === "loading"}
          >
            {itemStatus === "success" || itemStatus === "exists" ? (
              <>
                <CalendarIcon variant="success" />
                <span>
                  {itemLink
                    ? itemStatus === "exists"
                      ? "Event already added to calendar - Open here"
                      : "Event added - Open here"
                    : itemStatus === "exists"
                      ? "Event already added to calendar"
                      : "Event added - Open Google Calendar"}
                </span>
              </>
            ) : itemStatus === "error" ? (
              <>
                <CalendarIcon variant="error" />
                <span>Failed to add event: {itemError ?? "Unknown error"}</span>
              </>
            ) : (
              <>
                <CalendarIcon variant="default" />
                <span>{labelText}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
