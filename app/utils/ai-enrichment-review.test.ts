import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { aiFieldDisplayValue, aiFieldLinks, changedAiFields } from './ai-enrichment-review'

const source = readFileSync(fileURLToPath(new URL('./ai-enrichment-review.ts', import.meta.url)), 'utf8')
const proposalReview = readFileSync(fileURLToPath(new URL('../components/Ai/ProposalReview.vue', import.meta.url)), 'utf8')

describe('AI enrichment review', () => {
  test('only offers fields whose proposed value is different', () => {
    expect(changedAiFields(
      { name: 'Acme', tagline: 'Old', description: null, social_links: [] },
      { name: 'Acme', tagline: 'New', description: 'Useful', social_links: [] },
      ['name', 'tagline', 'description', 'social_links'],
    )).toEqual(['tagline', 'description'])
  })

  test('keeps proposal review exclusively on authenticated owner and admin surfaces', () => {
    expect(source).not.toContain('previewEditFromSuggestion')
    expect(proposalReview).not.toContain("'preview'")
    expect(proposalReview).toContain("mode?: 'owner' | 'admin'")
  })

  test('formats visual proposal fields without hiding their exact URLs', () => {
    const payload = {
      logo_url: 'https://cdn.example.com/logo.png',
      social_links: ['https://github.com/example', 'https://linkedin.com/company/example'],
    }

    expect(aiFieldDisplayValue(payload, 'logo_url')).toBe('https://cdn.example.com/logo.png')
    expect(aiFieldLinks(payload, 'logo_url')).toEqual(['https://cdn.example.com/logo.png'])
    expect(aiFieldDisplayValue(payload, 'social_links')).toBe('https://github.com/example\nhttps://linkedin.com/company/example')
    expect(aiFieldLinks(payload, 'social_links')).toEqual(payload.social_links)
  })
})
