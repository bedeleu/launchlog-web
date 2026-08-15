export default defineSitemapEventHandler(async () => {
  // Every published post, not a recent-N window: the sitemap is the only complete
  // discovery path for the mirrored blog corpus.
  const refs = await fetchAllWordPressPostRefs()

  return refs.map(ref => ({
    loc: `/blog/${ref.slug}`,
    lastmod: ref.modified,
    images: ref.featuredImage ? [{ loc: ref.featuredImage }] : undefined,
  }))
})
