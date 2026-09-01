import { describe, expect, test } from 'bun:test'
import type { EditionDetail, EditionPage } from '#shared/types/editions'

type EditionRenderers = {
  renderEditionArchiveMarkdown: (page: EditionPage, site: string) => string
  renderEditionDetailMarkdown: (edition: EditionDetail, site: string) => string
}

async function loadRenderers(): Promise<EditionRenderers> {
  const modulePath = './edition-markdown'
  const module = await import(modulePath) as Partial<EditionRenderers>
  if (typeof module.renderEditionArchiveMarkdown !== 'function'
    || typeof module.renderEditionDetailMarkdown !== 'function') {
    throw new Error('Edition Markdown renderers are not implemented')
  }
  return module as EditionRenderers
}

const archive: EditionPage = {
  data: [
    {
      slug: '2026-w35',
      week_starts_at: '2026-08-24',
      week_ends_at: '2026-08-30',
      introduction: '# Current </script>',
      published_at: '2026-08-31T00:00:00Z',
      modified_at: '2026-08-31T00:05:00Z',
      item_count: 2,
      path: '/shipped/2026-w35',
    },
    {
      slug: '2026-w34',
      week_starts_at: '2026-08-17',
      week_ends_at: '2026-08-23',
      introduction: null,
      published_at: '2026-08-24T00:00:00Z',
      modified_at: '2026-08-24T00:05:00Z',
      item_count: 1,
      path: '/shipped/2026-w34',
    },
  ],
  meta: { current_page: 1, last_page: 1, per_page: 24, total: 2 },
}

const detail: EditionDetail = {
  ...archive.data[0]!,
  items: [
    {
      kind: 'new_listing',
      position: 1,
      shipped_at: '2026-08-27',
      source_week_starts_at: null,
      carried_over: false,
      name: 'Current [tool]',
      tagline: 'Ships # safely </script>',
      tier_label: 'Standard',
      image_url: null,
      current: true,
      listing_path: '/listing/current-tool',
      provenance_url: 'https://example.test/proof',
      include_in_item_list: true,
    },
    {
      kind: 'new_listing',
      position: 2,
      shipped_at: '2026-08-20',
      source_week_starts_at: '2026-08-17',
      carried_over: true,
      name: 'Carried tool',
      tagline: null,
      tier_label: 'Featured',
      image_url: null,
      current: true,
      listing_path: '/listing/carried-tool',
      provenance_url: null,
      include_in_item_list: true,
    },
    {
      kind: 'new_listing',
      position: 3,
      shipped_at: '2026-08-19',
      source_week_starts_at: null,
      carried_over: false,
      name: 'Withdrawn </script>',
      tagline: 'Frozen copy',
      tier_label: 'Standard',
      image_url: null,
      current: false,
      listing_path: null,
      provenance_url: null,
      include_in_item_list: false,
    },
  ],
}

describe('edition Markdown', () => {
  test('renders the exact archive page with escaped editorial links in source order', async () => {
    const { renderEditionArchiveMarkdown } = await loadRenderers()
    const markdown = renderEditionArchiveMarkdown(archive, 'https://launchlog.ai')

    expect(markdown).toStartWith('# LaunchLog shipped — page 1\n')
    expect(markdown).toContain('\\# Current &lt;/script&gt;')
    expect(markdown).toContain(
      '<a href="https://launchlog.ai/shipped/2026-w35" rel="noopener">Read this edition</a>',
    )
    expect(markdown).toContain(
      '<a href="https://launchlog.ai/shipped/2026-w34" rel="noopener">Read this edition</a>',
    )
    expect(markdown.indexOf('2026-w35')).toBeLessThan(markdown.indexOf('2026-w34'))
  })

  test('preserves item order, carry state and safe paid/editorial link relations', async () => {
    const { renderEditionDetailMarkdown } = await loadRenderers()
    const markdown = renderEditionDetailMarkdown(detail, 'https://launchlog.ai')

    expect(markdown).toContain(String.raw`Published: 2026\-08\-31T00:00:00Z`)
    expect(markdown).toContain(String.raw`Modified: 2026\-08\-31T00:05:00Z`)
    expect(markdown).toContain('\\# Current &lt;/script&gt;')
    expect(markdown).toContain('## 1\\. Current \\[tool\\]')
    expect(markdown).toContain('Ships \\# safely &lt;/script&gt;')
    expect(markdown).toContain('## 2\\. Carried tool')
    expect(markdown).toContain('Reported after cutoff')
    expect(markdown).toContain('## 3\\. Withdrawn &lt;/script&gt;')
    expect(markdown).toContain('No longer active')
    expect(markdown).toContain(
      '<a href="https://launchlog.ai/listing/current-tool" rel="noopener sponsored">LaunchLog listing</a>',
    )
    expect(markdown).toContain(
      '<a href="https://example.test/proof" rel="noopener">Release proof</a>',
    )
    expect(markdown.indexOf('## 1')).toBeLessThan(markdown.indexOf('## 2'))
    expect(markdown.indexOf('## 2')).toBeLessThan(markdown.indexOf('## 3'))

    const withdrawn = markdown.slice(markdown.indexOf('## 3'))
    expect(withdrawn).not.toContain('<a ')
    expect(withdrawn).not.toMatch(/https?:\/\//)
    expect(markdown).not.toContain('</script>')
  })
})
