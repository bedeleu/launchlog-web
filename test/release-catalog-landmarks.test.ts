import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const defaultLayoutPages = [
  '../app/pages/pricing.vue',
  '../app/pages/submit.vue',
  '../app/pages/login.vue',
  '../app/pages/dashboard.vue',
  '../app/pages/preview/[token].vue',
  '../app/pages/checkout/success.vue',
  '../app/pages/admin/index.vue',
  '../app/pages/admin/outreach.vue',
  '../app/pages/admin/listings/new.vue',
  '../app/pages/admin/listings/[id].vue',
]

describe('Release Catalog landmarks', () => {
  it('lets the default layout own the single main landmark', () => {
    for (const path of defaultLayoutPages) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8')
      expect(source).not.toMatch(/<main(?:\s|>)/)
    }
  })
})
