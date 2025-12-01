const API_ENDPOINT = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";

/**
 * Upload a document
 * @param {Object} params - Upload parameters
 * @param {string} params.uploaderId - Uploader UUID (required)
 * @param {string} params.threadId - Thread UUID (optional)
 * @param {string} params.permission - Permission level (private, thread, instructor)
 * @param {File} params.file - File to upload
 * @returns {Promise<Object>} Upload response with document details
 */
export const uploadDocument = async ({
  uploaderId,
  threadId,
  permission,
  file,
}) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("uploader_id", uploaderId);
  formData.append("permission", permission || "private");

  // Only append thread_id if provided
  if (threadId) {
    formData.append("thread_id", threadId);
  }

  const response = await fetch(`${API_ENDPOINT}/documents/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to upload document");
  }

  return response.json();
};

/**
 * Get document by ID
 * @param {string} documentId - Document UUID
 * @returns {Promise<Object>} Document details
 */
export const getDocument = async (documentId) => {
  const response = await fetch(`${API_ENDPOINT}/documents/${documentId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to fetch document");
  }

  return response.json();
};

/**
 * Get document download URL
 * @param {string} documentId - Document UUID
 * @param {number} expiresIn - URL expiration in seconds (default: 3600)
 * @returns {Promise<Object>} Object with download URL
 */
export const getDocumentDownloadUrl = async (documentId, expiresIn = 3600) => {
  const response = await fetch(
    `${API_ENDPOINT}/documents/${documentId}/download?expires_in=${expiresIn}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to get download URL");
  }

  return response.json();
};

/**
 * Delete a document
 * @param {string} documentId - Document UUID
 * @returns {Promise<Object>} Deletion confirmation
 */
export const deleteDocument = async (documentId) => {
  const response = await fetch(`${API_ENDPOINT}/documents/${documentId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to delete document");
  }

  return response.json();
};

/**
 * List documents with optional filtering
 * @param {Object} params - Query parameters
 * @param {string} params.threadId - Filter by thread ID (optional)
 * @param {string} params.uploaderId - Filter by uploader ID (optional)
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.perPage - Items per page (default: 20)
 * @returns {Promise<Object>} Paginated document list
 */
export const getDocuments = async ({
  threadId,
  uploaderId,
  page = 1,
  perPage = 20,
} = {}) => {
  const params = new URLSearchParams();
  if (threadId) params.append("thread_id", threadId);
  if (uploaderId) params.append("uploader_id", uploaderId);
  params.append("page", page.toString());
  params.append("per_page", perPage.toString());

  const response = await fetch(
    `${API_ENDPOINT}/documents/?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to fetch documents");
  }

  return response.json();
};

/**
 * Check document service health
 * @returns {Promise<Object>} Health status
 */
export const getDocumentsHealth = async () => {
  const response = await fetch(`${API_ENDPOINT}/documents/health`);

  if (!response.ok) {
    throw new Error("Document service unhealthy");
  }

  return response.json();
};
