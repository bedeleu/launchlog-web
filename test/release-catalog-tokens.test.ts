import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('Release Catalog tokens', () => {
  const css = readFileSync(new URL('../app/assets/css/tailwind.css', import.meta.url), 'utf8')

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
})
