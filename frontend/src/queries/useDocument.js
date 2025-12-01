import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  uploadDocument,
  getDocument,
  getDocuments,
  getDocumentDownloadUrl,
  deleteDocument,
  getDocumentsHealth,
} from "../api/documentApi.js";

/**
 * Hook to fetch a single document by ID
 * @param {string} documentId - Document UUID
 * @param {Object} options - Query options
 * @returns {QueryResult} Document query result
 */
export function useDocument(documentId, options = {}) {
  return useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
    enabled: !!documentId && (options.enabled ?? true),
    ...options,
  });
}

/**
 * Hook to fetch paginated documents with optional filtering
 * @param {Object} params - Query parameters
 * @param {string} params.threadId - Filter by thread ID (optional)
 * @param {string} params.uploaderId - Filter by uploader ID (optional)
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.perPage - Items per page (default: 20)
 * @param {Object} options - Query options
 * @returns {QueryResult} Documents query result
 */
export function useDocuments({
  threadId,
  uploaderId,
  page = 1,
  perPage = 20,
  ...options
} = {}) {
  return useQuery({
    queryKey: ["documents", { threadId, uploaderId, page, perPage }],
    queryFn: () => getDocuments({ threadId, uploaderId, page, perPage }),
    enabled: options.enabled ?? true,
    ...options,
  });
}

/**
 * Hook to fetch documents by thread ID
 * @param {string} threadId - Thread UUID
 * @param {Object} options - Query options
 * @returns {QueryResult} Documents query result
 */
export function useDocumentsByThread(threadId, options = {}) {
  return useDocuments({
    threadId,
    enabled: !!threadId && (options.enabled ?? true),
    ...options,
  });
}

/**
 * Hook to fetch documents by uploader ID
 * @param {string} uploaderId - Uploader UUID
 * @param {Object} options - Query options
 * @returns {QueryResult} Documents query result
 */
export function useDocumentsByUploader(uploaderId, options = {}) {
  return useDocuments({
    uploaderId,
    enabled: !!uploaderId && (options.enabled ?? true),
    ...options,
  });
}

/**
 * Hook to get a document's download URL
 * @param {string} documentId - Document UUID
 * @param {number} expiresIn - URL expiration in seconds
 * @param {Object} options - Query options
 * @returns {QueryResult} Download URL query result
 */
export function useDocumentDownloadUrl(
  documentId,
  expiresIn = 3600,
  options = {}
) {
  return useQuery({
    queryKey: ["documentDownload", documentId, expiresIn],
    queryFn: () => getDocumentDownloadUrl(documentId, expiresIn),
    enabled: !!documentId && (options.enabled ?? true),
    staleTime: (expiresIn - 60) * 1000, // Refetch 1 minute before expiry
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
