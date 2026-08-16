/**
 * Private routes are protected by two case-sensitive mechanisms — `Disallow:` lines in robots.txt
 * and `noindex` route rules — so a mis-cased request slips past both and becomes a live duplicate
 * of a page that is supposed to be unreachable to crawlers. Nuxt <4.5.1 made that worse by dropping
 * route rules entirely for mixed-case paths (GHSA-hxvh-4h3w-prp9), which stripped the `noindex`
 * header as well.
 */
interface PrivatePrefix {
  prefix: string
  /** `/preview/<token>` carries a case-sensitive credential that must survive canonicalisation. */
  preserveRemainderCase: boolean
}

const PRIVATE_PREFIXES: PrivatePrefix[] = [
  { prefix: '/admin', preserveRemainderCase: false },
  { prefix: '/dashboard', preserveRemainderCase: false },
  { prefix: '/login', preserveRemainderCase: false },
  { prefix: '/checkout', preserveRemainderCase: false },
  { prefix: '/preview', preserveRemainderCase: true },
]

/**
 * The canonical form of a private path, or `null` when the path is already canonical or is not a
 * private route at all. Never returns its own input, so it cannot produce a redirect loop.
 */
export function canonicalPrivatePath(pathname: string): string | null {
  const lowered = pathname.toLowerCase()

  for (const { prefix, preserveRemainderCase } of PRIVATE_PREFIXES) {
    // Whole-segment match only: `/administration` is a different route from `/admin`.
    if (lowered !== prefix && !lowered.startsWith(`${prefix}/`)) {
      continue
    }

    const canonical = preserveRemainderCase
      ? prefix + pathname.slice(prefix.length)
      : lowered

    return canonical === pathname ? null : canonical
  }

  return null
}
