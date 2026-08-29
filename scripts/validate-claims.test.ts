import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanClaimContent, validatePublicClaims } from './validate-claims'

let fixtureRoot: string | undefined

afterEach(() => {
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true })
  fixtureRoot = undefined
})

describe('public claim gate', () => {
  test('blocks retired commercial and unsupported citation claims', () => {
    const source = [
      "const plan = 'LaunchLog Premium — $59.99'",
      "const copy = 'Engineered to be cited by answer engines'",
      "const lifecycle = 'From submitted product to indexed launch profile.'",
      "const duration = 'A permanent product page.'",
    ].join('\n')

    expect(scanClaimContent(source, 'example.ts')).toEqual([
      expect.objectContaining({ line: 1, message: 'Premium was retired by D-065' }),
      expect.objectContaining({ line: 1, message: 'Retired Premium price' }),
      expect.objectContaining({ line: 2, message: 'Unsupported citation promise' }),
      expect.objectContaining({ line: 3, message: 'Indexing cannot be guaranteed' }),
      expect.objectContaining({ line: 4, message: 'Listings remain live only while the subscription is active' }),
    ])
  })

  test('allows factual machine-readable discovery language', () => {
    const source = "const copy = 'Visible product facts with structured data and markdown output.'"

    expect(scanClaimContent(source, 'example.ts')).toEqual([])
  })

  test('blocks customer-facing Basic naming but keeps the internal basic enum', () => {
    expect(scanClaimContent("const copy = 'Choose the basic plan'", 'app/pages/pricing.vue'))
      .toEqual([expect.objectContaining({ message: 'Standard is the customer-facing plan name' })])
    expect(scanClaimContent("const enumDocs = 'basic or featured'; const tier = 'basic'", 'app/pages/api-docs.vue'))
      .toEqual([])
  })

  test('scans PRODUCT.md as public product truth', () => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'launchlog-claims-'))
    for (const directory of [
      'app/pages', 'app/components', 'app/composables', 'server/routes', 'shared/constants',
    ]) mkdirSync(join(fixtureRoot, directory), { recursive: true })
    writeFileSync(join(fixtureRoot, 'nuxt.config.ts'), '')
    writeFileSync(join(fixtureRoot, 'app/app.vue'), '')
    writeFileSync(join(fixtureRoot, 'PRODUCT.md'), '# Product\nChoose the Basic listing.\n')

    expect(validatePublicClaims(fixtureRoot)).toEqual([
      expect.objectContaining({ file: 'PRODUCT.md', line: 2, message: 'Standard is the customer-facing plan name' }),
    ])
  })
})
