import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildAdminListingUpdate, isAdminListingDirty } from './admin-listing-editor'

describe('admin listing editor', () => {
  test('submits only human-facing content and placement controls', () => {
    expect(buildAdminListingUpdate({
      name: '  LaunchLog  ',
      tagline: '',
      description: '  The log of what just shipped. ',
      primary_category_id: '',
      country: ' gr ',
      tier: 'featured',
    })).toEqual({
      name: 'LaunchLog',
      tagline: null,
      description: 'The log of what just shipped.',
      primary_category_id: null,
      country: 'GR',
      tier: 'featured',
    })
  })

  test('keeps technical fields out of the editable form', () => {
    const filename = fileURLToPath(new URL('../components/Admin/ListingForm.vue', import.meta.url))
    const source = readFileSync(filename, 'utf8')

    expect(source).toContain('Public content')
    expect(source).toContain('Category')
    expect(source).toContain('Website and capture')
    expect(source).toContain(':href="initial.url"')
    expect(source).toContain(':src="initial.screenshot_url"')
    expect(source).not.toContain('v-model="form.url"')
    expect(source).not.toContain('v-model="form.screenshot_url"')
    expect(source).not.toContain('v-model="form.source"')
    expect(source).not.toContain('v-model="form.status"')
    expect(source).not.toContain('v-model="form.link_text"')
  })

  test('enables manual save only for meaningful normalized changes', () => {
    const initial = {
      name: 'LaunchLog',
      tagline: null,
      description: 'The log of what just shipped.',
      primary_category_id: null,
      country: 'GR',
      tier: 'featured',
    }

    expect(isAdminListingDirty(initial, {
      name: '  LaunchLog  ',
      tagline: '',
      description: 'The log of what just shipped.',
      primary_category_id: '',
      country: 'gr',
      tier: 'featured',
    })).toBe(false)

    expect(isAdminListingDirty(initial, {
      name: 'LaunchLog',
      tagline: 'A curated launch directory',
      description: 'The log of what just shipped.',
      primary_category_id: '',
      country: 'GR',
      tier: 'featured',
    })).toBe(true)
  })
})
