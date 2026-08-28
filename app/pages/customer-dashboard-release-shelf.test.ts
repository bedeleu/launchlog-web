import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./dashboard.vue', import.meta.url)), 'utf8')

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

  test('renders stable loading, empty, load-error, save-error, and billing-error states', () => {
    expect(source).toContain('Loading release shelf')
    expect(source).toContain('No releases recorded')
    expect(source).toContain('Release shelf unavailable')
    expect(source).toContain('Saving changes')
    expect(source).toContain('Billing could not be opened.')
  })
})
