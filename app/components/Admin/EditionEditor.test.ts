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

  test('keeps independent dirty draft domains so one accepted save cannot erase the other', () => {
    expect(source).toContain('const serverIntroduction')
    expect(source).toContain('const serverItems')
    expect(source).toContain('const introductionDirty')
    expect(source).toContain('const itemsDirty')
    expect(source).toContain('const canPublish')
    expect(source).toContain('!introductionDirty.value && !itemsDirty.value')
    expect(source).not.toContain('watch(() => props.edition, hydrate')
  })

  test('labels individual actions and restores focus after add, remove, cancel, and publication', () => {
    expect(source).toContain(':aria-label="`Remove ${item.snapshot_name}`"')
    expect(source).toContain(':aria-label="`Add ${candidate.name}`"')
    expect(source).toContain('focusAddedItem(candidate.listing_id)')
    expect(source).toContain("focusControl(removed.listing_id, 'add')")
    expect(source).toContain("focusControl('publication', 'publish')")
    expect(source).toContain("focusControl('publication', 'summary')")
    expect(source).toContain('<label for="edition-introduction"')
    expect(source).toContain('aria-invalid')
    expect(source).toContain('aria-describedby')
  })

  test('focuses an enabled row control after add and has an adjacent fallback after remove', () => {
    expect(source).toContain("registerControl(item.listing_id, 'remove', element)")
    expect(source).toContain("focusControl(listingId, 'remove')")
    expect(source).toContain("focusControl(removed.listing_id, 'add')")
    expect(source).toContain('focusAdjacentRowControl(index)')
    expect(source).toContain("registerControl('items', 'save', element)")
    expect(source).toContain("focusControl('items', 'save')")
  })

  test('synchronizes server sibling baselines without overwriting a dirty sibling draft', () => {
    expect(source).toContain('const sources = new Map((edition.candidates ?? [])')
    expect(source).toContain("source: sources.get(item.listing_id) ?? 'unknown'")
    expect(source).toContain('const siblingItemsDirty = itemsDirty.value')
    expect(source).toContain('serverItems.value = toDraftItems(updated)')
    expect(source).toContain('if (!siblingItemsDirty) draftItems.value = toDraftItems(updated)')
    expect(source).toContain('const siblingIntroductionDirty = introductionDirty.value')
    expect(source).toContain('serverIntroduction.value = updated.introduction')
    expect(source).toContain("if (!siblingIntroductionDirty) introduction.value = updated.introduction ?? ''")
  })

  test('keeps validation and busy feedback scoped to the field and operation that need it', () => {
    expect(source).toContain('const introductionError')
    expect(source).not.toContain(':aria-invalid="!!error"')
    expect(source).toContain('dateErrorId(item)')
    expect(source).toContain('urlErrorId(item)')
    expect(source).toContain('dateValidationError(item)')
    expect(source).toContain('urlValidationError(item)')
    expect(source).toContain("pendingAction.value = 'intro'")
    expect(source).toContain("pendingAction.value = 'items'")
    expect(source).toContain("pendingAction.value = 'publish'")
    expect(source).toContain("pendingAction.value = 'visibility'")
    expect(source).toContain(':aria-busy="pendingAction === \'intro\'"')
    expect(source).toContain(':disabled="pending || !introductionDirty"')
    expect(source).toContain(':disabled="pending || !itemsDirty"')
    expect(source).toContain('Save both draft changes before publishing.')
    expect(source).toContain("pendingAction === 'visibility' && pendingItemId === item.id")
  })

  test('clears publication confirmation on introduction edits so publication always needs a fresh confirm', () => {
    expect(source).toContain('@input="introductionError = null; clearPublicationConfirmation()"')
  })

  test('normalizes the submitted evidence URL and rejects backend-forbidden raw values', () => {
    expect(source).toContain('function normalizedProvenanceUrl')
    expect(source).toContain('function hasForbiddenUrlCharacter')
    expect(source).toContain('.trim()')
    expect(source).toContain('rawUrl.length > 2048')
    expect(source).toContain('codePoint <= 0x1f')
    expect(source).toContain('codePoint === 0x7f')
    expect(source).toContain('`"\'<>`.includes(character)')
    expect(source).toContain('provenance_url: normalizedProvenanceUrl(item) || null')
  })

  test('uses the current Release Catalog materials without legacy visual treatments', () => {
    expectReleaseCatalogMaterials()
  })
})
