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

  test('disables the visibility control while its request is pending', () => {
    expect(source).toContain(':disabled="pending"')
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
