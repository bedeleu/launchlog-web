export default defineSitemapEventHandler(async () => {
  const posts = await fetchWordPressPosts(50)

  return posts.map((post) => ({
    loc: `/blog/${post.slug}`,
    lastmod: post.modified,
    images: post.featuredImage ? [{ loc: post.featuredImage }] : undefined,
  }))
})
