import { describe, expect, test } from 'bun:test'
import { createOutreachAuthorizationGuard } from './outreach-auth'

describe('outreach authorization session', () => {
  test('purges before redirect, preserves the route, and coalesces cross-tab and API failures', async () => {
    const events: string[] = []
    let finishRedirect: () => void = () => undefined
    const redirect = new Promise<void>((resolve) => { finishRedirect = resolve })
    const guard = createOutreachAuthorizationGuard({
      clearSensitive: () => { events.push('clear') },
      currentPath: () => '/admin/outreach?view=history',
      redirectToLogin: async (location) => {
        events.push(`redirect:${location}`)
        await redirect
      },
    })

    const handling = guard.handleAuthorizationLoss()
    guard.handleAuthStateChange(null, { uid: 'admin-user' })

    expect(events).toEqual([
      'clear',
      'redirect:/login?redirect=%2Fadmin%2Foutreach%3Fview%3Dhistory',
    ])

    finishRedirect()
    await handling
  })

  test('does not redirect for initial hydration or a still-authenticated transition', () => {
    let clears = 0
    const guard = createOutreachAuthorizationGuard({
      clearSensitive: () => { clears += 1 },
      currentPath: () => '/admin/outreach',
      redirectToLogin: async () => undefined,
    })

    guard.handleAuthStateChange(null, null)
    guard.handleAuthStateChange({ uid: 'admin-user' }, null)
    guard.handleAuthStateChange({ uid: 'admin-user' }, { uid: 'admin-user' })

    expect(clears).toBe(0)
  })
})
