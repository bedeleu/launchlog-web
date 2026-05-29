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

const DEFAULT_WORDPRESS_BLOG_URL = 'https://blog.launchlog.ai'

export function wordpressBlogBaseUrl(): string {
  const config = useRuntimeConfig()
  const configuredUrl = config.public.wordpressBlogUrl || DEFAULT_WORDPRESS_BLOG_URL

  return String(configuredUrl).replace(/\/+$/, '')
}

export async function fetchWordPressPosts(limit = 24): Promise<BlogPost[]> {
  const baseUrl = wordpressBlogBaseUrl()

  const posts = await $fetch<WordPressPost[]>(`${baseUrl}/wp-json/wp/v2/posts`, {
    query: {
      _embed: 1,
      per_page: limit,
      status: 'publish',
    },
    headers: {
      'User-Agent': 'LaunchLogBot/1.0 (+https://launchlog.ai)',
    },
  })

  return posts.map((post) => mapWordPressPost(post, baseUrl))
}

export async function fetchWordPressPostBySlug(slug: string): Promise<BlogPost | null> {
  const baseUrl = wordpressBlogBaseUrl()

  const posts = await $fetch<WordPressPost[]>(`${baseUrl}/wp-json/wp/v2/posts`, {
    query: {
      _embed: 1,
      slug,
      status: 'publish',
    },
    headers: {
      'User-Agent': 'LaunchLogBot/1.0 (+https://launchlog.ai)',
    },
  })

  const post = posts[0]

  return post ? mapWordPressPost(post, baseUrl) : null
}

function mapWordPressPost(post: WordPressPost, baseUrl: string): BlogPost {
  const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0]

  return {
    id: post.id,
    slug: post.slug,
    title: cleanText(post.title?.rendered ?? 'Untitled'),
    excerpt: cleanText(post.excerpt?.rendered ?? ''),
    content: sanitizeWordPressHtml(absolutizeUrls(post.content?.rendered ?? '', baseUrl)),
    date: post.date,
    modified: post.modified,
    sourceUrl: post.link,
    featuredImage: featuredMedia?.source_url ?? null,
    featuredImageAlt: cleanText(featuredMedia?.alt_text ?? post.title?.rendered ?? '') || null,
    authorName: post._embedded?.author?.[0]?.name ?? null,
    categories: (post._embedded?.['wp:term'] ?? [])
      .flat()
      .map((term) => cleanText(term.name ?? ''))
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

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function absolutizeUrls(html: string, baseUrl: string): string {
  return html.replace(/\s(src|href)=["']\/([^"']*)["']/gi, (_match, attribute: string, path: string) => {
    return ` ${attribute}="${baseUrl}/${path}"`
  })
}

function sanitizeWordPressHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/\son[a-z]+=["'][^"']*["']/gi, '')
    .replace(/\s(href|src)=["']javascript:[^"']*["']/gi, '')
}
