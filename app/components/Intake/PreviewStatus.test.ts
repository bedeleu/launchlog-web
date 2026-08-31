import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./PreviewStatus.vue', import.meta.url)), 'utf8')

describe('PreviewStatus release recorder', () => {
  test('keeps processing feedback compact, deterministic, and free of fake progress', () => {
    expect(source).toContain('data-preview-status')
    expect(source).toContain('data-preview-status-summary')
    expect(source).toContain('data-preview-status-steps')
    expect(source).toContain('releaseProgress')
    expect(source).toContain(':aria-current')
    expect(source).toContain('step.key === progress.step')
    expect(source).toContain('stepStateLabel')
    expect(source).toContain('Validate')
    expect(source).toContain('Ready')
    expect(source).toContain('Complete')
    expect(source).toContain('Current')
    expect(source).toContain('Queued')
    expect(source).toContain('px-1 py-3 min-[360px]:px-2 sm:px-3')
    expect(source).toContain('hidden size-1.5 shrink-0 bg-current sm:block')
    expect(source).not.toContain('aspect-[16/5]')
    expect(source).not.toContain('lg:grid-cols-1')
    expect(source).not.toContain('min-h-36')
    expect(source).not.toContain('index === progress.completed')
    expect(source).not.toContain('class="truncate font-mono')
    expect(source).not.toContain('% complete')
    expect(source).not.toContain('progress.completed * 20')
    expect(source).not.toContain('linear-gradient')
    expect(source).not.toContain('skeleton')
  })
})
