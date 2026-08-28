/**
 * The catalog edition marker.
 *
 * `published_at` is the moment LaunchLog listed the release, so a card or a
 * record prints that date and nothing else: no invented catalog number, no
 * barcode, and no claim about when the product itself shipped.
 *
 * The output is an ISO-8601 calendar date because SSR and the hydrated client
 * must agree byte for byte, which a locale-formatted date cannot guarantee.
 * An absent or unparseable value returns '' so the caller can omit the marker
 * rather than print a placeholder.
 */
export const releaseEdition = (publishedAt?: string | null): string => {
  if (!publishedAt) return ''

  const listed = new Date(publishedAt)
  if (Number.isNaN(listed.getTime())) return ''

  return listed.toISOString().slice(0, 10)
}
