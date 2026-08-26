import { describe, expect, test } from 'bun:test'
import { scanClaimContent } from './validate-claims'

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
})
