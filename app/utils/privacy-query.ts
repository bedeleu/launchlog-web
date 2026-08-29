export interface SanitizedQuery {
  changed: boolean
  query: Record<string, unknown>
}

export const stripRedditClickId = (query: Record<string, unknown>): SanitizedQuery => {
  const safeQuery: Record<string, unknown> = {}
  let changed = false

  for (const [key, value] of Object.entries(query)) {
    if (key.toLowerCase() === 'rdt_cid') {
      changed = true
      continue
    }

    safeQuery[key] = value
  }

  return { changed, query: safeQuery }
}
