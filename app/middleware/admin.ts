/**
 * Client-side admin gate for /admin/* routes. UX only — the backend `admin`
 * middleware (D-055) is the real authority and 403s any non-admin API call.
 * Waits for Firebase to restore auth state so a hard reload doesn't bounce a
 * logged-in admin to /login before currentUser hydrates.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const { waitForAuthReady, isAdmin } = useAuth()
  await waitForAuthReady()

  if (!(await isAdmin())) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
