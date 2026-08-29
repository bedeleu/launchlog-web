import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const plugin = readFileSync(fileURLToPath(new URL('./plausible.client.ts', import.meta.url)), 'utf8')
const consent = readFileSync(fileURLToPath(new URL('../composables/usePrivacyConsent.ts', import.meta.url)), 'utf8')

describe('Plausible client lifecycle', () => {
  test('uses the controlled Events API transport without executing the vendor script', () => {
    expect(plugin).toContain('installPlausibleClientLifecycle')
    expect(plugin).toContain('refreshFromStorage')
    expect(plugin).not.toContain("createElement('script')")
    expect(plugin).not.toContain('append(script)')
  })

  test('guards pageviews against failed or duplicate Vue Router navigation', () => {
    expect(plugin).toContain('handler(to.fullPath, from.fullPath, failure)')
  })

  test('fails closed when the current browser origin is not the configured dataset origin', () => {
    expect(plugin).toContain('browserOrigin: window.location.origin')
  })

  test('fails closed when another tab clears site storage', () => {
    expect(consent).toContain('event.key === null')
    expect(consent).toContain('consent.value = null')
  })
})
