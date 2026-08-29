import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const plugin = readFileSync(fileURLToPath(new URL('./intake-retention.client.ts', import.meta.url)), 'utf8')
const store = readFileSync(fileURLToPath(new URL('../stores/intake.ts', import.meta.url)), 'utf8')

describe('global intake retention lifecycle', () => {
  test('initializes browser pruning on every app entry, including non-intake routes', () => {
    expect(plugin).toContain('useIntakeStore()')
    expect(store).toContain('if (import.meta.client)')
    expect(store).toContain('pruneExpiredDrafts()')
    expect(store).toContain('pruneLastUrl()')
  })
})
