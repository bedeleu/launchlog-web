export type MarkdownRoute =
  | { kind: 'listing', slug: string }
  | { kind: 'edition_archive' }
  | { kind: 'edition_detail', slug: string }
  | { kind: 'category', slug: string }
  | { kind: 'launch_channels' }

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
const WEEK = '\\d{4}-w(?:0[1-9]|[1-4]\\d|5[0-3])'

export function resolveMarkdownRoute(pathname: string): MarkdownRoute | null {
  if (/^\/listing\/[^/]+\/(?:markdown|schema)\/?$/.test(pathname)) return null
  if (pathname === '/shipped' || pathname === '/shipped/') return { kind: 'edition_archive' }
  if (pathname === '/launch-channels' || pathname === '/launch-channels/') {
    return { kind: 'launch_channels' }
  }

  const listing = pathname.match(new RegExp(`^/listing/(${SLUG})/?$`))
  if (listing?.[1]) return { kind: 'listing', slug: listing[1] }

  const edition = pathname.match(new RegExp(`^/shipped/(${WEEK})/?$`))
  if (edition?.[1]) return { kind: 'edition_detail', slug: edition[1] }

  const category = pathname.match(new RegExp(`^/category/(${SLUG})/?$`))
  if (category?.[1]) return { kind: 'category', slug: category[1] }

  return null
}
