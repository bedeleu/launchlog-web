import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

const requiredSource = (path: string): string => {
  const url = new URL(path, import.meta.url)
  return existsSync(url) ? readFileSync(url, 'utf8') : `__MISSING_RELEASE_SURFACE__:${path}`
}

describe('Release Catalog tokens', () => {
  const css = readFileSync(new URL('../app/assets/css/tailwind.css', import.meta.url), 'utf8')
  const transitionSurfaces = [
    '../app/components/Intake/PlacementPreview.vue',
    '../app/pages/login.vue',
    '../app/pages/preview/[token].vue',
    '../app/pages/admin/index.vue',
    '../app/pages/admin/listings/index.vue',
    '../app/pages/admin/outreach.vue',
    '../app/pages/shipped/index.vue',
    '../app/pages/shipped/[slug].vue',
    '../app/components/Edition/EditionItem.vue',
    '../app/components/Edition/EditionSummary.vue',
  ].map(requiredSource).join('\n')
  const neutralSurfaces = [
    '../app/components/AppBar.vue',
    '../app/components/Intake/PlacementPreview.vue',
    '../app/components/Intake/PlanSelector.vue',
    '../app/pages/about.vue',
    '../app/pages/api-docs.vue',
    '../app/pages/pricing.vue',
    '../app/pages/seo-guide.vue',
    '../app/pages/shipped/index.vue',
    '../app/pages/shipped/[slug].vue',
    '../app/components/Edition/EditionItem.vue',
    '../app/components/Edition/EditionSummary.vue',
  ].map(requiredSource).join('\n')

  it('requires every guarded Release Catalog surface to exist', () => {
    expect(`${transitionSurfaces}\n${neutralSurfaces}`).not.toContain('__MISSING_RELEASE_SURFACE__')
  })

  it('defines the approved material palette', () => {
    expect(css).toContain('--release-ink: #080907')
    expect(css).toContain('--release-paper: #e8e0cf')
    expect(css).toContain('--release-blaze: #ff4b1f')
    expect(css).toContain('--release-signal: #24c58b')
  })

  it('does not decorate Release Catalog rules with gradients or the retired AI palette', () => {
    const releaseRules = css
      .split('\n')
      .filter(line => line.includes('release-'))
      .join('\n')

    expect(releaseRules).not.toMatch(/linear-gradient|violet|purple|indigo|mauve/i)
  })

  it('removes the compatibility palette after the final runtime consumer migrates', () => {
    expect(css).not.toContain('--color-brand-')
    expect(css).not.toMatch(/--(?:color-)?(?:chart|sidebar)-/)
    expect(transitionSurfaces).not.toMatch(/brand-(?:bg|fg|accent|success|warning|muted|border)/)
  })

  it('keeps operational surfaces free of gradient and glow decoration', () => {
    expect(transitionSurfaces).not.toMatch(/bg-gradient|blur-3xl|backdrop-blur|shadow-2xl/)
  })

  it('reserves signal green for verified success rather than neutral navigation or decoration', () => {
    expect(neutralSurfaces).not.toContain('release-signal')
  })
})
