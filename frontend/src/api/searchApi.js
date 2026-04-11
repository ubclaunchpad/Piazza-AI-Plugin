const API_ENDPOINT = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";

function buildAuthHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseError(response, fallback) {
  try {
    const data = await response.json();
    return data?.detail || fallback;
  } catch (_) {
    return fallback;
  }
}

export async function searchContent({
  token,
  query,
  searchType = "semantic",
  piazzaCourseId = null,
  limit = 10,
  similarityThreshold = 0,
  filters = {},
}) {
  const payload = {
    query,
    search_type: searchType,
    limit,
    similarity_threshold: similarityThreshold,
    filters: {
      instructor_only: !!filters.instructorOnly,
      date_from: filters.dateFrom || null,
      date_to: filters.dateTo || null,
    },
  };

  if (piazzaCourseId) {
    payload.piazza_course_id = piazzaCourseId;
  }

  const response = await fetch(`${API_ENDPOINT}/search`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, `Search failed: ${response.status}`));
  }

  return response.json();
}

export async function searchSimilar({
  token,
  piazzaCourseId,
  piazzaPostId,
  limit = 5,
  similarityThreshold = 0,
}) {
  const response = await fetch(`${API_ENDPOINT}/search/similar`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify({
      piazza_course_id: piazzaCourseId,
      piazza_post_id: piazzaPostId,
      limit,
      similarity_threshold: similarityThreshold,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await parseError(response, `Similar search failed: ${response.status}`)
    );
  }

  return response.json();
}

export async function listSavedSearches({ token, piazzaCourseId = null }) {
  const params = new URLSearchParams();
  if (piazzaCourseId) {
    params.set("piazza_course_id", piazzaCourseId);
  }

  const response = await fetch(
    `${API_ENDPOINT}/search/saved${params.toString() ? `?${params}` : ""}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(
      await parseError(response, `Failed to load saved searches: ${response.status}`)
    );
  }

  return response.json();
}

export async function saveSearch({ token, query, searchType, piazzaCourseId = null }) {
  const payload = {
    query,
    search_type: searchType,
  };

  if (piazzaCourseId) {
    payload.piazza_course_id = piazzaCourseId;
  }

  const response = await fetch(`${API_ENDPOINT}/search/saved`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, `Failed to save search: ${response.status}`));
  }

  return response.json();
}

export async function deleteSavedSearch({ token, savedSearchId }) {
  const response = await fetch(`${API_ENDPOINT}/search/saved/${savedSearchId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      await parseError(response, `Failed to delete saved search: ${response.status}`)
    );
  }

  return response.json();
}
