import React, { useEffect, useState } from "react";
import { readCurrentThreadArticleContent } from "./injectEventButton.js";

const CONFIDENCE_THRESHOLD = 0.7;

export default function InjectedEventButton() {
  const [status, setStatus] = useState("idle");
  const [suggestion, setSuggestion] = useState(null);

  const [authToken, setAuthToken] = useState(null);

  // Retrieve auth token and compute suggestion on mount
  useEffect(() => {
    chrome.storage.local.get(["authToken"], (result) => {
      if (result.authToken) {
        setAuthToken(result.authToken);
      } else {
        console.warn("⚠️ No auth token found in storage");
      }
    });

    const content = readCurrentThreadArticleContent();
    if (!content) {
      setSuggestion(null);
      return;
    }

    (async () => {
      try {
        const response = await fetch(
          "http://localhost:8000/api/v1/calendar/events/parse-thread",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: JSON.stringify(content),
            }),
          },
        );

        const data = await response.json();
        const parsed = data?.parsed_event ?? null;
        const confidence = parsed?.confidence ?? data?.confidence ?? 0;

        if (!parsed || confidence < CONFIDENCE_THRESHOLD) {
          setSuggestion(null);
          return;
        }

        setSuggestion({
          event_name: parsed.event_name,
          event_type: parsed.event_type,
          start_time: parsed.start_time,
          end_time: parsed.end_time,
          display_text: parsed.display_text,
          confidence,
        });
      } catch (err) {
        console.error("Failed to fetch suggested event:", err);
        setSuggestion(null);
      }
    })();
  }, []);

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
        const response = await fetch(
          "http://localhost:8000/api/v1/calendar/events",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: suggestion.event_name,
              start_time: suggestion.start_time,
              end_time: suggestion.end_time,
            }),
          },
        );

        const data = await response.json().catch(() => null);

        if (data && data.action === "link_required") {
          window.location.href = "http://localhost:8000/api/v1/calendar/auth";
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
        }
      } catch (error) {
        console.error("Error while creating event", error);
        setStatus("error");
      }
    });
  };

  if (!suggestion) {
    return null;
  }

  const label =
    suggestion.display_text ||
    `📅 Possible ${suggestion.event_type ?? "event"}: ${
      suggestion.event_name ?? "Unnamed"
    }`;

  return (
    <button
      type="button"
      className="my-injected-link"
      style={{
        display: "inline-block",
        backgroundColor:
          status === "success"
            ? "#d4edda"
            : status === "error"
              ? "#f8d7da"
              : "#f0f0f0",
        padding: "5px",
        marginTop: "16px",
        marginLeft: "16px",
        borderRadius: "5px",
        border: "none",
        cursor: "pointer",
      }}
      onClick={handleClick}
      onMouseEnter={(e) => (e.target.style.backgroundColor = "#e0e0e0")}
      onMouseLeave={(e) =>
        (e.target.style.backgroundColor =
          status === "success"
            ? "#d4edda"
            : status === "error"
              ? "#f8d7da"
              : "#f0f0f0")
      }
      disabled={status === "loading"}
    >
      {status === "success"
        ? "✅ Event added to Google Calendar"
        : status === "error"
          ? "❌ Failed to add event"
          : label}
    </button>
  );
}
