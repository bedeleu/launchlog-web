import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

const createPage = read('./admin/listings/new.vue')
const editPage = read('./admin/listings/[id].vue')
const form = read('../components/Admin/ListingForm.vue')

describe('Release Catalog admin listing flow', () => {
  test('keeps creation URL-first through the shared onboarding', () => {
    expect(createPage).toContain('<ReleaseShell')
    expect(createPage).toContain('<IntakePreviewForm />')
    expect(createPage).not.toContain('<AdminListingForm')
  })

  test('shows either AI proof review or manual editing, never both', () => {
    expect(editPage).toContain('v-if="aiProposal"')
    expect(editPage).toContain('v-if="!aiProposal"')
    expect(editPage).toContain('mode="admin"')
  })

  test('uses the Release Catalog editor instead of legacy AI and rounded card styling', () => {
    expect(form).toContain('border-release-seam')
    expect(form).toContain('text-release-paper')
    expect(form).not.toMatch(/indigo|violet|purple|bg-gradient|backdrop-blur/)
    expect(form).not.toMatch(/brand-(?:bg|fg|accent|success|warning|muted|border)/)
    expect(form).not.toContain('rounded-xl')
    expect(form).not.toContain('rounded-lg')
  })
})
