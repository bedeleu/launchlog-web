import type { Listing } from '../../app/composables/useListings'
import { escapeMarkdownText, renderSafeHttpsLink } from './markdown'

export const renderListingMarkdown = (listing: Listing, domain: string): string => `# ${escapeMarkdownText(listing.name)}

> ${escapeMarkdownText(listing.tagline ?? '')}

**Website:** ${renderSafeHttpsLink('Website', listing.url, 'paid')}
**Published:** ${listing.published_at ? new Date(listing.published_at).toISOString().split('T')[0] : 'unknown'}

## Description

${escapeMarkdownText(listing.description ?? '')}

## Tech Stack

${(listing.tech_stack ?? []).map(technology => `- ${escapeMarkdownText(technology)}`).join('\n')}

## Category

${escapeMarkdownText(listing.category?.name ?? 'Uncategorized')}

## Tags

${(listing.tags ?? []).map(tag => `- ${escapeMarkdownText(tag.name)}`).join('\n') || '_None_'}

---

*Listed on [${escapeMarkdownText(domain)}](https://${domain}/listing/${encodeURIComponent(listing.slug)})*
`
