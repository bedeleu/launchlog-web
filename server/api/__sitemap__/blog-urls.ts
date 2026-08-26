import { BLOG_ARCHIVE_PER_PAGE } from '../../utils/wordpress-blog'
import { paginationSitemapEntries } from '../../utils/pagination-sitemap'

export default defineSitemapEventHandler(async () => {
  // Every published post, not a recent-N window: the sitemap is the only complete
  // discovery path for the mirrored blog corpus.
  const refs = await fetchAllWordPressPostRefs()

  const postEntries = refs.map(ref => ({
    loc: `/blog/${ref.slug}`,
    lastmod: ref.modified,
    images: ref.featuredImage ? [{ loc: ref.featuredImage }] : undefined,
  }))

  const lastArchivePage = Math.max(1, Math.ceil(refs.length / BLOG_ARCHIVE_PER_PAGE))

  return [
    ...postEntries,
    ...paginationSitemapEntries('/blog', lastArchivePage),
  ]
})
