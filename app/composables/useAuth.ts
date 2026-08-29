type AuthUser = { uid: string; email: string | null; displayName: string | null } | null

export const useAuth = () => {
  // SSR-safe shared state: one ref per request, hydrated from the Firebase plugin
  // (which sets it via onAuthStateChanged on the client only).
  const user = useState<AuthUser>('auth.user', () => null)

  if (import.meta.client) {
    readMagicLinkEmail(window.localStorage)
  }

  const loginWithGoogle = async () => {
    if (!import.meta.client) return null
    const { signInWithPopup } = await import('firebase/auth')
    const { $firebase } = useNuxtApp()
    const credential = await signInWithPopup($firebase.auth, $firebase.googleProvider)
    clearMagicLinkEmail(window.localStorage)
    return credential
  }

  const sendMagicLink = async (email: string, redirect: unknown = '/dashboard'): Promise<void> => {
    if (!import.meta.client) return
    const { sendSignInLinkToEmail } = await import('firebase/auth')
    const { $firebase } = useNuxtApp()
    const url = authMagicLinkUrl(window.location.origin, redirect)
    await sendSignInLinkToEmail($firebase.auth, email, { url, handleCodeInApp: true })
    rememberMagicLinkEmail(window.localStorage, email)
  }

  const completeMagicLink = async (confirmedEmail?: string) => {
    if (!import.meta.client) return null
    const { isSignInWithEmailLink, signInWithEmailLink } = await import('firebase/auth')
    const { $firebase } = useNuxtApp()
    if (!isSignInWithEmailLink($firebase.auth, window.location.href)) return null

    const storedEmail = readMagicLinkEmail(window.localStorage)
    const email = resolveMagicLinkEmail(storedEmail, confirmedEmail)
    if (!email) return { status: 'email_required' as const }

    let credential
    try {
      credential = await signInWithEmailLink($firebase.auth, email, window.location.href)
    }
    catch (error: unknown) {
      if (!confirmedEmail && storedEmail) {
        clearMagicLinkEmail(window.localStorage)
        return { status: 'email_required' as const }
      }
      throw error
    }

    clearMagicLinkEmail(window.localStorage)
    return { status: 'signed_in' as const, user: credential.user }
  }

  const logout = async (): Promise<void> => {
    if (!import.meta.client) return
    const { signOut } = await import('firebase/auth')
    const { $firebase } = useNuxtApp()
    try {
      await signOut($firebase.auth)
    }
    finally {
      clearMagicLinkEmail(window.localStorage)
    }
  }

  // Resolves once Firebase has restored persisted auth state, so guards/admin
  // checks on a hard reload don't run before currentUser is hydrated.
  const waitForAuthReady = async (): Promise<void> => {
    if (!import.meta.client) return
    const { $firebase } = useNuxtApp()
    await $firebase?.auth?.authStateReady?.()
  }

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    if (!import.meta.client) return null
    const { $firebase } = useNuxtApp()
    const u = $firebase?.auth?.currentUser
    return u ? u.getIdToken(forceRefresh) : null
  }

  // Firebase custom claims (role/plan/subscription_status/entitlements) are the
  // auth/RBAC source of truth (D-055). Admin UI may read these for affordances,
  // but the backend remains the final authority on every protected request.
  const getClaims = async (forceRefresh = false): Promise<Record<string, unknown> | null> => {
    if (!import.meta.client) return null
    const { $firebase } = useNuxtApp()
    const u = $firebase?.auth?.currentUser
    if (!u) return null
    const result = await u.getIdTokenResult(forceRefresh)
    return result?.claims ?? null
  }

  // Force a token refresh so newly-set server-side claims take effect without
  // requiring the user to log out and back in.
  const refreshTokenClaims = async (): Promise<Record<string, unknown> | null> => {
    return getClaims(true)
  }

  const isAdmin = async (): Promise<boolean> => {
    const claims = await getClaims()
    return claims?.role === 'admin'
  }

  return {
    user,
    loginWithGoogle,
    sendMagicLink,
    completeMagicLink,
    logout,
    waitForAuthReady,
    getIdToken,
    getClaims,
    refreshTokenClaims,
    isAdmin,
  }
}
