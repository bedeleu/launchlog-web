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
})
