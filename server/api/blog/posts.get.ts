export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')

  const query = getQuery(event)
  const limit = Number(query.limit ?? 24)
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 24

  return fetchWordPressPosts(safeLimit)
})
