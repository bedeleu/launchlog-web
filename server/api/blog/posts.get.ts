export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')

  const query = getQuery(event)
  const limit = Number(query.limit ?? 24)
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 24

  // Same rule as the single-post route: an upstream failure is unavailability, never absence.
  return fetchWordPressPosts(safeLimit).catch((cause) => {
    throw createError({ statusCode: 503, statusMessage: 'Blog temporarily unavailable', cause })
  })
})
