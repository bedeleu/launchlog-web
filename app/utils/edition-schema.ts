import type { EditionDetail } from '#shared/types/editions'

export function buildEditionSchema(edition: EditionDetail, site: string) {
  const base = site.replace(/\/+$/, '')
  const canonical = `${base}${edition.path}`
  const current = edition.items.filter(
    item => item.current && item.include_in_item_list && item.listing_path !== null,
  )

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#page`,
        url: canonical,
        name: `LaunchLog shipped — ${edition.slug}`,
        description: edition.introduction ?? `Products shipped during ${edition.slug}.`,
        datePublished: edition.published_at,
        dateModified: edition.modified_at,
        mainEntity: { '@id': `${canonical}#items` },
      },
      {
        '@type': 'ItemList',
        '@id': `${canonical}#items`,
        numberOfItems: current.length,
        itemListElement: current.map(item => ({
          '@type': 'ListItem',
          position: item.position,
          name: item.name,
          url: `${base}${item.listing_path}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumbs`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base },
          { '@type': 'ListItem', position: 2, name: 'Shipped', item: `${base}/shipped` },
          { '@type': 'ListItem', position: 3, name: edition.slug, item: canonical },
        ],
      },
    ],
  }
}
