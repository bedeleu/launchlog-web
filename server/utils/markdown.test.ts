import { describe, expect, test } from 'bun:test'
import { acceptsExplicitMarkdown, escapeMarkdownText, renderSafeHttpsLink } from './markdown'

describe('safe discovery Markdown', () => {
  test('neutralizes author syntax, HTML and controls', () => {
    const value = '# title\n- [x](javascript:alert(1)) <img src=x> `code`\u0000'
    const rendered = escapeMarkdownText(value)

    expect(rendered).not.toContain('\u0000')
    expect(rendered).not.toContain('<img')
    expect(rendered).not.toContain('[x](')
    expect(rendered).not.toMatch(/^#|^- /m)
    expect(rendered).toContain('&lt;img src=x&gt;')
  })

  test('neutralizes Setext heading syntax', () => {
    const rendered = escapeMarkdownText('author title\n===')

    expect(rendered).toBe('author title\n\\=\\=\\=')
    expect(rendered).not.toMatch(/^=+$/m)
  })

  test('renders a paid HTTPS anchor with the exact relation', () => {
    expect(renderSafeHttpsLink('Website', 'https://example.com/a?x=1&y=2', 'paid')).toBe(
      '<a href="https://example.com/a?x=1&amp;y=2" rel="noopener sponsored">Website</a>',
    )
  })

  test('renders editorial provenance without sponsored', () => {
    expect(renderSafeHttpsLink('Release proof', 'https://example.com/release', 'editorial')).toBe(
      '<a href="https://example.com/release" rel="noopener">Release proof</a>',
    )
  })

  test.each([
    'http://example.com',
    'javascript:alert(1)',
    'https://user:pass@example.com',
    'https://example.com/a b',
    'https://example.com/<unsafe>',
    'https://example.com/" onclick="alert(1)',
  ])('rejects an unsafe destination: %s', (url) => {
    expect(() => renderSafeHttpsLink('Unsafe', url, 'paid')).toThrow('Unsafe HTTPS URL')
  })

  test.each([
    ['Text/Markdown', true],
    ['text/markdown; q=0.25', true],
    ['text/html, TEXT/MARKDOWN; charset=utf-8; Q=1', true],
    ['text/markdown; q=0', false],
    ['text/markdown; note="a,b"; q=0', false],
    ['text/markdown; q=invalid', false],
    ['text/markdown; q=1.1', false],
    ['text/*', false],
    ['*/*', false],
    ['application/json', false],
  ] as const)('recognizes only a positive explicit Markdown media range: %s', (accept, expected) => {
    expect(acceptsExplicitMarkdown(accept)).toBe(expected)
  })
})
