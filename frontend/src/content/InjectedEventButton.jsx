import React, { useEffect, useState } from "react";
import { readCurrentThreadArticleContent } from "./injectEventButton.js";

const CONFIDENCE_THRESHOLD = 0.7;

export default function InjectedEventButton() {
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
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
          setErrorMessage(data?.detail ?? "Failed to create event");
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

  const buttonClassName = [
    "my-injected-link",
    "inline-block cursor-pointer border-0 rounded-md px-2 py-1.5 mt-4 ml-4",
    "text-sm transition-colors",
    "disabled:opacity-70 disabled:cursor-not-allowed",
    status === "success" &&
      "bg-green-100 text-green-900 hover:bg-green-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500",
    status === "error" &&
      "bg-red-100 text-red-900 hover:bg-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500",
    (status === "idle" || status === "loading") &&
      "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={buttonClassName}
      onClick={handleClick}
      disabled={status === "loading"}
    >
      {status === "success"
        ? "✅ Event added to Google Calendar"
        : status === "error"
          ? `❌ Failed to add event: ${errorMessage}`
          : label}
    </button>
  );
}
