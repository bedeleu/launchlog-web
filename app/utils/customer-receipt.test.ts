import { expect, test } from 'bun:test'
import * as customerReceipt from './customer-receipt'

const { receiptRows, receiptUnavailableLabel } = customerReceipt

test('links every published fact to the artifact it names', () => {
  expect(receiptRows).toEqual([
    { key: 'published', label: 'Public listing', linkKey: 'public_url', action: 'View page' },
    { key: 'schema', label: 'Structured data', linkKey: 'schema_url', action: 'Inspect JSON-LD' },
    { key: 'markdown', label: 'Markdown response', linkKey: 'markdown_url', action: 'View Markdown' },
    { key: 'llms', label: 'AI discovery feed', linkKey: 'llms_url', action: 'Open feed' },
  ])
})

test('keeps proof links valid while the API and Web deploy independently', () => {
  const receiptArtifactUrl = (customerReceipt as unknown as {
    receiptArtifactUrl: (receipt: Record<string, string>, row: typeof receiptRows[number]) => string
  }).receiptArtifactUrl
  const legacyReceipt = {
    public_url: 'https://launchlog.ai/listing/acme',
    markdown_url: 'https://launchlog.ai/listing/acme',
    sitemap_url: 'https://launchlog.ai/sitemap.xml',
    llms_url: 'https://launchlog.ai/llms-full.txt',
  }

  expect(receiptArtifactUrl).toBeFunction()
  expect(receiptArtifactUrl(legacyReceipt, receiptRows[1]!)).toBe('https://launchlog.ai/listing/acme/schema')
  expect(receiptArtifactUrl(legacyReceipt, receiptRows[2]!)).toBe('https://launchlog.ai/listing/acme/markdown')
})

test('uses pending only while a listing can still become public', () => {
  expect(receiptUnavailableLabel('draft')).toBe('Pending')
  expect(receiptUnavailableLabel('pending_review')).toBe('Pending')
  expect(receiptUnavailableLabel('archived')).toBe('Not published')
  expect(receiptUnavailableLabel('rejected')).toBe('Not published')
  expect(receiptUnavailableLabel('spam')).toBe('Not published')
  expect(receiptUnavailableLabel('published')).toBe('Unavailable')
})
