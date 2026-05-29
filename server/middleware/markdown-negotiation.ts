/*
 * D-009 "invisible tech edge" — pillar #3 of three.
 *
 * Every /listing/{slug} URL returns markdown when called with Accept: text/markdown.
 * Same URL, different format. Cloudflare's "Markdown for Agents" pattern.
 *
 * Phase 0 skeleton: returns early on non-/listing/ paths and on missing markdown Accept.
 * Real implementation lands in Phase 3 when listings exist (Section 9.3 of PRD-MVP.md) —
 * at that point this middleware will fetch the listing from the API, render it as markdown,
 * and set the proper Vary / Content-Signal / Cache-Control headers.
 */
export default defineEventHandler(async (event) => {
  const accept = getRequestHeader(event, 'accept') ?? ''
  if (!accept.includes('text/markdown')) return

  const url = getRequestURL(event)
  if (!url.pathname.startsWith('/listing/')) return

  const slug = url.pathname.replace('/listing/', '').replace(/\/$/, '')
  if (!slug) return

  const config = useRuntimeConfig()

  try {
    // NUXT_PUBLIC_API_URL is the host only (e.g. https://api.launchlog.ai), without the /api prefix.
    // The Laravel routes/api.php is mounted under apiPrefix: 'api' (bootstrap/app.php), so callers must
    // include /api/v1/... in the path. See D-051 / plan v5 Resolved upfront point 5.
    // The API wraps the resource in a JsonResource envelope ({ data: {...} }).
    const envelope: any = await $fetch(`${config.public.apiUrl}/api/v1/listings/${slug}`).catch(() => null)
    const listing = envelope?.data ?? null
    if (!listing) {
      setResponseStatus(event, 404)
      setResponseHeaders(event, {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Vary': 'Accept',
      })
      return `# Not found\n\n> Listing \`${slug}\` does not exist.\n`
    }

    setResponseHeaders(event, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Vary': 'Accept',
      'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
      'Cache-Control': 's-maxage=3600',
    })

    return renderListingAsMarkdown(listing, config.public.domain as string)
  } catch {
    // Never throw from inside middleware — fall through to the regular HTML render.
    return
  }
})

function renderListingAsMarkdown(listing: any, domain: string): string {
  return `# ${listing.name}

> ${listing.tagline ?? ''}

**Website:** ${listing.url}
**Last updated:** ${listing.published_at ? new Date(listing.published_at).toISOString().split('T')[0] : 'unknown'}

## Description

${listing.description ?? ''}

## Tech Stack

${(listing.tech_stack ?? []).map((t: string) => `- ${t}`).join('\n')}

## Category

${listing.category?.name ?? 'Uncategorized'}

## Tags

${(listing.tags ?? []).map((t: { name: string }) => `- ${t.name}`).join('\n') || '_None_'}

---

*Listed on [${domain}](https://${domain}/listing/${listing.slug})*
`
}
