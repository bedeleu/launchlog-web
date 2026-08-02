const DASHBOARD_FALLBACK = '/dashboard'

export function safeAuthRedirect(candidate: unknown): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return DASHBOARD_FALLBACK
  }

  try {
    const target = new URL(candidate, 'https://launchlog.ai')
    const isDashboardRoute = target.pathname === '/dashboard'
      || target.pathname.startsWith('/dashboard/')

    if (target.origin !== 'https://launchlog.ai' || !isDashboardRoute) {
      return DASHBOARD_FALLBACK
    }

    return `${target.pathname}${target.search}${target.hash}`
  }
  catch {
    return DASHBOARD_FALLBACK
  }
}

export function authMagicLinkUrl(origin: string, redirect: unknown): string {
  const target = new URL('/login', origin)
  target.searchParams.set('magic', '1')
  target.searchParams.set('redirect', safeAuthRedirect(redirect))
  return target.toString()
}

export function resolveMagicLinkEmail(storedEmail: string | null, confirmedEmail?: string): string | null {
  const email = confirmedEmail?.trim() || storedEmail?.trim()
  return email || null
}
