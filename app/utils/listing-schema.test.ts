import { describe, expect, test } from 'bun:test'
import type { Listing } from '../composables/useListings'
import { buildListingSchema } from './listing-schema'

const listing: Listing = {
  slug: 'acme',
  name: 'Acme',
  tagline: 'Ship faster',
  description: 'A concise product description.',
  link_text: null,
  url: 'https://acme.test',
  screenshot_url: 'https://cdn.launchlog.ai/acme.png',
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

describe('buildListingSchema', () => {
  test('builds the supported canonical graph from listing facts', () => {
    const schema = buildListingSchema(listing, 'https://launchlog.ai')
    const graph = schema['@graph'] as Array<Record<string, unknown>>
    const product = graph.find(node => node['@type'] === 'SoftwareApplication')
    const breadcrumb = graph.find(node => node['@type'] === 'BreadcrumbList')

    expect(schema['@context']).toBe('https://schema.org')
    expect(graph).toHaveLength(4)
    expect(product).toEqual({
      '@type': 'SoftwareApplication',
      '@id': 'https://launchlog.ai/listing/acme#product',
      'name': 'Acme',
      'url': 'https://acme.test',
      'applicationCategory': 'Developer Tools',
      'description': 'A concise product description.',
      'isPartOf': { '@id': 'https://launchlog.ai/#website' },
      'image': 'https://cdn.launchlog.ai/acme.png',
      'featureList': ['Nuxt'],
      'offers': {
        '@type': 'Offer',
        'price': 0,
        'priceCurrency': 'USD',
        'url': 'https://acme.test',
      },
    })
    expect(JSON.stringify(breadcrumb)).toContain('https://launchlog.ai/listing/acme')
  })

  test('does not invent unsupported discovery or commercial claims', () => {
    const serialized = JSON.stringify(buildListingSchema(listing, 'https://launchlog.ai'))

    expect(serialized).not.toContain('aggregateRating')
    expect(serialized).not.toContain('review')
    expect(serialized).not.toContain('availability')
    expect(serialized).not.toContain('customer')
    expect(serialized).not.toContain('citation')
    expect(serialized).not.toContain('ranking')
  })

  test('omits absent optional facts from a sparse listing', () => {
    const sparse = {
      ...listing,
      slug: 'sparse',
      tagline: null,
      description: null,
      screenshot_url: null,
      category: null,
      tech_stack: [],
      pricing: undefined,
    } as unknown as Listing

    const schema = buildListingSchema(sparse, 'https://launchlog.ai/')
    const graph = schema['@graph'] as Array<Record<string, unknown>>
    const product = graph.find(node => node['@type'] === 'SoftwareApplication')

    expect(product).toEqual({
      '@type': 'SoftwareApplication',
      '@id': 'https://launchlog.ai/listing/sparse#product',
      'name': 'Acme',
      'url': 'https://acme.test',
      'applicationCategory': 'WebApplication',
      'isPartOf': { '@id': 'https://launchlog.ai/#website' },
    })
    expect(JSON.stringify(schema)).not.toContain('undefined')
    expect(JSON.stringify(schema)).not.toContain('null')
  })

  test('uses the available high pricing bound when low is null', () => {
    const schema = buildListingSchema({
      ...listing,
      pricing: { low: null, high: 99, currency: 'USD' },
    }, 'https://launchlog.ai')
    const graph = schema['@graph'] as Array<Record<string, unknown>>
    const product = graph.find(node => node['@type'] === 'SoftwareApplication')

    expect(product?.offers).toEqual({
      '@type': 'Offer',
      'price': 99,
      'priceCurrency': 'USD',
      'url': 'https://acme.test',
    })
  })

  test('omits Offer when neither pricing bound is available', () => {
    const schema = buildListingSchema({
      ...listing,
      pricing: { low: null, high: null, currency: 'USD' },
    }, 'https://launchlog.ai')
    const graph = schema['@graph'] as Array<Record<string, unknown>>
    const product = graph.find(node => node['@type'] === 'SoftwareApplication')

    expect(product).not.toHaveProperty('offers')
  })

  test('keeps hostile text as data in the graph', () => {
    const payload = '</script><script>globalThis.__launchlog_xss=1</script><'
    const schema = buildListingSchema({
      ...listing,
      name: payload,
      tagline: payload,
      description: payload,
    }, 'https://launchlog.ai')
    const graph = schema['@graph'] as Array<Record<string, unknown>>
    const product = graph.find(node => node['@type'] === 'SoftwareApplication')
    const breadcrumb = graph.find(node => node['@type'] === 'BreadcrumbList')

    expect(product?.name).toBe(payload)
    expect(product?.description).toBe(payload)
    expect(JSON.stringify(breadcrumb)).toContain(payload)
  })
})
