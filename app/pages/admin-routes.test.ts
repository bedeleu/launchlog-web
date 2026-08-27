import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pagesDirectory = fileURLToPath(new URL('.', import.meta.url))

describe('admin page routing', () => {
  test('keeps the admin dashboard as the nested index route', () => {
    expect(existsSync(`${pagesDirectory}/admin/index.vue`)).toBe(true)
    expect(existsSync(`${pagesDirectory}/admin.vue`)).toBe(false)
  })

  test('contains no outreach page after the obsolete generator reset', () => {
    expect(existsSync(`${pagesDirectory}/admin-outreach.vue`)).toBe(false)
    expect(existsSync(`${pagesDirectory}/admin/outreach.vue`)).toBe(false)
  })
})
