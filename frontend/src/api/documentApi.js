const API_ENDPOINT = process.env.API_ENDPOINT || "http://localhost:8000/api/v1";

// ---------------------------------------------------------------------------
// Presigned upload flow (recommended)
// ---------------------------------------------------------------------------

/**
 * Step 1: Request a presigned upload URL from the backend.
 *
 * @param {Object} params
 * @param {string} params.fileName - Original filename
 * @param {string} params.fileType - MIME type
 * @param {number} params.fileSize - Size in bytes
 * @param {string} params.piazzaCourseId - Piazza course ID from URL
 * @param {string} params.permission - Permission level (private, thread, instructor)
 * @param {string} params.accessToken - Bearer token
 * @returns {Promise<Object>} { signed_url, token, storage_path, thread_id, file_name, file_type, file_size }
 */
export const requestUploadUrl = async ({
  fileName,
  fileType,
  fileSize,
  piazzaCourseId,
  permission,
  accessToken,
}) => {
  const response = await fetch(`${API_ENDPOINT}/documents/request-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      piazza_course_id: piazzaCourseId,
      permission: permission || "private",
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get upload URL");
  }

  return response.json();
};

/**
 * Step 2: Upload the file directly to Supabase Storage via the signed URL.
 *
 * Uses XMLHttpRequest so we can report upload progress.
 *
 * @param {Object} params
 * @param {string} params.signedUrl - The presigned upload URL
 * @param {string} params.token - Upload token from request-upload
 * @param {File}   params.file - The File object to upload
 * @param {function} [params.onProgress] - Callback receiving progress percentage (0-100)
 * @returns {Promise<void>}
 */
export const uploadDirectToSupabase = ({ signedUrl, token, file, onProgress }) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // The signed URL from Supabase already contains the token as a query
    // parameter, but we also set it as a header for safety.
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    if (token) {
      xhr.setRequestHeader("x-upsert", "false");
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Direct upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Direct upload failed: network error"));
    xhr.ontimeout = () => reject(new Error("Direct upload failed: timeout"));

    xhr.send(file);
  });
};

/**
 * Step 3: Confirm the upload and create the database record.
 *
 * @param {Object} params
 * @param {string} params.storagePath - storage_path from request-upload
 * @param {string} params.fileName
 * @param {string} params.fileType
 * @param {number} params.fileSize
 * @param {string} params.threadId - thread_id UUID from request-upload
 * @param {string} params.permission
 * @param {string} params.accessToken - Bearer token
 * @returns {Promise<Object>} DocumentUploadResponse
 */
export const confirmUpload = async ({
  storagePath,
  fileName,
  fileType,
  fileSize,
  threadId,
  permission,
  accessToken,
}) => {
  const response = await fetch(`${API_ENDPOINT}/documents/confirm-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      storage_path: storagePath,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      thread_id: threadId,
      permission: permission || "private",
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to confirm upload");
  }

  return response.json();
};

// ---------------------------------------------------------------------------
// Legacy proxy upload (deprecated -- use the presigned flow above)
// ---------------------------------------------------------------------------

/**
 * Upload a document via the backend proxy (deprecated).
 * @param {Object} params - Upload parameters
 * @param {string} params.piazzaCourseId - Piazza course ID from URL (required)
 * @param {string} params.permission - Permission level (private, thread, instructor)
 * @param {File} params.file - File to upload
 * @param {string} params.accessToken - Bearer token
 * @returns {Promise<Object>} Upload response with document details
 */
export const uploadDocument = async ({
  piazzaCourseId,
  permission,
  file,
  accessToken,
}) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("permission", permission || "private");

  // Append piazza_course_id (required)
  if (!piazzaCourseId) {
    throw new Error("piazzaCourseId is required");
  }
  formData.append("piazza_course_id", piazzaCourseId);

  const response = await fetch(`${API_ENDPOINT}/documents/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to upload document");
  }

  return response.json();
};

// ---------------------------------------------------------------------------
// Read / download / delete / list  (all now require auth)
// ---------------------------------------------------------------------------

/**
 * Get document by ID
 * @param {string} documentId - Document UUID
 * @param {string} accessToken - Bearer token
 * @returns {Promise<Object>} Document details
 */
export const getDocument = async (documentId, accessToken) => {
  const response = await fetch(`${API_ENDPOINT}/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to fetch document");
  }

  return response.json();
};

/**
 * Get document download URL
 * @param {string} documentId - Document UUID
 * @param {number} expiresIn - URL expiration in seconds (default: 3600)
 * @param {string} accessToken - Bearer token
 * @returns {Promise<Object>} Object with download URL
 */
export const getDocumentDownloadUrl = async (
  documentId,
  expiresIn = 3600,
  accessToken,
) => {
  const response = await fetch(
    `${API_ENDPOINT}/documents/${documentId}/download?expires_in=${expiresIn}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get download URL");
  }

  return response.json();
};

/**
 * Delete a document
 * @param {string} documentId - Document UUID
 * @param {string} accessToken - Bearer token
 * @returns {Promise<Object>} Deletion confirmation
 */
export const deleteDocument = async (documentId, accessToken) => {
  const response = await fetch(`${API_ENDPOINT}/documents/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to delete document");
  }

  return response.json();
};

/**
 * List documents with optional filtering
 * @param {Object} params - Query parameters
 * @param {string} params.piazzaCourseId - Filter by Piazza course ID (optional)
 * @param {string} params.uploaderId - Filter by uploader ID (optional)
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.perPage - Items per page (default: 20)
 * @param {string} params.accessToken - Bearer token
 * @returns {Promise<Object>} Paginated document list
 */
export const getDocuments = async ({
  piazzaCourseId,
  uploaderId,
  page = 1,
  perPage = 20,
  accessToken,
} = {}) => {
  const params = new URLSearchParams();
  if (piazzaCourseId) params.append("piazza_course_id", piazzaCourseId);
  if (uploaderId) params.append("uploader_id", uploaderId);
  params.append("page", page.toString());
  params.append("per_page", perPage.toString());

  const response = await fetch(
    `${API_ENDPOINT}/documents/?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to fetch documents");
  }

  return response.json();
};

/**
 * Check document service health (no auth required)
 * @returns {Promise<Object>} Health status
 */
export const getDocumentsHealth = async () => {
  const response = await fetch(`${API_ENDPOINT}/documents/health`);

  if (!response.ok) {
    throw new Error("Document service unhealthy");
  }

  return response.json();
};
