const API_ENDPOINT = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";

/**
 * Search for external learning resources on a topic.
 *
 * @param {Object} params
 * @param {string} params.query - Topic or query text (required)
 * @param {string} params.piazzaCourseId - Piazza course ID (required)
 * @param {string[]} [params.filters] - Optional list of providers (youtube, stackoverflow, etc.)
 * @param {number} [params.limit] - Optional max number of results
 * @returns {Promise<{results: Array}>}
 */
export const searchResources = async ({
  query,
  piazzaCourseId,
  filters,
  limit,
}) => {
  const body = {
    query,
    piazza_course_id: piazzaCourseId,
  };

  if (filters && filters.length > 0) {
    body.filters = filters;
  }
  if (typeof limit === "number") {
    body.limit = limit;
  }

  const response = await fetch(`${API_ENDPOINT}/resources/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to search resources");
  }

  return response.json();
};

/**
 * Get saved resources from the library.
 *
 * @param {Object} params
 * @param {string} params.piazzaCourseId - Optional Piazza course ID filter
 * @returns {Promise<{saved_resources: Array}>}
 */
export const getResourceLibrary = async ({ piazzaCourseId } = {}) => {
  const params = new URLSearchParams();
  if (piazzaCourseId) {
    params.append("piazza_course_id", piazzaCourseId);
  }

  const url =
    params.toString().length > 0
      ? `${API_ENDPOINT}/resources/library?${params.toString()}`
      : `${API_ENDPOINT}/resources/library`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to fetch resource library");
  }

  return response.json();
};

/**
 * Save a resource to the library.
 *
 * @param {Object} payload - Matches backend SaveResourceRequest shape.
 * @returns {Promise<{id: string, message: string}>}
 */
export const saveResource = async (payload) => {
  const response = await fetch(`${API_ENDPOINT}/resources/library`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to save resource");
  }

  return response.json();
};

/**
 * Delete a resource from the library by ID.
 *
 * @param {string} id - Resource UUID
 * @returns {Promise<void>}
 */
export const deleteResource = async (id) => {
  const response = await fetch(`${API_ENDPOINT}/resources/library/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to delete resource");
  }
};

