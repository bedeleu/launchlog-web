import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

test('renders applied logo and social links on the public listing', () => {
  const source = readFileSync(fileURLToPath(new URL('./listing/[slug].vue', import.meta.url)), 'utf8')

  expect(source).toContain('listing.logo_url')
  expect(source).toContain('listing.social_links')
  expect(source).toContain('aria-label="Social profiles"')
})
