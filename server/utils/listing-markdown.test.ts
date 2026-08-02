import { describe, expect, test } from 'bun:test'
import type { Listing } from '../../app/composables/useListings'
import { renderListingMarkdown } from './listing-markdown'

const listing: Listing = {
  slug: 'acme',
  name: 'Acme',
  tagline: 'Ship faster',
  description: 'A concise product description.',
  link_text: null,
  url: 'https://acme.test',
  screenshot_url: null,
  tier: 'basic',
  source: 'customer',
  category: { slug: 'developer-tools', name: 'Developer Tools' },
  tags: [{ slug: 'shipping', name: 'Shipping' }],
  tech_stack: ['Nuxt'],
  has_llms_txt: true,
  has_schema_org: true,
  has_markdown_negotiation: true,
  country: 'US',
  pricing: { low: 0, high: 24, currency: 'USD' },
  published_at: '2026-07-28T10:00:00Z',
  enriched_at: null,
}

describe('renderListingMarkdown', () => {
  test('renders factual listing data and canonical attribution', () => {
    const output = renderListingMarkdown(listing, 'launchlog.ai')

    expect(output).toContain('# Acme')
    expect(output).toContain('> Ship faster')
    expect(output).toContain('**Website:** https://acme.test')
    expect(output).toContain('**Last updated:** 2026-07-28')
    expect(output).toContain('A concise product description.')
    expect(output).toContain('- Nuxt')
    expect(output).toContain('Developer Tools')
    expect(output).toContain('- Shipping')
    expect(output).toContain('https://launchlog.ai/listing/acme')
    expect(output).not.toContain('undefined')
  })

  test('renders sparse nullable data without leaking implementation values', () => {
    const sparse = {
      ...listing,
      slug: 'sparse',
      name: 'Sparse',
      tagline: null,
      description: null,
      category: null,
      tags: [],
      tech_stack: [],
      published_at: null,
    } as unknown as Listing

    const output = renderListingMarkdown(sparse, 'launchlog.ai')

    expect(output).toContain('# Sparse')
    expect(output).toContain('**Last updated:** unknown')
    expect(output).toContain('## Description\n\n\n\n## Tech Stack')
    expect(output).toContain('## Category\n\nUncategorized')
    expect(output).toContain('## Tags\n\n_None_')
    expect(output).toContain('https://launchlog.ai/listing/sparse')
    expect(output).not.toContain('undefined')
    expect(output).not.toContain('null')
  })
})
