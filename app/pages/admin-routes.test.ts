import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pagesDirectory = fileURLToPath(new URL('.', import.meta.url))
const weeklyEditionIndex = readFileSync(`${pagesDirectory}/admin/weekly-editions/index.vue`, 'utf8')
const weeklyEditionDetail = readFileSync(`${pagesDirectory}/admin/weekly-editions/[id].vue`, 'utf8')

describe('admin page routing', () => {
  test('keeps the admin dashboard as the nested index route', () => {
    expect(existsSync(`${pagesDirectory}/admin/index.vue`)).toBe(true)
    expect(existsSync(`${pagesDirectory}/admin.vue`)).toBe(false)
  })

  test('uses the canonical nested outreach page and forbids the obsolete flat route', () => {
    expect(existsSync(`${pagesDirectory}/admin/outreach.vue`)).toBe(true)
    expect(existsSync(`${pagesDirectory}/admin-outreach.vue`)).toBe(false)
  })

  test('owns weekly editions under the canonical nested admin routes only', () => {
    expect(existsSync(`${pagesDirectory}/admin/weekly-editions/index.vue`)).toBe(true)
    expect(existsSync(`${pagesDirectory}/admin/weekly-editions/[id].vue`)).toBe(true)
    expect(existsSync(`${pagesDirectory}/admin/weekly-editions.vue`)).toBe(false)
    expect(existsSync(`${pagesDirectory}/admin-weekly-editions.vue`)).toBe(false)
    expect(existsSync(`${pagesDirectory}/admin-weekly-editions/[id].vue`)).toBe(false)
  })

  test('reloads weekly edition routes reactively and ignores stale responses', () => {
    expect(weeklyEditionIndex).toContain('const normalizedPage')
    expect(weeklyEditionIndex).toContain('watch(normalizedPage')
    expect(weeklyEditionIndex).toContain('let loadSequence = 0')
    expect(weeklyEditionIndex).toContain('targetPage > response.meta.last_page')
    expect(weeklyEditionDetail).toContain('const normalizedEditionId')
    expect(weeklyEditionDetail).toContain('watch(normalizedEditionId')
    expect(weeklyEditionDetail).toContain('let loadSequence = 0')
  })

  test('uses authored draft creation validation and create-only busy feedback', () => {
    expect(weeklyEditionIndex).toContain('const slugError')
    expect(weeklyEditionIndex).toContain('function validateSlug')
    expect(weeklyEditionIndex).toContain('novalidate')
    expect(weeklyEditionIndex).toContain(':aria-invalid="!!slugError"')
    expect(weeklyEditionIndex).toContain(':aria-describedby="slugError ? \'edition-slug-error\' : undefined"')
    expect(weeklyEditionIndex).toContain("pendingAction.value = 'create'")
    expect(weeklyEditionIndex).toContain("pendingAction === 'create' ? 'Creating…' : 'Create draft'")
    expect(weeklyEditionIndex).toContain('active:border-release-paper active:bg-release-paper/10')
  })

  test('renders list failures exclusively and never relabels a stale page as the current route', () => {
    expect(weeklyEditionIndex).toContain('const listError')
    expect(weeklyEditionIndex).toContain('editions.value = null')
    expect(weeklyEditionIndex).toContain('v-else-if="listError"')
    expect(weeklyEditionIndex).toContain('{{ listError }}')
  })
})
