import React, { useEffect, useState } from "react";

export default function InjectedEventButton() {
  const [status, setStatus] = useState("idle");
  const [text, setText] = useState(
    "📅 Possible Event: Midterm Feb 28, 2026 From 11:00 AM to 12:00 PM",
  );

  const [authToken, setAuthToken] = useState(null);

  // Retrieve auth token from storage on mount
  useEffect(() => {
    chrome.storage.local.get(["authToken"], (result) => {
      if (result.authToken) {
        setAuthToken(result.authToken);
      } else {
        console.warn("⚠️ No auth token found in storage");
      }
    });
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
              title: "Midterm",
              start_time: "2026-02-28T19:00:00Z",
              end_time: "2026-02-28T20:00:00Z",
            }),
          },
        );

        const data = await response.json();

        if (data.action === "link_required") {
          window.location.href = "http://localhost:8000/api/v1/calendar/auth";
          return;
        }

        if (data.status === "event_created") {
          setText("✅ Event Added to Google Calendar");
          setStatus("success");
        }
      } catch (error) {
        setText("❌ Failed to add event");
        setStatus("error");
      }
    });
  };

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
      {text}
    </button>
  );
}
