import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./PreviewEditor.vue', import.meta.url)), 'utf8')

describe('PreviewEditor', () => {
  test('keeps editing secondary and applies one reviewed AI change set', () => {
    expect(source).toContain('data-preview-editor')
    expect(source).toContain('Edit listing text')
    expect(source).toContain('Improve draft with AI')
    expect(source).toContain("@apply=\"emit('apply', $event)\"")
    expect(source).not.toContain('linear-gradient')
    expect(source).not.toMatch(/violet|purple|indigo|mauve/i)
  })
})
