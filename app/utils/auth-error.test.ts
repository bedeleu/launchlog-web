import { describe, expect, test } from 'bun:test'
import { firebaseAuthErrorMessage } from './auth-error'

describe('firebaseAuthErrorMessage', () => {
  test('turns an unauthorized domain error into a useful recovery path', () => {
    expect(firebaseAuthErrorMessage({ code: 'auth/unauthorized-domain' }, 'google')).toBe(
      'Google sign-in is not available from this address. Open launchlog.ai in a new tab and try again, or use the email sign-in link.',
    )
  })

  test('recognizes Firebase codes embedded in raw messages without exposing them', () => {
    const message = firebaseAuthErrorMessage(
      new Error('Firebase: Error (auth/unauthorized-domain).'),
      'google',
    )

    expect(message).toContain('Open launchlog.ai')
    expect(message).not.toContain('Firebase')
    expect(message).not.toContain('auth/')
  })

  test('gives specific recovery messages for common popup and network failures', () => {
    expect(firebaseAuthErrorMessage({ code: 'auth/popup-blocked' }, 'google')).toContain('Allow pop-ups')
    expect(firebaseAuthErrorMessage({ code: 'auth/popup-closed-by-user' }, 'google')).toContain('cancelled')
    expect(firebaseAuthErrorMessage({ code: 'auth/network-request-failed' }, 'google')).toContain('connection')
  })

  test('keeps magic-link failures friendly and action-specific', () => {
    expect(firebaseAuthErrorMessage({ code: 'auth/invalid-email' }, 'magic-send')).toBe('Enter a valid email address.')
    expect(firebaseAuthErrorMessage({ code: 'auth/expired-action-code' }, 'magic-verify')).toContain('Request a new link')
    expect(firebaseAuthErrorMessage(new Error('internal detail'), 'magic-send')).toBe(
      'We could not send the sign-in link. Check the email address and try again.',
    )
  })
})
