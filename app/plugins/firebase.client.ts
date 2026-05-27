import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const fbConfig = {
    apiKey: config.public.firebase.apiKey,
    authDomain: config.public.firebase.authDomain,
    projectId: config.public.firebase.projectId,
    storageBucket: config.public.firebase.storageBucket,
    messagingSenderId: config.public.firebase.messagingSenderId,
    appId: config.public.firebase.appId,
  }

  const app = getApps().length ? getApps()[0]! : initializeApp(fbConfig)
  const auth = getAuth(app)
  const googleProvider = new GoogleAuthProvider()

  // Keep SSR-safe shared state in sync with Firebase auth state.
  // Note: this runs only on the client (.client.ts), so the listener is correctly scoped.
  const userState = useState<{
    uid: string
    email: string | null
    displayName: string | null
  } | null>('auth.user', () => null)

  onAuthStateChanged(auth, (u) => {
    userState.value = u
      ? { uid: u.uid, email: u.email, displayName: u.displayName }
      : null
  })

  return {
    provide: {
      firebase: { app, auth, googleProvider },
    },
  }
})
