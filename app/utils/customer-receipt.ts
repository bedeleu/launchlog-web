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
