/**
 * Statuses that mean "this URL is permanently unavailable to a crawler", so the error response
 * should carry a deindex directive.
 *
 * Everything else deliberately does not: a temporary failure — 408, 425, 429 and every 5xx —
 * must keep its URL in the index and be retried. A `noindex` on a transient error asks search
 * engines to drop URLs that are still live, which is the exact regression the WordPress mirror
 * fail-safe exists to prevent.
 */
const PERMANENTLY_EXCLUDED_STATUSES = new Set([401, 403, 404, 410])

export function shouldDeindexErrorStatus(statusCode: number): boolean {
  return PERMANENTLY_EXCLUDED_STATUSES.has(statusCode)
}
