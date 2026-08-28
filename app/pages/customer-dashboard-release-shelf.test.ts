import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./dashboard.vue', import.meta.url)), 'utf8')
const proofArtifactSource = readFileSync(fileURLToPath(new URL('../components/Listing/ListingReceiptArtifact.vue', import.meta.url)), 'utf8')

describe('customer release shelf', () => {
  test('uses the established Release Catalog shell and proof ledger', () => {
    expect(source).toContain('<ReleaseShell')
    expect(source).toContain('<ListingReceiptArtifact')
    expect(source).toContain('receiptProofDestinations')
    expect(source).toContain('data-customer-release')
  })

  test('keeps account, status, edition, billing, editable copy, and proof in one release record', () => {
    expect(source).toContain('Account holder')
    expect(source).toContain('Publication state')
    expect(source).toContain('Catalog edition')
    expect(source).toContain('Billing record')
    expect(source).toContain('Public copy')
    expect(source).toContain('Published proof')
  })

  test('does not regress to the retired violet card language', () => {
    expect(source).not.toMatch(/indigo|violet|purple|bg-gradient|backdrop-blur/)
    expect(source).not.toContain('rounded-xl')
    expect(source).not.toContain('rounded-full')
  })

  test('keeps every proof address readable inside the narrow dashboard ledger', () => {
    expect(proofArtifactSource).not.toContain('sm:flex-row')
    expect(proofArtifactSource).not.toContain('sm:text-right')
    expect(proofArtifactSource).toContain('w-full max-w-full break-all')
  })

  test('keeps account and new-release actions above the shelf below desktop width', () => {
    expect(source).toContain('data-mobile-account-actions')
    expect(source).toContain('class="mb-6 border border-release-seam bg-release-rail p-4 xl:hidden"')
    expect(source.indexOf('data-mobile-account-actions')).toBeLessThan(source.indexOf('v-if="loading"'))
    expect(source).toContain('class="hidden xl:block"')
  })

  test('renders stable loading, empty, load-error, save-error, and billing-error states', () => {
    expect(source).toContain('Loading release shelf')
    expect(source).toContain('No releases recorded')
    expect(source).toContain('Release shelf unavailable')
    expect(source).toContain('Saving changes')
    expect(source).toContain('Billing could not be opened.')
  })
})
