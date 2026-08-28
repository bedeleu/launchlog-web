import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./AppBar.vue', import.meta.url)), 'utf8')

describe('authenticated header navigation', () => {
  test('keeps the customer dashboard available to every signed-in account', () => {
    expect(source.match(/to="\/dashboard"/g)).toHaveLength(2)
    expect(source).not.toContain('user && !admin')
    expect(source).not.toContain('v-else-if="user"')
  })

  test('adds admin as a separate destination instead of replacing the dashboard', () => {
    expect(source.match(/to="\/admin"/g)).toHaveLength(2)

    const desktopDashboard = source.indexOf('to="/dashboard"')
    const desktopAdmin = source.indexOf('to="/admin"')

    expect(desktopDashboard).toBeGreaterThan(-1)
    expect(desktopAdmin).toBeGreaterThan(desktopDashboard)
  })

  test('keeps private destinations behind their independent auth gates', () => {
    expect(source).toContain('v-if="user"')
    expect(source).toContain('v-if="admin"')
    expect(source).toContain('v-else to="/login"')
  })

  test('uses the Release Catalog rail without decorative gradients', () => {
    expect(source).toContain('bg-release-ink')
    expect(source).toContain('border-release-seam')
    expect(source).toContain('bg-release-blaze')
    expect(source).not.toContain('bg-gradient')
  })

  test('does not use the verified-success signal for neutral navigation', () => {
    expect(source).not.toContain('release-signal')
  })
})
