import type { Listing } from '../../app/composables/useListings'

export const renderListingMarkdown = (listing: Listing, domain: string): string => `# ${listing.name}

> ${listing.tagline ?? ''}

**Website:** ${listing.url}
**Last updated:** ${listing.published_at ? new Date(listing.published_at).toISOString().split('T')[0] : 'unknown'}

## Description

${listing.description ?? ''}

## Tech Stack

${(listing.tech_stack ?? []).map(technology => `- ${technology}`).join('\n')}

## Category

${listing.category?.name ?? 'Uncategorized'}

## Tags

${(listing.tags ?? []).map(tag => `- ${tag.name}`).join('\n') || '_None_'}

---

*Listed on [${domain}](https://${domain}/listing/${listing.slug})*
`
