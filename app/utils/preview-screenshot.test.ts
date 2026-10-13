import { describe, expect, test } from 'bun:test'
import { previewScreenshotCandidates } from './preview-screenshot'

const thumb = `https://cdn.launchlog.ai/snapshots/${'a'.repeat(40)}/thumb.webp`

describe('preview screenshot sources', () => {
  test('prefers the existing large snapshot and retains the exact original as fallback', () => {
    expect(previewScreenshotCandidates(`${thumb}?v=1791789773`)).toEqual([
      `${thumb.replace('thumb.webp', 'featured.webp')}?v=1791789773`,
      `${thumb}?v=1791789773`,
    ])
  })

  test('keeps external, legacy and signed image URLs unchanged', () => {
    for (const url of [
      'https://images.example.com/thumb.webp',
      'https://cdn.launchlog.ai/listings/old-screenshot.png',
      `${thumb}?signature=private`,
      thumb.replace('cdn.launchlog.ai', 'cdn.launchlog.ai.example.com'),
      thumb.replace('https:', 'http:'),
    ]) {
      expect(previewScreenshotCandidates(url)).toEqual([url])
    }
  })

  test('rejects missing, malformed and executable sources', () => {
    for (const url of [null, '', 'not-a-url', 'javascript:alert(1)', 'data:image/svg+xml,test']) {
      expect(previewScreenshotCandidates(url)).toEqual([])
    }
  })
})
