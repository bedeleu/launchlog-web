import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./ListingGrid.vue', import.meta.url)), 'utf8')
const preview = readFileSync(fileURLToPath(new URL('../Intake/PlacementPreview.vue', import.meta.url)), 'utf8')

describe('private preview focus', () => {
  test('marks the buyer card with a hard catalog proof frame', () => {
    expect(source).toContain('focusSlug?: string')
    expect(source).toContain('ring-2 ring-release-paper ring-offset-2 ring-offset-release-rail')
    expect(source).toContain(':data-preview-focus=')
    expect(preview).toContain('focus-slug="preview-buyer"')
  })

  test('quiets illustrative neighbours without introducing glow effects', () => {
    expect(source).toContain('opacity-25 grayscale blur-[1.5px]')
    expect(source).not.toMatch(/shadow-|drop-shadow|gradient/)
  })
})
