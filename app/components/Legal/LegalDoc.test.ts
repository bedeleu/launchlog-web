import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./LegalDoc.vue', import.meta.url)), 'utf8')

describe('legal document localization shell', () => {
  test('localizes navigation and contact copy and exposes an alternate-language route', () => {
    expect(source).toContain("locale?: 'en' | 'ro'")
    expect(source).toContain('Pe această pagină')
    expect(source).toContain('Întrebări despre această politică?')
    expect(source).toContain('alternatePath')
    expect(source).toContain('alternateLabel')
  })
})
