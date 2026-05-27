type AuthUser = { uid: string; email: string | null; displayName: string | null } | null

export const useAuth = () => {
  // SSR-safe shared state: one ref per request, hydrated from the Firebase plugin
  // (which sets it via onAuthStateChanged on the client only).
  const user = useState<AuthUser>('auth.user', () => null)

  const loginWithGoogle = async () => {
    if (!import.meta.client) return null
    const { signInWithPopup } = await import('firebase/auth')
    const { $firebase } = useNuxtApp() as any
    return signInWithPopup($firebase.auth, $firebase.googleProvider)
  }

  const loginWithPassword = async (email: string, password: string) => {
    if (!import.meta.client) return null
    const { signInWithEmailAndPassword } = await import('firebase/auth')
    const { $firebase } = useNuxtApp() as any
    return signInWithEmailAndPassword($firebase.auth, email, password)
  }

  const sendMagicLink = async (email: string): Promise<void> => {
    if (!import.meta.client) return
    const { sendSignInLinkToEmail } = await import('firebase/auth')
    const { $firebase } = useNuxtApp() as any
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
    const { $firebase } = useNuxtApp() as any
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
    const { $firebase } = useNuxtApp() as any
    await signOut($firebase.auth)
  }

  const getIdToken = async (): Promise<string | null> => {
    if (!import.meta.client) return null
    const { $firebase } = useNuxtApp() as any
    const u = $firebase?.auth?.currentUser
    return u ? u.getIdToken() : null
  }

  return { user, loginWithGoogle, loginWithPassword, sendMagicLink, completeMagicLink, logout, getIdToken }
}
