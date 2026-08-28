import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const review = readFileSync(fileURLToPath(new URL('./ProposalReview.vue', import.meta.url)), 'utf8')
const dashboard = readFileSync(fileURLToPath(new URL('../../pages/dashboard.vue', import.meta.url)), 'utf8')

describe('one-step AI approval', () => {
  test('makes the owner action explicitly apply and persist the selected fields', () => {
    expect(review).toContain("if (props.mode === 'owner') return 'Apply & save selected changes'")
    expect(review).toContain("emit('apply', selected)")
    expect(review).toContain('Selected fields publish immediately')
  })

  test('does not duplicate the canonical edit form while a proposal is being reviewed', () => {
    expect(dashboard).toContain('v-if="drafts[listing.id] && !aiProposals[listing.id]"')
    expect(dashboard).toContain('@apply="fields => applyAiDraft(listing, fields)"')
  })

  test('uses Release Catalog materials without rounded AI cards', () => {
    expect(review).not.toMatch(/indigo|violet|purple|bg-gradient|backdrop-blur/)
    expect(review).not.toContain('rounded-xl')
    expect(review).not.toContain('rounded-lg')
    expect(review).not.toContain('brand-accent')
  })
})
