export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')

  const page = parseBlogPageParam(getQuery(event).page)

  // A page number that can never exist is absence, not unavailability. 404 keeps `?page=abc` and
  // `?page=0` out of the index instead of minting duplicate copies of the first archive page.
  if (page === null) {
    throw createError({ statusCode: 404, statusMessage: 'Blog page not found' })
  }

  try {
    return await fetchWordPressPostsPage(page, BLOG_ARCHIVE_PER_PAGE)
  }
  catch (cause) {
    if (cause instanceof WordPressPageOutOfRangeError) {
      throw createError({ statusCode: 404, statusMessage: 'Blog page not found' })
    }

    // Same rule as the single-post route: an upstream failure is unavailability, never absence.
    throw createError({ statusCode: 503, statusMessage: 'Blog temporarily unavailable', cause })
  }
})
