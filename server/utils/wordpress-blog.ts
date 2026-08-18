import { sanitizeWordPressHtml } from './sanitize-wordpress-html'

interface WordPressRendered {
  rendered?: string
}

interface WordPressMedia {
  source_url?: string
  alt_text?: string
  media_details?: {
    width?: number
    height?: number
  }
}

interface WordPressTerm {
  name?: string
}

interface WordPressPost {
  id: number
  date: string
  modified: string
  slug: string
  link: string
  title?: WordPressRendered
  excerpt?: WordPressRendered
  content?: WordPressRendered
  _embedded?: {
    author?: Array<{ name?: string }>
    'wp:featuredmedia'?: WordPressMedia[]
    'wp:term'?: WordPressTerm[][]
  }
}

export interface BlogPost {
  id: number
  slug: string
  title: string
  excerpt: string
  content: string
  date: string
  modified: string
  sourceUrl: string
  featuredImage: string | null
  featuredImageAlt: string | null
  authorName: string | null
  categories: string[]
}

/** Pagination envelope for one blog archive page. */
export interface BlogArchiveMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface BlogArchivePage {
  posts: BlogPost[]
  meta: BlogArchiveMeta
}

/** Slug + lastmod pair used to build the blog half of the sitemap. */
export interface WordPressPostRef {
  slug: string
  modified: string
  featuredMediaId: number | null
  featuredImage: string | null
}

/** Fetches one page of posts and reports how many pages the upstream says exist. */
export type WordPressPageFetcher = (page: number, perPage: number) => Promise<{ body: unknown, totalPages: number }>

const DEFAULT_WORDPRESS_BLOG_URL = 'https://blog.launchlog.ai'
const WORDPRESS_USER_AGENT = 'LaunchLogBot/1.0 (+https://launchlog.ai)'
const WORDPRESS_TIMEOUT_MS = 8000

/** WordPress REST caps `per_page` at 100 and answers 400 for a page beyond the last one. */
export const WORDPRESS_MAX_PER_PAGE = 100

/**
 * Posts per blog archive page. Before pagination existed the archive rendered a fixed newest-24
 * window, so every older post was reachable only from the sitemap and had no internal link path.
 */
export const BLOG_ARCHIVE_PER_PAGE = 24

/** The code WordPress returns when the requested page number is past the last one. */
const WORDPRESS_INVALID_PAGE_CODE = 'rest_post_invalid_page_number'

/** Backstop so a malformed x-wp-totalpages header cannot drive an unbounded fetch loop. */
const MAX_WORDPRESS_PAGES = 50

/**
 * Raised when the blog origin answers with something that is not a WordPress REST payload —
 * in production this was an OpenResty anti-bot challenge page served to the Railway egress IP.
 * The upstream body is deliberately never included: it is attacker-influenced and can be large.
 */
export class WordPressUpstreamError extends Error {
  constructor(reason: string) {
    super(`WordPress upstream returned an unusable response: ${reason}`)
    this.name = 'WordPressUpstreamError'
  }
}

/**
 * Raised when the requested archive page cannot exist. Deliberately NOT a WordPressUpstreamError:
 * that one means "the origin is unusable" and maps to 503, while this means "there is no such page"
 * and maps to 404. Answering 503 for `?page=999` would keep an unbounded set of junk URLs alive in
 * every crawl queue that ever saw one.
 */
export class WordPressPageOutOfRangeError extends Error {
  constructor(page: number, lastPage?: number) {
    super(lastPage === undefined
      ? `Blog archive page ${page} does not exist`
      : `Blog archive page ${page} does not exist; the archive has ${lastPage} page(s)`)
    this.name = 'WordPressPageOutOfRangeError'
  }
}

/**
 * `?page=` -> a real page number, or `null` when the value can never be one.
 *
 * An absent parameter is page 1; anything present must be the *canonical* decimal form of a
 * positive safe integer. Two classes of near-miss are rejected on purpose:
 *
 * - aliases (`01`, `0002`, ` 2`, `+2`, `2.0`) address exactly the posts that `1` and `2` already
 *   address, so accepting them mints extra indexable URLs for content that has one;
 * - anything past `Number.MAX_SAFE_INTEGER` stops round-tripping through `Number`, so it cannot
 *   name a page at all — rejected here rather than forwarded to WordPress.
 */
export function parseBlogPageParam(raw: unknown): number | null {
  if (raw === undefined || raw === null) {
    return 1
  }

  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw >= 1 ? raw : null
  }

  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return null
  }

  const page = Number(raw)

  return Number.isSafeInteger(page) && page >= 1 && String(page) === raw ? page : null
}

/** True only when WordPress rejected the page number itself, rather than failing to answer. */
export function isWordPressInvalidPageNumberError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false
  }

  const response = error.response
  const bodies = [error.data, isRecord(response) ? response._data : undefined]

  return bodies.some(body => isRecord(body) && body.code === WORDPRESS_INVALID_PAGE_CODE)
}

/**
 * Assembles one archive page from an upstream body plus its `x-wp-total` header. Pure, so the
 * pagination arithmetic is testable without a WordPress origin.
 */
export function buildBlogArchivePage(
  body: unknown,
  total: unknown,
  page: number,
  perPage: number,
  baseUrl: string,
): BlogArchivePage {
  const totalPosts = parsePostTotal(total)
  const lastPage = totalPosts === 0 ? 1 : Math.ceil(totalPosts / perPage)

  if (page > lastPage) {
    throw new WordPressPageOutOfRangeError(page, lastPage)
  }

  return {
    posts: parseWordPressPostList(body, baseUrl),
    meta: {
      current_page: page,
      last_page: lastPage,
      per_page: perPage,
      total: totalPosts,
    },
  }
}

export function wordpressBlogBaseUrl(): string {
  const config = useRuntimeConfig()
  const configuredUrl = config.public.wordpressBlogUrl || DEFAULT_WORDPRESS_BLOG_URL

  return String(configuredUrl).replace(/\/+$/, '')
}

export function parseWordPressPostList(body: unknown, baseUrl: string): BlogPost[] {
  return assertPostArray(body).map(entry => mapWordPressPost(assertWordPressPost(entry), baseUrl))
}

export function parseWordPressPostBySlug(body: unknown, baseUrl: string): BlogPost | null {
  const posts = assertPostArray(body)

  if (posts.length === 0) {
    return null
  }

  return mapWordPressPost(assertWordPressPost(posts[0]), baseUrl)
}

export async function collectWordPressPostRefs(fetchPage: WordPressPageFetcher): Promise<WordPressPostRef[]> {
  const refs: WordPressPostRef[] = []
  const seenSlugs = new Set<string>()
  let totalPages = 1

  for (let page = 1; page <= totalPages; page += 1) {
    const response = await fetchPage(page, WORDPRESS_MAX_PER_PAGE)

    if (page === 1) {
      totalPages = clampPageCount(response.totalPages)
    }

    for (const entry of assertPostArray(response.body)) {
      const ref = toPostRef(entry)

      if (seenSlugs.has(ref.slug)) {
        continue
      }

      seenSlugs.add(ref.slug)
      refs.push(ref)
    }
  }

  return refs
}

export function chunkIds(ids: number[], size: number): number[][] {
  const chunks: number[][] = []

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }

  return chunks
}

export function attachFeaturedImages(refs: WordPressPostRef[], media: unknown): WordPressPostRef[] {
  const sourceUrls = new Map<number, string>()

  if (Array.isArray(media)) {
    for (const row of media) {
      if (!isRecord(row)) {
        continue
      }

      const { id, source_url: sourceUrl } = row

      if (typeof id === 'number' && typeof sourceUrl === 'string' && sourceUrl.trim() !== '') {
        sourceUrls.set(id, sourceUrl)
      }
    }
  }

  return refs.map(ref => ({
    ...ref,
    featuredImage: ref.featuredMediaId === null ? null : sourceUrls.get(ref.featuredMediaId) ?? null,
  }))
}

export async function fetchWordPressPosts(limit = 24): Promise<BlogPost[]> {
  const baseUrl = wordpressBlogBaseUrl()

  const body = await $fetch<unknown>(`${baseUrl}/wp-json/wp/v2/posts`, {
    query: {
      _embed: 1,
      per_page: limit,
      status: 'publish',
    },
    headers: {
      'User-Agent': WORDPRESS_USER_AGENT,
    },
    // Fail fast if the WordPress host is cold/slow so SSR pages and /llms-full.txt
    // don't hang on the platform's default TCP timeout.
    timeout: WORDPRESS_TIMEOUT_MS,
  })

  return parseWordPressPostList(body, baseUrl)
}

/**
 * One archive page plus its pagination meta. Posts stay in WordPress' default `date desc` order so
 * the visible "latest first" archive is unchanged; all 76 published dates are currently distinct, so
 * that order is total and no post can straddle a page boundary. (The sitemap orders by id instead
 * because it walks the whole corpus, where a tie would silently drop a slug.)
 */
export async function fetchWordPressPostsPage(
  page: number,
  perPage: number = BLOG_ARCHIVE_PER_PAGE,
): Promise<BlogArchivePage> {
  const baseUrl = wordpressBlogBaseUrl()

  const response = await $fetch.raw<unknown>(`${baseUrl}/wp-json/wp/v2/posts`, {
    query: {
      _embed: 1,
      page,
      per_page: perPage,
      status: 'publish',
    },
    headers: {
      'User-Agent': WORDPRESS_USER_AGENT,
    },
    timeout: WORDPRESS_TIMEOUT_MS,
  }).catch((cause: unknown) => {
    // A page past the last one is the archive saying "no such page", not the origin failing.
    if (isWordPressInvalidPageNumberError(cause)) {
      throw new WordPressPageOutOfRangeError(page)
    }

    throw cause
  })

  return buildBlogArchivePage(
    response._data,
    response.headers.get('x-wp-total'),
    page,
    perPage,
    baseUrl,
  )
}

export async function fetchWordPressPostBySlug(slug: string): Promise<BlogPost | null> {
  const baseUrl = wordpressBlogBaseUrl()

  const body = await $fetch<unknown>(`${baseUrl}/wp-json/wp/v2/posts`, {
    query: {
      _embed: 1,
      slug,
      status: 'publish',
    },
    headers: {
      'User-Agent': WORDPRESS_USER_AGENT,
    },
    timeout: WORDPRESS_TIMEOUT_MS,
  })

  return parseWordPressPostBySlug(body, baseUrl)
}

/**
 * Every published post, walked page by page. Requests only the fields the sitemap needs
 * (`_embed` would pull ~700KB and take ~5s for the same data), then resolves featured
 * images with one small media lookup per 100 posts.
 */
export async function fetchAllWordPressPostRefs(): Promise<WordPressPostRef[]> {
  const baseUrl = wordpressBlogBaseUrl()

  const refs = await collectWordPressPostRefs(async (page, perPage) => {
    const response = await $fetch.raw<unknown>(`${baseUrl}/wp-json/wp/v2/posts`, {
      query: {
        page,
        per_page: perPage,
        status: 'publish',
        // Ordering by id is a total order; ordering by date is not, and two posts sharing a
        // publish timestamp can straddle a page boundary and drop a slug from the sitemap.
        orderby: 'id',
        order: 'desc',
        _fields: 'slug,modified,featured_media',
      },
      headers: {
        'User-Agent': WORDPRESS_USER_AGENT,
      },
      timeout: WORDPRESS_TIMEOUT_MS,
    })

    return {
      body: response._data,
      totalPages: Number(response.headers.get('x-wp-totalpages') ?? 1),
    }
  })

  const mediaIds = [...new Set(refs.map(ref => ref.featuredMediaId).filter(isNumber))]

  if (mediaIds.length === 0) {
    return refs
  }

  const mediaRows: unknown[] = []

  for (const chunk of chunkIds(mediaIds, WORDPRESS_MAX_PER_PAGE)) {
    // A missing featured image must never cost us a sitemap entry, so the media lookup
    // degrades to "no image" instead of failing the whole sitemap source.
    const rows = await $fetch<unknown>(`${baseUrl}/wp-json/wp/v2/media`, {
      query: {
        include: chunk.join(','),
        per_page: WORDPRESS_MAX_PER_PAGE,
        _fields: 'id,source_url',
      },
      headers: {
        'User-Agent': WORDPRESS_USER_AGENT,
      },
      timeout: WORDPRESS_TIMEOUT_MS,
    }).catch(() => null)

    if (Array.isArray(rows)) {
      mediaRows.push(...rows)
    }
  }

  return attachFeaturedImages(refs, mediaRows)
}

function assertPostArray(body: unknown): unknown[] {
  if (!Array.isArray(body)) {
    throw new WordPressUpstreamError(`expected a JSON array of posts, received ${describeShape(body)}`)
  }

  return body
}

function assertWordPressPost(entry: unknown): WordPressPost {
  const record = assertRecord(entry)

  requiredString(record, 'slug')
  requiredString(record, 'date')
  requiredString(record, 'modified')

  if (!isNumber(record.id)) {
    throw new WordPressUpstreamError('post is missing a usable "id" field')
  }

  return record as unknown as WordPressPost
}

function toPostRef(entry: unknown): WordPressPostRef {
  const record = assertRecord(entry)
  const featuredMedia = record.featured_media

  return {
    slug: requiredString(record, 'slug'),
    modified: requiredString(record, 'modified'),
    featuredMediaId: isNumber(featuredMedia) && featuredMedia > 0 ? featuredMedia : null,
    featuredImage: null,
  }
}

function assertRecord(entry: unknown): Record<string, unknown> {
  if (!isRecord(entry)) {
    throw new WordPressUpstreamError(`expected a post object, received ${describeShape(entry)}`)
  }

  return entry
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key]

  if (typeof value !== 'string' || value.trim() === '') {
    throw new WordPressUpstreamError(`post is missing a usable "${key}" field`)
  }

  return value
}

/**
 * `x-wp-total` is the only thing that distinguishes "this is the last page" from "there are more".
 * Guessing when it is missing is how the archive lost 52 posts from its link graph, so an unusable
 * value is treated as an unusable upstream rather than silently collapsing to a single page.
 */
function parsePostTotal(value: unknown): number {
  const total = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN

  if (!Number.isInteger(total) || total < 0) {
    throw new WordPressUpstreamError(
      `expected an "x-wp-total" post count, received ${describeShape(value)}`,
    )
  }

  return total
}

function clampPageCount(totalPages: number): number {
  const pages = Math.trunc(totalPages) || 1

  return Math.min(Math.max(pages, 1), MAX_WORDPRESS_PAGES)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Type name only — the upstream body is never echoed into an error, a log or a response. */
function describeShape(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (Array.isArray(value)) {
    return 'array'
  }

  return typeof value
}

function mapWordPressPost(post: WordPressPost, baseUrl: string): BlogPost {
  const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0]

  return {
    id: post.id,
    slug: post.slug,
    title: cleanText(post.title?.rendered ?? 'Untitled'),
    excerpt: cleanText(post.excerpt?.rendered ?? ''),
    content: sanitizeWordPressHtml(post.content?.rendered ?? '', baseUrl),
    date: post.date,
    modified: post.modified,
    sourceUrl: post.link,
    featuredImage: featuredMedia?.source_url ?? null,
    featuredImageAlt: cleanText(featuredMedia?.alt_text ?? post.title?.rendered ?? '') || null,
    authorName: post._embedded?.author?.[0]?.name ?? null,
    categories: (post._embedded?.['wp:term'] ?? [])
      .flat()
      .map(term => cleanText(term.name ?? ''))
      .filter(Boolean),
  }
}

function cleanText(value: string): string {
  return decodeHtml(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/([.!?])([A-Z])/g, '$1 $2')
    .trim()
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
}

/**
 * One pass, no rescanning: the output of a replacement is never decoded again, so `&amp;quot;`
 * yields the literal text `&quot;` instead of `"` and double-encoded input survives intact.
 * Numeric entities go through `String.fromCodePoint` because `fromCharCode` truncates astral
 * code points (`&#x1F680;` must become 🚀, not a mangled surrogate half).
 */
function decodeHtml(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([a-f0-9]+)|([a-z]+));/gi, (match, dec?: string, hex?: string, named?: string) => {
    if (dec !== undefined || hex !== undefined) {
      const codePoint = dec !== undefined ? Number(dec) : parseInt(hex!, 16)

      if (
        !Number.isInteger(codePoint)
        || codePoint < 0
        || codePoint > 0x10FFFF
        // Surrogates are not Unicode scalar values; a lone one corrupts UTF-8 serialization.
        || (codePoint >= 0xD800 && codePoint <= 0xDFFF)
      ) {
        return match
      }

      return String.fromCodePoint(codePoint)
    }

    return NAMED_ENTITIES[named!.toLowerCase()] ?? match
  })
}
