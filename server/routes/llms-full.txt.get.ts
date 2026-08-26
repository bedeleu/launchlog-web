// server/routes/llms-full.txt.get.ts
// Dynamic /llms-full.txt — complete listing and article index for compatible consumers.

interface PublicListing {
  slug: string
  name: string
  tagline: string | null
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  const site = getSiteUrl()
  const apiUrl = useRuntimeConfig().public.apiUrl

  let listings: PublicListing[]
  try {
    const res = await $fetch<{ data: PublicListing[] }>(`${apiUrl}/api/v1/discovery/listings`, {
      timeout: 5000,
    })
    listings = res?.data ?? []
  } catch {
    listings = []
  }

  let posts: Array<{ slug: string; title: string; excerpt: string }>
  try {
    const blog = await fetchAllWordPressPostSummaries()
    posts = (blog ?? []).map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt }))
  } catch {
    posts = []
  }

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
  lines.push('## Published blog articles')
  lines.push('')
  if (posts.length === 0) {
    lines.push('(No articles available.)')
  } else {
    for (const p of posts) {
      const title = p.title.replace(/[\r\n]+/g, ' ').trim()
      const excerpt = p.excerpt.replace(/[\r\n]+/g, ' ').trim()
      lines.push(`- ${title}${excerpt ? ` — ${excerpt}` : ''}`)
      lines.push(`  ${site}/blog/${p.slug}`)
    }
  }
  lines.push('')
  lines.push('This index is an optional representation for compatible non-Google consumers. It does not guarantee indexing, ranking, traffic or citation.')
  lines.push('')
  return lines.join('\n')
})
