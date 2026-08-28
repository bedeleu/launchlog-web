import type { CustomerListingStatus } from '~/composables/useCustomerListings'

export const receiptRows = [
  { key: 'published' as const, label: 'Public listing', linkKey: 'public_url' as const, action: 'View page' },
  { key: 'schema' as const, label: 'Structured data', linkKey: 'schema_url' as const, action: 'Inspect JSON-LD' },
  { key: 'markdown' as const, label: 'Markdown response', linkKey: 'markdown_url' as const, action: 'View Markdown' },
  { key: 'llms' as const, label: 'AI discovery feed', linkKey: 'llms_url' as const, action: 'Open feed' },
]

interface ReceiptLinks {
  public_url: string
  schema_url?: string
  markdown_url: string
  sitemap_url: string
  llms_url: string
}

interface ReceiptWithChecks extends ReceiptLinks {
  checks: Record<'published' | 'schema' | 'markdown' | 'llms', boolean>
}

export function receiptArtifactUrl(receipt: ReceiptLinks, row: typeof receiptRows[number]): string {
  if (row.key === 'schema') return receipt.schema_url ?? `${receipt.public_url}/schema`
  if (row.key === 'markdown' && receipt.markdown_url === receipt.public_url) {
    return `${receipt.public_url}/markdown`
  }
  return receipt[row.linkKey]
}

export function receiptUnavailableLabel(status: CustomerListingStatus): 'Pending' | 'Not published' | 'Unavailable' {
  if (status === 'draft' || status === 'pending_review') return 'Pending'
  if (status === 'archived' || status === 'rejected' || status === 'spam') return 'Not published'
  return 'Unavailable'
}

/**
 * The four artifacts a published release exposes, as they appear on the public
 * record. Each one is a real, separately resolvable URL: the page itself, its
 * schema.org graph, its Markdown representation, and the site-wide discovery
 * feed the release is listed in.
 *
 * The customer dashboard reads these URLs from the API receipt; the public page
 * has no receipt payload, so it derives them from the canonical site URL and the
 * slug. Both must stay in step with the routes in server/routes/listing/.
 */
export interface ListingProofDestination {
  key: 'published' | 'schema' | 'markdown' | 'llms'
  label: string
  description: string
  url: string
}

const proofDescriptions: Record<ListingProofDestination['key'], string> = {
  published: 'The canonical HTML page people and crawlers can open.',
  schema: 'The same release facts as a standalone schema.org graph.',
  markdown: 'The same release facts as a direct Markdown representation.',
  llms: 'The site-wide machine-readable feed that includes this release.',
}

export function receiptProofDestinations(receipt: ReceiptWithChecks): ListingProofDestination[] {
  return receiptRows.map(row => ({
    key: row.key,
    label: row.key === 'published'
      ? 'Public page'
      : row.key === 'markdown'
        ? 'Markdown representation'
        : row.key === 'llms'
          ? 'Discovery feed'
          : row.label,
    description: proofDescriptions[row.key],
    url: receiptArtifactUrl(receipt, row),
  }))
}

export function listingProofDestinations(siteUrl: string, slug: string): ListingProofDestination[] {
  const publicUrl = `${siteUrl}/listing/${slug}`

  return [
    {
      key: 'published',
      label: 'Public page',
      description: proofDescriptions.published,
      url: publicUrl,
    },
    {
      key: 'schema',
      label: 'Structured data',
      description: proofDescriptions.schema,
      url: `${publicUrl}/schema`,
    },
    {
      key: 'markdown',
      label: 'Markdown representation',
      description: proofDescriptions.markdown,
      url: `${publicUrl}/markdown`,
    },
    {
      key: 'llms',
      label: 'Discovery feed',
      description: proofDescriptions.llms,
      url: `${siteUrl}/llms-full.txt`,
    },
  ]
}
