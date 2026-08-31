import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./ReleaseShell.vue', import.meta.url)), 'utf8')

describe('ReleaseShell rail geometry', () => {
  test('gives the wide rail a compact lg split before expanding it at xl', () => {
    const wideRailBranch = source.match(/wideRail\s*\?\s*'([^']+)'/)?.[1] ?? ''

    expect(source).toContain('wideRail')
    expect(wideRailBranch).toContain('lg:grid-cols-[minmax(0,1fr)_20rem]')
    expect(wideRailBranch).toContain('xl:grid-cols-[minmax(0,3fr)_minmax(26rem,2fr)]')
    expect(wideRailBranch.indexOf('lg:grid-cols')).toBeLessThan(wideRailBranch.indexOf('xl:grid-cols'))
  })
})
