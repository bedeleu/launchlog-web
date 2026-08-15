import { describe, expect, test } from 'bun:test'
import {
  WORDPRESS_MAX_PER_PAGE,
  WordPressUpstreamError,
  attachFeaturedImages,
  chunkIds,
  collectWordPressPostRefs,
  parseWordPressPostBySlug,
  parseWordPressPostList,
} from './wordpress-blog'

const BASE = 'https://blog.launchlog.ai'

// The exact failure shape observed in production on 2026-08-15: the origin received an
// OpenResty anti-bot challenge page instead of JSON, so `$fetch` resolved with a string.
const CHALLENGE_HTML = '<html><head><title>One moment, please...</title></head><body>checking</body></html>'

const validPost = (overrides: Record<string, unknown> = {}) => ({
  id: 172,
  date: '2026-08-15T09:00:00',
  modified: '2026-08-15T09:05:00',
  slug: 'technical-seo-for-saas-product-pages-in-2026',
  link: `${BASE}/technical-seo-for-saas-product-pages-in-2026/`,
  title: { rendered: 'Technical SEO for SaaS Product Pages' },
  excerpt: { rendered: '<p>How to structure product pages.</p>' },
  content: { rendered: '<p>Body copy.</p>' },
  ...overrides,
})

describe('parseWordPressPostList', () => {
  test('maps a valid array of posts', () => {
    const posts = parseWordPressPostList([validPost()], BASE)

    expect(posts).toHaveLength(1)
    expect(posts[0]!.slug).toBe('technical-seo-for-saas-product-pages-in-2026')
    expect(posts[0]!.title).toBe('Technical SEO for SaaS Product Pages')
    expect(posts[0]!.date).toBe('2026-08-15T09:00:00')
  })

  test('returns an empty list for an empty array', () => {
    expect(parseWordPressPostList([], BASE)).toEqual([])
  })

  test('throws a controlled upstream error when the body is an HTML challenge page', () => {
    expect(() => parseWordPressPostList(CHALLENGE_HTML, BASE)).toThrow(WordPressUpstreamError)
  })

  test('throws when the body is a WordPress error object rather than an array', () => {
    expect(() => parseWordPressPostList({ code: 'rest_post_invalid_page_number' }, BASE))
      .toThrow(WordPressUpstreamError)
  })

  test('throws when the body is null or undefined', () => {
    expect(() => parseWordPressPostList(null, BASE)).toThrow(WordPressUpstreamError)
    expect(() => parseWordPressPostList(undefined, BASE)).toThrow(WordPressUpstreamError)
  })

  test('throws when any post in the list is missing its slug', () => {
    expect(() => parseWordPressPostList([validPost(), validPost({ slug: '' })], BASE))
      .toThrow(WordPressUpstreamError)
    expect(() => parseWordPressPostList([validPost({ slug: undefined })], BASE))
      .toThrow(WordPressUpstreamError)
  })

  test('throws rather than silently dropping a malformed post from an otherwise valid batch', () => {
    expect(() => parseWordPressPostList([validPost(), 'not-a-post'], BASE))
      .toThrow(WordPressUpstreamError)
  })

  test('never leaks the upstream body into the error message', () => {
    try {
      parseWordPressPostList(CHALLENGE_HTML, BASE)
      throw new Error('expected parseWordPressPostList to throw')
    }
    catch (error) {
      const message = (error as Error).message
      expect(error).toBeInstanceOf(WordPressUpstreamError)
      expect(message).not.toContain('One moment')
      expect(message).not.toContain('<html')
      expect(message).not.toContain('checking')
      expect(message).toContain('string')
    }
  })
})

describe('parseWordPressPostBySlug', () => {
  test('returns the mapped post for a valid single-item array', () => {
    const post = parseWordPressPostBySlug([validPost()], BASE)

    expect(post).not.toBeNull()
    expect(post!.slug).toBe('technical-seo-for-saas-product-pages-in-2026')
  })

  test('returns null for an unknown slug (empty array)', () => {
    expect(parseWordPressPostBySlug([], BASE)).toBeNull()
  })

  test('throws instead of fabricating a post when the body is an HTML challenge page', () => {
    expect(() => parseWordPressPostBySlug(CHALLENGE_HTML, BASE)).toThrow(WordPressUpstreamError)
  })

  test('never returns a hollow "Untitled" post with an undefined slug', () => {
    // Regression guard for the production defect: `posts[0]` on a string body returned the
    // first character, which mapped to title "Untitled" and canonical /blog/undefined.
    for (const body of [CHALLENGE_HTML, '<', {}, { 0: '<' }, [{}], [null], ['<']]) {
      let result: unknown
      try {
        result = parseWordPressPostBySlug(body, BASE)
      }
      catch (error) {
        expect(error).toBeInstanceOf(WordPressUpstreamError)
        continue
      }

      expect(result).toBeNull()
    }
  })

  test('a returned post always carries a non-empty string slug', () => {
    const post = parseWordPressPostBySlug([validPost()], BASE)

    expect(typeof post!.slug).toBe('string')
    expect(post!.slug.length).toBeGreaterThan(0)
    expect(post!.slug).not.toBe('undefined')
  })
})

describe('collectWordPressPostRefs', () => {
  const ref = (slug: string, featuredMedia = 0) => ({
    slug,
    modified: '2026-08-15T09:05:00',
    featured_media: featuredMedia,
  })

  test('returns every published post from a single page', async () => {
    const refs = await collectWordPressPostRefs(async () => ({
      body: [ref('alpha'), ref('beta')],
      totalPages: 1,
    }))

    expect(refs.map(r => r.slug)).toEqual(['alpha', 'beta'])
  })

  test('walks every page reported by x-wp-totalpages and requests the WordPress maximum per page', async () => {
    const requested: Array<{ page: number, perPage: number }> = []

    const refs = await collectWordPressPostRefs(async (page, perPage) => {
      requested.push({ page, perPage })
      return {
        body: page === 1 ? [ref('alpha'), ref('beta')] : [ref('gamma')],
        totalPages: 2,
      }
    })

    expect(requested).toEqual([
      { page: 1, perPage: WORDPRESS_MAX_PER_PAGE },
      { page: 2, perPage: WORDPRESS_MAX_PER_PAGE },
    ])
    expect(refs.map(r => r.slug)).toEqual(['alpha', 'beta', 'gamma'])
  })

  test('never requests more than 100 posts per request', () => {
    expect(WORDPRESS_MAX_PER_PAGE).toBe(100)
  })

  test('keeps slugs distinct when a page boundary repeats a post', async () => {
    const refs = await collectWordPressPostRefs(async page => ({
      body: page === 1 ? [ref('alpha'), ref('beta')] : [ref('beta'), ref('gamma')],
      totalPages: 2,
    }))

    expect(refs.map(r => r.slug)).toEqual(['alpha', 'beta', 'gamma'])
  })

  test('throws a controlled upstream error when a later page returns an HTML challenge', async () => {
    await expect(collectWordPressPostRefs(async page => ({
      body: page === 1 ? [ref('alpha')] : CHALLENGE_HTML,
      totalPages: 2,
    }))).rejects.toThrow(WordPressUpstreamError)
  })

  test('throws when the first page is not an array', async () => {
    await expect(collectWordPressPostRefs(async () => ({
      body: CHALLENGE_HTML,
      totalPages: 1,
    }))).rejects.toThrow(WordPressUpstreamError)
  })

  test('clamps an implausible page count so a hostile header cannot drive an unbounded loop', async () => {
    let calls = 0

    await collectWordPressPostRefs(async () => {
      calls += 1
      return { body: [ref(`post-${calls}`)], totalPages: 9999 }
    })

    expect(calls).toBeLessThanOrEqual(50)
  })

  test('treats a missing or zero page count as a single page', async () => {
    let calls = 0

    const refs = await collectWordPressPostRefs(async () => {
      calls += 1
      return { body: [ref('alpha')], totalPages: 0 }
    })

    expect(calls).toBe(1)
    expect(refs.map(r => r.slug)).toEqual(['alpha'])
  })

  test('carries the featured media id through for the image join', async () => {
    const refs = await collectWordPressPostRefs(async () => ({
      body: [ref('alpha', 172), ref('beta', 0)],
      totalPages: 1,
    }))

    expect(refs[0]!.featuredMediaId).toBe(172)
    expect(refs[1]!.featuredMediaId).toBeNull()
  })
})

describe('chunkIds', () => {
  test('keeps a batch that already fits in one request intact', () => {
    expect(chunkIds([1, 2, 3], WORDPRESS_MAX_PER_PAGE)).toEqual([[1, 2, 3]])
  })

  test('splits so no media request ever asks for more than the WordPress maximum', () => {
    const ids = Array.from({ length: 250 }, (_, index) => index + 1)
    const chunks = chunkIds(ids, WORDPRESS_MAX_PER_PAGE)

    expect(chunks).toHaveLength(3)
    expect(chunks.every(chunk => chunk.length <= WORDPRESS_MAX_PER_PAGE)).toBe(true)
    expect(chunks.flat()).toEqual(ids)
  })

  test('returns nothing for an empty batch', () => {
    expect(chunkIds([], WORDPRESS_MAX_PER_PAGE)).toEqual([])
  })
})

describe('attachFeaturedImages', () => {
  const refs = [
    { slug: 'alpha', modified: '2026-08-15T09:05:00', featuredMediaId: 172, featuredImage: null },
    { slug: 'beta', modified: '2026-08-14T09:05:00', featuredMediaId: 999, featuredImage: null },
    { slug: 'gamma', modified: '2026-08-13T09:05:00', featuredMediaId: null, featuredImage: null },
  ]

  test('joins media rows onto the matching posts', () => {
    const joined = attachFeaturedImages(refs, [
      { id: 172, source_url: `${BASE}/wp-content/uploads/2026/08/featured.webp` },
    ])

    expect(joined[0]!.featuredImage).toBe(`${BASE}/wp-content/uploads/2026/08/featured.webp`)
  })

  test('leaves posts without a matching media row untouched', () => {
    const joined = attachFeaturedImages(refs, [
      { id: 172, source_url: `${BASE}/wp-content/uploads/2026/08/featured.webp` },
    ])

    expect(joined[1]!.featuredImage).toBeNull()
    expect(joined[2]!.featuredImage).toBeNull()
  })

  test('tolerates an unusable media payload without losing any post', () => {
    for (const media of [CHALLENGE_HTML, null, undefined, { code: 'rest_forbidden' }]) {
      const joined = attachFeaturedImages(refs, media)

      expect(joined.map(r => r.slug)).toEqual(['alpha', 'beta', 'gamma'])
      expect(joined.every(r => r.featuredImage === null)).toBe(true)
    }
  })

  test('ignores media rows with an unusable source url', () => {
    const joined = attachFeaturedImages(refs, [{ id: 172, source_url: '' }, { id: 999 }])

    expect(joined.every(r => r.featuredImage === null)).toBe(true)
  })
})
