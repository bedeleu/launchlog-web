const DASHBOARD_FALLBACK = '/dashboard'

export function safeAuthRedirect(candidate: unknown): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return DASHBOARD_FALLBACK
  }

  const pathEnd = candidate.search(/[?#]/)
  const rawPath = pathEnd === -1 ? candidate : candidate.slice(0, pathEnd)
  const hasMalformedEncoding = /%(?![0-9a-f]{2})/i.test(rawPath)
  const hasEncodedSeparator = /%(?:2f|5c)/i.test(rawPath)
  const hasEncodedControl = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(rawPath)
  const hasDotSegment = rawPath
    .split('/')
    .some((segment) => {
      const normalized = segment.replace(/%2e/gi, '.')
      return normalized === '.' || normalized === '..'
    })
  const hasRawControlOrBackslash = Array.from(candidate).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return character === '\\' || codePoint <= 0x1F || codePoint === 0x7F
  })

  if (
    hasRawControlOrBackslash
    || hasMalformedEncoding
    || hasEncodedSeparator
    || hasEncodedControl
    || hasDotSegment
  ) {
    return DASHBOARD_FALLBACK
  }

  try {
    const target = new URL(candidate, 'https://launchlog.ai')
    const isDashboardRoute = target.pathname === '/dashboard'
      || target.pathname.startsWith('/dashboard/')
    const isAdminRoute = target.pathname === '/admin'
      || target.pathname.startsWith('/admin/')

    if (target.origin !== 'https://launchlog.ai' || (!isDashboardRoute && !isAdminRoute)) {
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
