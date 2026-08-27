import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./PreviewStatus.vue', import.meta.url)), 'utf8')

describe('PreviewStatus release recorder', () => {
  test('keeps processing feedback compact, deterministic, and free of fake progress', () => {
    expect(source).toContain('data-preview-status')
    expect(source).toContain('releaseProgress')
    expect(source).toContain("sm:aspect-[16/5]")
    expect(source).toContain('Validate')
    expect(source).toContain('Ready')
    expect(source).not.toContain('% complete')
    expect(source).not.toContain('progress.completed * 20')
    expect(source).not.toContain('linear-gradient')
    expect(source).not.toContain('skeleton')
  })
})
