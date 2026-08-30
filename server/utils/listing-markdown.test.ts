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
    expect(output).toContain('<a href="https://acme.test" rel="noopener sponsored">Website</a>')
    expect(output).not.toContain('**Website:** https://acme.test')
    expect(output).toContain('**Published:** 2026-07-28')
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
    expect(output).toContain('**Published:** unknown')
    expect(output).toContain('## Description\n\n\n\n## Tech Stack')
    expect(output).toContain('## Category\n\nUncategorized')
    expect(output).toContain('## Tags\n\n_None_')
    expect(output).toContain('https://launchlog.ai/listing/sparse')
    expect(output).not.toContain('undefined')
    expect(output).not.toContain('null')
  })

  test('does not treat listing text as Markdown or HTML author syntax', () => {
    const hostile = {
      ...listing,
      name: '# title\n- [x](javascript:alert(1)) <img src=x>',
      tagline: '`code` <script>alert(1)</script>',
      description: '[click](https://example.com)\n\n<div>unsafe</div>',
      tech_stack: ['<b>Vue</b>'],
      category: { slug: 'hostile', name: '# Category' },
      tags: [{ slug: 'hostile', name: '[tag](javascript:alert(1))' }],
    } as unknown as Listing

    const output = renderListingMarkdown(hostile, 'launchlog.ai')

    expect(output).not.toMatch(/^# title|^- \[x\]\(/m)
    expect(output).not.toContain('<script>')
    expect(output).not.toContain('<img')
    expect(output).not.toContain('<div>')
    expect(output).not.toContain('[click](https://example.com)')
  })

  test('rejects an unsafe author-controlled website destination', () => {
    const unsafe = { ...listing, url: 'javascript:alert(1)' } as Listing

    expect(() => renderListingMarkdown(unsafe, 'launchlog.ai')).toThrow('Unsafe HTTPS URL')
  })
})
