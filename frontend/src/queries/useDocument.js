import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  requestUploadUrl,
  uploadDirectToSupabase,
  confirmUpload,
  uploadDocument,
  getDocument,
  getDocuments,
  getDocumentDownloadUrl,
  deleteDocument,
  getDocumentsHealth,
} from "../api/documentApi.js";
import { useState, useCallback } from "react";

/**
 * Hook to fetch a single document by ID
 * @param {string} documentId - Document UUID
 * @param {string} accessToken - Bearer token
 * @param {Object} options - Query options
 * @returns {QueryResult} Document query result
 */
export function useDocument(documentId, accessToken, options = {}) {
  return useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId, accessToken),
    enabled: !!documentId && !!accessToken && (options.enabled ?? true),
    ...options,
  });
}

/**
 * Hook to fetch paginated documents with optional filtering
 * @param {Object} params - Query parameters
 * @param {string} params.piazzaCourseId - Filter by Piazza course ID (optional)
 * @param {string} params.uploaderId - Filter by uploader ID (optional)
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.perPage - Items per page (default: 20)
 * @param {string} params.accessToken - Bearer token
 * @param {Object} options - Query options
 * @returns {QueryResult} Documents query result
 */
export function useDocuments({
  piazzaCourseId,
  uploaderId,
  page = 1,
  perPage = 20,
  accessToken,
  ...options
} = {}) {
  return useQuery({
    queryKey: ["documents", { piazzaCourseId, uploaderId, page, perPage }],
    queryFn: () =>
      getDocuments({ piazzaCourseId, uploaderId, page, perPage, accessToken }),
    enabled: !!accessToken && (options.enabled ?? true),
    ...options,
  });
}

/**
 * Hook to fetch documents by thread ID
 * @param {string} threadId - Thread UUID
 * @param {string} accessToken - Bearer token
 * @param {Object} options - Query options
 * @returns {QueryResult} Documents query result
 */
export function useDocumentsByThread(threadId, accessToken, options = {}) {
  return useDocuments({
    threadId,
    accessToken,
    enabled: !!threadId && !!accessToken && (options.enabled ?? true),
    ...options,
  });
}

/**
 * Hook to fetch documents by uploader ID
 * @param {string} uploaderId - Uploader UUID
 * @param {string} accessToken - Bearer token
 * @param {Object} options - Query options
 * @returns {QueryResult} Documents query result
 */
export function useDocumentsByUploader(uploaderId, accessToken, options = {}) {
  return useDocuments({
    uploaderId,
    accessToken,
    enabled: !!uploaderId && !!accessToken && (options.enabled ?? true),
    ...options,
  });
}

/**
 * Hook to get a document's download URL
 * @param {string} documentId - Document UUID
 * @param {number} expiresIn - URL expiration in seconds
 * @param {string} accessToken - Bearer token
 * @param {Object} options - Query options
 * @returns {QueryResult} Download URL query result
 */
export function useDocumentDownloadUrl(
  documentId,
  expiresIn = 3600,
  accessToken,
  options = {},
) {
  return useQuery({
    queryKey: ["documentDownload", documentId, expiresIn],
    queryFn: () => getDocumentDownloadUrl(documentId, expiresIn, accessToken),
    enabled:
      !!documentId && !!accessToken && (options.enabled ?? true),
    staleTime: (expiresIn - 60) * 1000, // Refetch 1 minute before expiry
    ...options,
  });
}

/**
 * Hook for uploading documents via presigned URLs.
 *
 * Orchestrates the three-step flow:
 *   1. POST /request-upload   -> get signed URL
 *   2. PUT  signed URL        -> upload file directly to Supabase
 *   3. POST /confirm-upload   -> create DB record
 *
 * @param {Object} options
 * @param {string} options.accessToken - Bearer token (required)
 * @param {string} options.piazzaCourseId - Piazza course ID (required)
 * @param {string} [options.permission='private'] - Permission level
 * @param {function} [options.onSuccess] - Called after all files uploaded
 * @param {function} [options.onError] - Called on failure
 * @returns {{ mutate, mutateAsync, isLoading, progress, error, reset }}
 */
export function useUploadDocument({
  accessToken,
  piazzaCourseId,
  permission = "private",
  onSuccess,
  onError,
} = {}) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (file) => {
      setProgress(0);

      // Step 1: Request presigned URL
      const uploadMeta = await requestUploadUrl({
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        piazzaCourseId,
        permission,
        accessToken,
      });

      // Step 2: Upload directly to Supabase
      await uploadDirectToSupabase({
        signedUrl: uploadMeta.signed_url,
        token: uploadMeta.token,
        file,
        onProgress: setProgress,
      });

      // Step 3: Confirm upload & create DB record
      const result = await confirmUpload({
        storagePath: uploadMeta.storage_path,
        fileName: uploadMeta.file_name,
        fileType: uploadMeta.file_type,
        fileSize: uploadMeta.file_size,
        threadId: uploadMeta.thread_id,
        permission,
        accessToken,
      });

      return result;
    },
    onSuccess: (data) => {
      setProgress(100);
      // Invalidate document list queries so the UI refreshes
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (onSuccess) onSuccess(data);
    },
    onError: (error) => {
      setProgress(0);
      if (onError) onError(error);
    },
  });

  const reset = useCallback(() => {
    setProgress(0);
    mutation.reset();
  }, [mutation]);

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    progress,
    error: mutation.error,
    reset,
  };
}

/**
 * Hook to delete a document
 * @param {string} accessToken - Bearer token
 * @param {Object} options - Mutation options
 */
export function useDeleteDocument(accessToken, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId) => deleteDocument(documentId, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (options.onSuccess) options.onSuccess();
    },
    ...options,
  });
}

/**
 * Hook to check document service health
 * @param {Object} options - Query options
 * @returns {QueryResult} Health check result
 */
export function useDocumentsHealth(options = {}) {
  return useQuery({
    queryKey: ["documentsHealth"],
    queryFn: getDocumentsHealth,
    staleTime: 30000, // 30 seconds
    ...options,
  });
}
