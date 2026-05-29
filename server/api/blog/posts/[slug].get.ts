export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing blog post slug' })
  }

  const post = await fetchWordPressPostBySlug(slug)
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Blog post not found' })
  }

  return post
})
