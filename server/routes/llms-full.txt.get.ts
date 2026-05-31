// server/routes/llms-full.txt.get.ts
// Dynamic /llms-full.txt — full context dump for AI answer engines.
// Fetches live published listings from the Laravel API and recent blog posts from WordPress.
// fetchWordPressPosts is auto-imported from server/utils/wordpress-blog.ts (Nitro server utils).

interface PublicListing {
  slug: string
  name: string
  tagline: string
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  const site = 'https://launchlog.ai'
  const apiUrl = useRuntimeConfig().public.apiUrl

  let listings: PublicListing[] = []
  try {
    const res = await $fetch<{ data: PublicListing[] }>(`${apiUrl}/api/v1/listings`, {
      query: { per_page: 200 },
    })
    listings = res?.data ?? []
  } catch {
    listings = []
  }

  let posts: Array<{ slug: string; title: string; excerpt: string }> = []
  try {
    const blog = await fetchWordPressPosts(20)
    posts = (blog ?? []).map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt }))
  } catch {
    posts = []
  }

  const lines: string[] = []
  lines.push('# LaunchLog — full context')
  lines.push('')
  lines.push('> Curated paid directory for indie makers, SaaS founders and tech launches.')
  lines.push('> Each listing is human-reviewed and exposes schema.org JSON-LD + markdown.')
  lines.push('')
  lines.push(`Canonical site: ${site}`)
  lines.push('')
  lines.push('## Published listings')
  lines.push('')
  if (listings.length === 0) {
    lines.push('(No public listings indexed yet.)')
  } else {
    for (const l of listings) {
      lines.push(`- ${l.name} — ${l.tagline}`)
      lines.push(`  ${site}/listing/${l.slug}`)
    }
  }
  lines.push('')
  lines.push('## Recent blog articles')
  lines.push('')
  if (posts.length === 0) {
    lines.push('(No articles available.)')
  } else {
    for (const p of posts) {
      lines.push(`- ${p.title} — ${site}/blog/${p.slug}`)
    }
  }
  lines.push('')
  return lines.join('\n')
})
