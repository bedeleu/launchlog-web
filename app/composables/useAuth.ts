type AuthUser = { uid: string; email: string | null; displayName: string | null } | null

export const useAuth = () => {
  // SSR-safe shared state: one ref per request, hydrated from the Firebase plugin
  // (which sets it via onAuthStateChanged on the client only).
  const user = useState<AuthUser>('auth.user', () => null)

  const loginWithGoogle = async () => {
    if (!import.meta.client) return null
    const { signInWithPopup } = await import('firebase/auth')
    const { $firebase } = useNuxtApp()
    return signInWithPopup($firebase.auth, $firebase.googleProvider)
  }

  const loginWithPassword = async (email: string, password: string) => {
    if (!import.meta.client) return null
    const { signInWithEmailAndPassword } = await import('firebase/auth')
    const { $firebase } = useNuxtApp()
    return signInWithEmailAndPassword($firebase.auth, email, password)
  }

  const sendMagicLink = async (email: string): Promise<void> => {
    if (!import.meta.client) return
    const { sendSignInLinkToEmail } = await import('firebase/auth')
    const { $firebase } = useNuxtApp()
    // window.location.origin keeps the magic link valid on localhost / Railway preview / production
    // without any env-aware logic. D-009 invisible-tech-edge says the auth flow must "just work" in
    // every environment without hand-editing redirect URLs.
    const url = `${window.location.origin}/login?magic=1`
    await sendSignInLinkToEmail($firebase.auth, email, { url, handleCodeInApp: true })
    window.localStorage.setItem('launchlog:magic-link-email', email)
  }

  const completeMagicLink = async () => {
    if (!import.meta.client) return null
    const { isSignInWithEmailLink, signInWithEmailLink } = await import('firebase/auth')
    const { $firebase } = useNuxtApp()
    if (!isSignInWithEmailLink($firebase.auth, window.location.href)) return null
    let email = window.localStorage.getItem('launchlog:magic-link-email')
    if (!email) email = window.prompt('Please confirm your email') ?? ''
    if (!email) return null
    const result = await signInWithEmailLink($firebase.auth, email, window.location.href)
    window.localStorage.removeItem('launchlog:magic-link-email')
    return result
  }

  const logout = async (): Promise<void> => {
    if (!import.meta.client) return
    const { signOut } = await import('firebase/auth')
    const { $firebase } = useNuxtApp()
    await signOut($firebase.auth)
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
    loginWithPassword,
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
