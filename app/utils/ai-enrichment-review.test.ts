import { describe, expect, test } from 'bun:test'
import { aiFieldDisplayValue, aiFieldLinks, changedAiFields, previewEditFromSuggestion } from './ai-enrichment-review'

describe('AI enrichment review', () => {
  test('only offers fields whose proposed value is different', () => {
    expect(changedAiFields(
      { name: 'Acme', tagline: 'Old', description: null, social_links: [] },
      { name: 'Acme', tagline: 'New', description: 'Useful', social_links: [] },
      ['name', 'tagline', 'description', 'social_links'],
    )).toEqual(['tagline', 'description'])
  })

  test('maps selected preview fields without overwriting unselected copy', () => {
    expect(previewEditFromSuggestion(
      { title: 'Current', tagline: 'Keep', description: 'Old', primary_category_id: null },
      { title: 'Suggested', tagline: 'Replace', description: 'New', category_id: 'category-1' },
      ['name', 'description', 'category'],
    )).toEqual({
      title: 'Suggested',
      tagline: 'Keep',
      description: 'New',
      primary_category_id: 'category-1',
    })
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
