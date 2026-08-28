import { toErrorLike } from './error-like'

export type AuthErrorAction = 'google' | 'magic-send' | 'magic-verify'

function firebaseErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && code.startsWith('auth/')) return code
  }

  return toErrorLike(error).message?.match(/\b(auth\/[a-z-]+)\b/)?.[1] ?? null
}

const messages: Record<string, string> = {
  'auth/unauthorized-domain': 'Google sign-in is not available from this address. Open launchlog.ai in a new tab and try again, or use the email sign-in link.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for LaunchLog or use the email sign-in link.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled. Try again when you’re ready.',
  'auth/network-request-failed': 'We could not reach Google. Check your connection and try again.',
  'auth/account-exists-with-different-credential': 'An account already exists for this email. Use the sign-in method you used before.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/expired-action-code': 'This sign-in link has expired. Request a new link and try again.',
  'auth/invalid-action-code': 'This sign-in link is invalid or has already been used. Request a new link and try again.',
  'auth/too-many-requests': 'Too many sign-in attempts were made. Wait a moment and try again.',
  'auth/user-disabled': 'This account is unavailable. Contact LaunchLog support for help.',
}

export function firebaseAuthErrorMessage(error: unknown, action: AuthErrorAction): string {
  const code = firebaseErrorCode(error)
  if (code && messages[code]) return messages[code]

  if (action === 'magic-send') {
    return 'We could not send the sign-in link. Check the email address and try again.'
  }

  if (action === 'magic-verify') {
    return 'We could not verify this sign-in link. Request a new link and try again.'
  }

  return 'Google sign-in could not be completed. Try again or use the email sign-in link.'
}
