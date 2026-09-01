import type { EditionDetail, EditionPage } from '#shared/types/editions'
import { escapeMarkdownText, renderSafeHttpsLink } from './markdown'

export function renderEditionArchiveMarkdown(page: EditionPage, site: string): string {
  const lines = [`# LaunchLog shipped — page ${page.meta.current_page}`, '']

  for (const edition of page.data) {
    lines.push(`## ${escapeMarkdownText(edition.slug)}`)
    if (edition.introduction) lines.push('', escapeMarkdownText(edition.introduction))
    lines.push(
      '',
      renderSafeHttpsLink('Read this edition', `${site}${edition.path}`, 'editorial'),
      '',
    )
  }

  return `${lines.join('\n').trim()}\n`
}

export function renderEditionDetailMarkdown(edition: EditionDetail, site: string): string {
  const lines = [
    `# LaunchLog shipped — ${escapeMarkdownText(edition.slug)}`,
    '',
    `Published: ${escapeMarkdownText(edition.published_at)}`,
    `Modified: ${escapeMarkdownText(edition.modified_at)}`,
  ]

  if (edition.introduction) lines.push('', escapeMarkdownText(edition.introduction))

  for (const item of edition.items) {
    lines.push('', `## ${escapeMarkdownText(`${item.position}. ${item.name}`)}`)
    lines.push(`Shipped: ${escapeMarkdownText(item.shipped_at)}`)

    if (item.carried_over) lines.push('Reported after cutoff')
    if (!item.current) {
      lines.push('No longer active')
      continue
    }

    if (item.tagline) lines.push(escapeMarkdownText(item.tagline))
    if (item.listing_path) {
      lines.push(
        renderSafeHttpsLink('LaunchLog listing', `${site}${item.listing_path}`, 'paid'),
      )
    }
    if (item.provenance_url) {
      lines.push(renderSafeHttpsLink('Release proof', item.provenance_url, 'editorial'))
    }
  }

  return `${lines.join('\n').trim()}\n`
}
