import { describe, expect, test } from 'bun:test'
import type { EditionDetail } from '#shared/types/editions'
import { buildEditionSchema } from './edition-schema'
import { serializeJsonLd } from './json-ld'

const edition = {
  slug: '2026-w35',
  week_starts_at: '2026-08-24',
  week_ends_at: '2026-08-30',
  introduction: 'A truthful frozen week.',
  published_at: '2026-08-31T00:00:00+00:00',
  modified_at: '2026-08-31T00:05:00+00:00',
  path: '/shipped/2026-w35',
  items: [
    {
      kind: 'new_listing',
      position: 1,
      shipped_at: '2026-08-27',
      source_week_starts_at: null,
      carried_over: false,
      name: 'Current launch',
      tagline: 'Still live.',
      tier_label: 'Featured',
      image_url: null,
      current: true,
      listing_path: '/listing/current-launch',
      provenance_url: 'https://proof.example/current-launch',
      include_in_item_list: true,
    },
    {
      kind: 'new_listing',
      position: 2,
      shipped_at: '2026-08-28',
      source_week_starts_at: null,
      carried_over: false,
      name: 'Frozen withdrawn launch',
      tagline: 'Historical copy stays visible.',
      tier_label: 'Standard',
      image_url: null,
      current: false,
      listing_path: null,
      provenance_url: null,
      include_in_item_list: false,
    },
    {
      kind: 'new_listing',
      position: 3,
      shipped_at: '2026-08-30',
      source_week_starts_at: '2026-08-17',
      carried_over: true,
      name: 'Carried launch',
      tagline: null,
      tier_label: 'Standard',
      image_url: null,
      current: true,
      listing_path: '/listing/carried-launch',
      provenance_url: null,
      include_in_item_list: true,
    },
  ],
} satisfies EditionDetail

describe('weekly edition JSON-LD', () => {
  test('builds the canonical CollectionPage, ItemList and BreadcrumbList graph', () => {
    const schema = buildEditionSchema(edition, 'https://launchlog.ai/')
    const graph = schema['@graph'] as Array<Record<string, unknown>>
    const page = graph.find(node => node['@type'] === 'CollectionPage')
    const list = graph.find(node => node['@type'] === 'ItemList')
    const breadcrumbs = graph.find(node => node['@type'] === 'BreadcrumbList')

    expect(schema['@context']).toBe('https://schema.org')
    expect(graph.map(node => node['@type'])).toEqual([
      'CollectionPage',
      'ItemList',
      'BreadcrumbList',
    ])
    expect(page).toMatchObject({
      '@id': 'https://launchlog.ai/shipped/2026-w35#page',
      'url': 'https://launchlog.ai/shipped/2026-w35',
      'datePublished': edition.published_at,
      'dateModified': edition.modified_at,
      'mainEntity': { '@id': 'https://launchlog.ai/shipped/2026-w35#items' },
    })
    expect(breadcrumbs).toMatchObject({
      '@id': 'https://launchlog.ai/shipped/2026-w35#breadcrumbs',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://launchlog.ai' },
        { '@type': 'ListItem', position: 2, name: 'Shipped', item: 'https://launchlog.ai/shipped' },
        {
          '@type': 'ListItem',
          position: 3,
          name: '2026-w35',
          item: 'https://launchlog.ai/shipped/2026-w35',
        },
      ],
    })
    expect(list).toBeDefined()
  })

  test('excludes withdrawn snapshots from ItemList without rewriting live positions', () => {
    const graph = buildEditionSchema(edition, 'https://launchlog.ai')['@graph'] as Array<Record<string, unknown>>
    const list = graph.find(node => node['@type'] === 'ItemList') as Record<string, unknown>

    expect(list.numberOfItems).toBe(2)
    expect(list.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Current launch',
        url: 'https://launchlog.ai/listing/current-launch',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Carried launch',
        url: 'https://launchlog.ai/listing/carried-launch',
      },
    ])
    expect(JSON.stringify(list)).not.toContain('Frozen withdrawn launch')
  })

  test('keeps hostile editorial text as data and relies on safe script serialization', () => {
    const hostile = '</script><script>globalThis.__edition_xss=1</script><'
    const hostileEdition: EditionDetail = {
      ...edition,
      introduction: hostile,
      items: [{ ...edition.items[0], name: hostile, tagline: hostile }],
    }
    const schema = buildEditionSchema(hostileEdition, 'https://launchlog.ai')
    const graph = schema['@graph'] as Array<Record<string, unknown>>
    const page = graph.find(node => node['@type'] === 'CollectionPage')
    const list = graph.find(node => node['@type'] === 'ItemList')

    expect(page?.description).toBe(hostile)
    expect(JSON.stringify(list)).toContain(hostile)

    const serialized = serializeJsonLd(schema)
    expect(serialized).not.toContain('<')
    expect(serialized).not.toContain('</script>')
    expect(JSON.parse(serialized)).toEqual(schema)
  })
})
