import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./DuplicateReleaseNotice.vue', import.meta.url)), 'utf8')

describe('DuplicateReleaseNotice', () => {
  test('is one terminal record with direct listing and ownership actions', () => {
    expect(source).toContain('data-duplicate-release-notice')
    expect(source).toContain('View listing')
    expect(source).toContain('Manage listing')
    expect(source).toContain('Request ownership')
    expect(source).toContain('No duplicate payment is needed')
    expect(source).not.toContain('linear-gradient')
    expect(source).not.toMatch(/brand-(?:bg|fg|accent|success|warning|muted|border)/)
  })
})
