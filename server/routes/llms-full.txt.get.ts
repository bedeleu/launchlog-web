// server/routes/llms-full.txt.get.ts
// Dynamic /llms-full.txt — complete listing and article index for compatible consumers.

import { setHeader, setResponseStatus } from 'h3'
import { createEditionClient } from '../../app/composables/useEditions'
import { parseDiscoveryListingsOrThrow, type DiscoveryListing } from '../utils/discovery'
import { collectEditionSummaries } from '../utils/edition-discovery'

export default defineEventHandler(async (event) => {
  const site = getSiteUrl()
  const apiUrl = useRuntimeConfig().public.apiUrl

  let listings: DiscoveryListing[]
  let posts: Array<{ slug: string, title: string, excerpt: string }>
  let editions: Awaited<ReturnType<typeof collectEditionSummaries>>
  try {
    const editionClient = createEditionClient(
      $fetch as unknown as (url: string, options?: Record<string, unknown>) => Promise<unknown>,
      apiUrl,
    )
    const [response, blog, editionResult] = await Promise.all([
      $fetch<unknown>(`${apiUrl}/api/v1/discovery/listings`, { timeout: 5000 }),
      fetchAllWordPressPostSummaries(),
      collectEditionSummaries(page => editionClient.fetchArchive(page), 53),
    ])

    if (!isRecord(response) || !Object.hasOwn(response, 'data')) {
      throw new TypeError('Invalid discovery listing response')
    }

    listings = parseDiscoveryListingsOrThrow(response.data)
    posts = (blog ?? []).map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt }))
    editions = editionResult
  }
  catch {
    setResponseStatus(event, 503)
    setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    setHeader(event, 'Cache-Control', 'private, no-store')
    return '# LaunchLog — temporarily unavailable\n'
  }

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=600')

  const lines: string[] = []
  lines.push('# LaunchLog — complete directory index')
  lines.push('')
  lines.push('> Curated paid directory for indie makers, SaaS founders and tech launches.')
  lines.push('> Paid listings publish after successful checkout, remain subject to moderation, and expose schema.org JSON-LD plus markdown.')
  lines.push('')
  lines.push(`Canonical site: ${site}`)
  lines.push('')
  lines.push('## Published listings')
  lines.push('')
  if (listings.length === 0) {
    lines.push('(No public listings indexed yet.)')
  } else {
    for (const l of listings) {
      // Strip newlines so a stray newline in an API-sourced field can't break the line-based format.
      const name = (l.name ?? '').replace(/[\r\n]+/g, ' ').trim()
      const tagline = (l.tagline ?? '').replace(/[\r\n]+/g, ' ').trim()
      lines.push(`- ${name} — ${tagline}`)
      lines.push(`  ${site}/listing/${l.slug}`)
    }
  }
  lines.push('')
  lines.push('## Published weekly editions')
  lines.push('')
  if (editions.rows.length === 0) {
    lines.push('(No weekly editions published yet.)')
  } else {
    for (const edition of editions.rows.slice(0, 52)) {
      const introduction = singleLine(edition.introduction ?? '')
      const period = `${edition.week_starts_at} to ${edition.week_ends_at}`
      lines.push(`- ${edition.slug} — ${period}${introduction ? ` — ${introduction}` : ''}`)
      lines.push(`  ${site}${edition.path}`)
    }
  }
  if (editions.total > 52) {
    lines.push('')
    lines.push('More published editions are available in the sitemap:')
    lines.push(`${site}/sitemap.xml`)
  }
  lines.push('')
  lines.push('## Published blog articles')
  lines.push('')
  if (posts.length === 0) {
    lines.push('(No articles available.)')
  } else {
    for (const p of posts) {
      const title = singleLine(p.title)
      const excerpt = singleLine(p.excerpt)
      lines.push(`- ${title}${excerpt ? ` — ${excerpt}` : ''}`)
      lines.push(`  ${site}/blog/${p.slug}`)
    }
  }
  lines.push('')
  lines.push('This index is an optional representation for compatible non-Google consumers. It does not guarantee indexing, ranking, traffic or citation.')
  lines.push('')
  return lines.join('\n')
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}
