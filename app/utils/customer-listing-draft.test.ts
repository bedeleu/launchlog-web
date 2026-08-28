import { describe, expect, test } from 'bun:test'
import type { CustomerListing } from '~/composables/useCustomerListings'
import { customerDraft, isCustomerListingDirty } from './customer-listing-draft'

const LISTING = {
  id: 'listing-1',
  slug: 'acme',
  name: 'Acme',
  tagline: 'A useful launch',
  description: 'A concise public description.',
  url: 'https://acme.test',
  screenshot_url: null,
  status: 'published',
  tier: 'basic',
  published_at: '2026-08-01T12:00:00.000000Z',
  expires_at: null,
  subscription: null,
  receipt: {
    public_url: 'https://launchlog.ai/listing/acme',
    schema_url: 'https://launchlog.ai/listing/acme/schema',
    markdown_url: 'https://launchlog.ai/listing/acme/markdown',
    sitemap_url: 'https://launchlog.ai/sitemap.xml',
    llms_url: 'https://launchlog.ai/llms-full.txt',
    checks: { published: true, schema: true, markdown: true, llms: true },
  },
} satisfies CustomerListing

describe('customer listing draft', () => {
  test('starts clean from the public fields of a listing', () => {
    const draft = customerDraft(LISTING)

    expect(draft).toEqual({
      name: 'Acme',
      tagline: 'A useful launch',
      description: 'A concise public description.',
    })
    expect(isCustomerListingDirty(LISTING, draft)).toBeFalse()
  })

  test('becomes dirty when one public field changes', () => {
    const draft = customerDraft(LISTING)
    draft.tagline = 'A better launch line'

    expect(isCustomerListingDirty(LISTING, draft)).toBeTrue()
  })

  test('ignores edge whitespace that the save request normalizes', () => {
    const draft = customerDraft(LISTING)
    draft.name = '  Acme  '
    draft.tagline = '\nA useful launch\t'
    draft.description = ' A concise public description.\n'

    expect(isCustomerListingDirty(LISTING, draft)).toBeFalse()
  })

  test('treats blank optional fields and null API values as equal', () => {
    const listing = { ...LISTING, tagline: null, description: null }

    expect(isCustomerListingDirty(listing, customerDraft(listing))).toBeFalse()
    expect(customerDraft(listing)).toEqual({ name: 'Acme', tagline: '', description: '' })
  })
})
