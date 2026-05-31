// server/api/indexnow/submit.post.ts
// POST { urls: string[] } -> pings IndexNow so search engines re-crawl the given URLs fast.
// Intended to be called when a listing is published/updated. pingIndexNow + INDEXNOW_KEY
// are auto-imported from server/utils/indexnow.ts.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ urls?: string[] }>(event)
  const urls = (body?.urls ?? []).filter(u => typeof u === 'string' && u.startsWith('https://launchlog.ai'))
  if (urls.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid launchlog.ai urls provided' })
  }
  try {
    await pingIndexNow(urls)
    return { ok: true, submitted: urls.length }
  } catch {
    // IndexNow is best-effort; never fail the caller because a search engine was slow.
    return { ok: false, submitted: 0 }
  }
})
