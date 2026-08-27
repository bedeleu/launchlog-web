import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { buttonVariants } from '../app/components/ui/button'

describe('Release Catalog primitives', () => {
  it('authors interactive button states with the material palette', () => {
    const classes = buttonVariants({ variant: 'default', size: 'default' })

    expect(classes).toContain('bg-release-paper')
    expect(classes).toContain('focus-visible:ring-release-focus')
    expect(classes).toContain('active:')
    expect(classes).toContain('disabled:')
  })

  it('authors validation and focus states for inputs', () => {
    const input = readFileSync(new URL('../app/components/ui/input/Input.vue', import.meta.url), 'utf8')

    expect(input).toContain('bg-release-rail')
    expect(input).toContain('focus-visible:border-release-focus')
    expect(input).toContain('aria-invalid:border-release-destructive')
  })

  it('provides the five Release Catalog composition primitives', () => {
    for (const name of [
      'ReleaseShell.vue',
      'ReleaseCover.vue',
      'ReleaseEvidenceBand.vue',
      'ReleaseActionRail.vue',
      'ReleaseStateMarker.vue',
    ]) {
      expect(existsSync(new URL(`../app/components/Release/${name}`, import.meta.url))).toBe(true)
    }
  })
})
