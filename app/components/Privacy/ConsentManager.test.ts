import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const manager = readFileSync(fileURLToPath(new URL('./ConsentManager.client.vue', import.meta.url)), 'utf8')
const footer = readFileSync(fileURLToPath(new URL('../Footer.vue', import.meta.url)), 'utf8')
const layout = readFileSync(fileURLToPath(new URL('../../layouts/default.vue', import.meta.url)), 'utf8')

describe('privacy choices UI contract', () => {
  test('offers equally prominent accept and reject actions before analytics loads', () => {
    expect(manager).toContain('Accept analytics')
    expect(manager).toContain('Reject analytics')
    expect(manager).toContain('Manage choices')
    expect(manager.match(/consent-choice/g)?.length).toBeGreaterThanOrEqual(2)
    expect(manager).not.toMatch(/checked(?:=|\s)/)
    expect(manager).toContain('max-h-[calc(100dvh-1.5rem)]')
    expect(manager).toContain('overflow-y-auto')
    expect(manager).toContain('overscroll-contain')
  })

  test('uses an accessible, project-styled preferences dialog', () => {
    expect(manager).toContain('<div data-privacy-consent-root :lang=')
    for (const primitive of ['DialogRoot', 'DialogPortal', 'DialogOverlay', 'DialogContent', 'DialogTitle', 'DialogDescription']) {
      expect(manager).toContain(primitive)
    }
    expect(manager).toContain('SwitchRoot')
    expect(manager).toContain(':aria-label="copy.analyticsLabel"')
    expect(manager).toContain("analyticsLabel: 'Analytics'")
    expect(manager).toContain('release-panel')
    expect(manager).toContain('focus-visible:outline-release-focus')
    expect(manager).toContain('restorePreferencesFocus')
    expect(manager).toContain('chooseFromBanner')
    expect(manager).toContain("querySelector<HTMLElement>('#main-content')")
    expect(manager).toContain('aria-live="polite"')
  })

  test('keeps withdrawal available from the global footer', () => {
    expect(footer).toContain('Privacy choices')
    expect(footer).toContain('openPreferences')
    expect(layout).toContain('<PrivacyConsentManager />')
    expect(layout.indexOf('<PrivacyConsentManager />')).toBeLessThan(layout.indexOf('<AppBar />'))
  })
})
