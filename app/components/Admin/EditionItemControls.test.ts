import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./EditionItemControls.vue', import.meta.url)), 'utf8')

describe('EditionItemControls', () => {
  test('sends published-only Show or Hide intent without local visibility state', () => {
    expect(source).toContain("emit('visibility', props.item.id, !props.item.visible)")
    expect(source).toContain("item.visible ? 'Hide' : 'Show'")
    expect(source).not.toContain('v-model')
  })

  test('disables every visibility control while pending but marks only its own request busy', () => {
    expect(source).toContain(':disabled="pending"')
    expect(source).toContain('visibilityPending: boolean')
    expect(source).toContain(':aria-busy="visibilityPending"')
    expect(source).toContain("visibilityPending ? 'Saving visibility…'")
  })

  test('gives Show or Hide an item-specific accessible name', () => {
    expect(source).toContain(':aria-label="`${item.visible ? \'Hide\' : \'Show\'} ${item.snapshot_name}`"')
  })

  test('uses Release Catalog materials without legacy visual treatments', () => {
    expect(source).toContain('border-release-seam')
    expect(source).toContain('bg-release-rail')
    expect(source).toContain('text-release-paper')
    expect(source).not.toMatch(/rounded-(?:lg|xl|2xl)/)
    expect(source).not.toMatch(/brand-/)
    expect(source).not.toMatch(/indigo|violet|purple/i)
    expect(source).not.toMatch(/gradient|backdrop-blur/i)
  })
})
