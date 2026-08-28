import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./ReleaseShell.vue', import.meta.url)), 'utf8')

describe('ReleaseShell rail geometry', () => {
  test('supports a wider desktop rail without changing the default shell', () => {
    expect(source).toContain('wideRail')
    expect(source).toContain("xl:grid-cols-[minmax(0,3fr)_minmax(26rem,2fr)]")
    expect(source).toContain("lg:grid-cols-[minmax(0,1fr)_20rem]")
  })
})
