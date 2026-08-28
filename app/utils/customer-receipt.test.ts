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

test('gives the public record four distinct proof destinations', () => {
  const listingProofDestinations = (customerReceipt as unknown as {
    listingProofDestinations: (siteUrl: string, slug: string) => Array<{ key: string, label: string, description: string, url: string }>
  }).listingProofDestinations

  expect(listingProofDestinations).toBeFunction()

  const destinations = listingProofDestinations('https://launchlog.ai', 'acme')

  expect(destinations.map(d => d.key)).toEqual(['published', 'schema', 'markdown', 'llms'])
  expect(destinations.map(d => d.url)).toEqual([
    'https://launchlog.ai/listing/acme',
    'https://launchlog.ai/listing/acme/schema',
    'https://launchlog.ai/listing/acme/markdown',
    'https://launchlog.ai/llms-full.txt',
  ])

  // The point of the ledger: four labels must never resolve to one URL. A
  // repeated destination is the defect this assertion exists to catch.
  expect(new Set(destinations.map(d => d.url)).size).toBe(destinations.length)
  expect(new Set(destinations.map(d => d.label)).size).toBe(destinations.length)
})

test('names each artifact by what it is, not by an AI framing', () => {
  const listingProofDestinations = (customerReceipt as unknown as {
    listingProofDestinations: (siteUrl: string, slug: string) => Array<{ label: string, description: string }>
  }).listingProofDestinations

  expect(listingProofDestinations('https://launchlog.ai', 'acme').map(d => d.label)).toEqual([
    'Public page',
    'Structured data',
    'Markdown representation',
    'Discovery feed',
  ])
})

test('builds the customer shelf ledger from the receipt URLs returned by the API', () => {
  const receiptProofDestinations = (customerReceipt as unknown as {
    receiptProofDestinations: (receipt: Record<string, unknown>) => Array<{ key: string, label: string, url: string }>
  }).receiptProofDestinations

  expect(receiptProofDestinations).toBeFunction()

  const destinations = receiptProofDestinations({
    public_url: 'https://launchlog.ai/listing/acme',
    schema_url: 'https://launchlog.ai/listing/acme/schema',
    markdown_url: 'https://launchlog.ai/listing/acme/markdown',
    sitemap_url: 'https://launchlog.ai/sitemap.xml',
    llms_url: 'https://launchlog.ai/llms-full.txt',
    checks: { published: true, schema: true, markdown: true, llms: true },
  })

  expect(destinations.map(item => item.url)).toEqual([
    'https://launchlog.ai/listing/acme',
    'https://launchlog.ai/listing/acme/schema',
    'https://launchlog.ai/listing/acme/markdown',
    'https://launchlog.ai/llms-full.txt',
  ])
  expect(new Set(destinations.map(item => item.url)).size).toBe(4)
})
