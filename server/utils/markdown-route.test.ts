import { describe, expect, test } from 'bun:test'

type MarkdownRoute = Record<string, string>
interface MarkdownRouteModule {
  resolveMarkdownRoute(pathname: string): MarkdownRoute | null
}

const { resolveMarkdownRoute } = await import('./' + 'markdown-route') as MarkdownRouteModule

describe('Markdown route resolution', () => {
  test.each([
    ['/listing/tool', { kind: 'listing', slug: 'tool' }],
    ['/shipped', { kind: 'edition_archive' }],
    ['/shipped/2026-w35', { kind: 'edition_detail', slug: '2026-w35' }],
    ['/category/developer-tools', { kind: 'category', slug: 'developer-tools' }],
    ['/launch-channels', { kind: 'launch_channels' }],
  ] as const)('maps %s', (pathname, expected) => {
    expect(resolveMarkdownRoute(pathname)).toEqual(expected)
  })

  test.each([
    '/listing/tool/markdown',
    '/listing/tool/schema',
    '/listing/',
    '/shipped/invalid',
    '/admin',
  ])('does not capture reserved or invalid path %s', (pathname) => {
    expect(resolveMarkdownRoute(pathname)).toBeNull()
  })
})
