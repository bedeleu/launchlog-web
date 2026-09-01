import { expect, test } from 'bun:test'
import { NEWSLETTER_SOURCES } from './newsletter-sources'

test('pins the only newsletter capture surfaces', () => {
  expect(NEWSLETTER_SOURCES).toEqual([
    'homepage',
    'shipped_archive',
    'shipped_edition',
  ])
})
