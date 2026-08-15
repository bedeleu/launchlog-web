export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing blog post slug' })
  }

  // Only a resolved-but-empty lookup means the post is gone. An upstream failure — including an
  // upstream 404 for the REST route itself — must not be laundered into absence: WordPress
  // canonicals point at these URLs, so a 404 here asks search engines to drop a live post.
  const post = await fetchWordPressPostBySlug(slug).catch((cause) => {
    throw createError({ statusCode: 503, statusMessage: 'Blog temporarily unavailable', cause })
  })

  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Blog post not found' })
  }

  return post
})
