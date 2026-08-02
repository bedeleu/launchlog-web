export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const { waitForAuthReady } = useAuth()
  await waitForAuthReady()

  const { $firebase } = useNuxtApp()
  if (!$firebase.auth.currentUser) {
    const redirect = safeAuthRedirect(to.fullPath)
    return navigateTo(`/login?redirect=${encodeURIComponent(redirect)}`)
  }
})
