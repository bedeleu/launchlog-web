import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./EditionEditor.vue', import.meta.url)), 'utf8')

const requiredButton = (ariaBinding: string): string => {
  const button = (source.match(/<button\b[\s\S]*?<\/button>/g) ?? [])
    .find(candidate => candidate.includes(ariaBinding))
  if (!button) throw new Error(`Missing editor control: ${ariaBinding}`)
  return button
}

const expectReleaseCatalogMaterials = () => {
  expect(source).toContain('border-release-seam')
  expect(source).toContain('bg-release-rail')
  expect(source).toContain('text-release-paper')
  expect(source).toContain('text-release-paper-muted')
  expect(source).not.toMatch(/rounded-(?:lg|xl|2xl)/)
  expect(source).not.toMatch(/brand-/)
  expect(source).not.toMatch(/indigo|violet|purple/i)
  expect(source).not.toMatch(/gradient|backdrop-blur/i)
}

describe('EditionEditor', () => {
  test('draft controls expose connected keyboard reordering with disabled boundaries and live feedback', () => {
    const moveUp = requiredButton(':aria-label="`Move up ${item.snapshot_name}`"')
    expect(moveUp).toContain('@click="move(index, -1)"')
    expect(moveUp).toContain(':disabled="pending || index === 0"')

    const moveDown = requiredButton(':aria-label="`Move down ${item.snapshot_name}`"')
    expect(moveDown).toContain('@click="move(index, 1)"')
    expect(moveDown).toContain(':disabled="pending || index === draftItems.length - 1"')

    expect(source).toContain('aria-live="polite"')
  })

  test('requires an explicit publication confirmation and excludes moderation expansion', () => {
    expect(source).toContain('Publish edition')
    expect(source).toContain('Confirm publication')
    expect(source).not.toMatch(/reason|history|schedule|newsletter|social/i)
  })

  test('uses the current Release Catalog materials without legacy visual treatments', () => {
    expectReleaseCatalogMaterials()
  })
})
