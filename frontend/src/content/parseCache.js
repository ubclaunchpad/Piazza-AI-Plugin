const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { expires: number, suggestion: object | null }>} */
const cache = new Map();

export function fingerprintArticleContent(content) {
  if (!content) return "";
  const course = content.piazzaCourseId ?? "unknown";
  const tid = content.threadId ?? "unknown";
  const sum = content.threadSummary ?? "";
  const bod = content.threadContent ?? "";
  const str = `${course}\0${tid}\0${sum}\0${bod}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return `${course}:${tid}:${str.length}:${h}`;
}

export function getCachedParse(fingerprint) {
  const row = cache.get(fingerprint);
  if (!row) return undefined;
  if (Date.now() > row.expires) {
    cache.delete(fingerprint);
    return undefined;
  }
  return row.suggestion;
}

export function setCachedParse(fingerprint, suggestion) {
  cache.set(fingerprint, {
    expires: Date.now() + CACHE_TTL_MS,
    suggestion,
  });
}
