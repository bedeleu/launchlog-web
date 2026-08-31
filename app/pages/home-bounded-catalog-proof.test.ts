import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./index.vue', import.meta.url)), 'utf8')

describe('Home bounded catalog proof', () => {
  test('keeps the latest screenshot complete without letterboxing it inside a forced desktop height', () => {
    const releaseCoverTag = source.match(/<ReleaseCover[\s\S]*?>/)?.[0] ?? ''

    expect(releaseCoverTag).not.toContain('media-class=')
    expect(releaseCoverTag).not.toContain('h-[clamp(')
    expect(releaseCoverTag).toContain('image-class=')
    expect(releaseCoverTag).toContain('object-contain')
    expect(releaseCoverTag).toContain('object-top')
  })

  test('uses one compact caption register instead of a second evidence band', () => {
    const caption = source.match(/<template #caption>([\s\S]*?)<\/template>/)?.[1] ?? ''

    expect(caption).toContain('Latest release')
    expect(caption).toContain('heroHost')
    expect(caption).toContain('Published record')
    expect(caption).toContain('line-clamp-2')
    expect(caption).not.toContain('sm:line-clamp-1')
    expect(source).not.toContain('<ReleaseEvidenceBand')
  })
})
