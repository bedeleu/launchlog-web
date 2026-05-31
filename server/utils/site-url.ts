// server/utils/site-url.ts
// Single source of truth for the canonical public site URL across server routes.
// Auto-imported as a Nitro server util (no explicit import path needed).
export function getSiteUrl(): string {
  const config = useRuntimeConfig()
  const pub = config.public as { siteUrl?: string; domain?: string }
  if (pub.siteUrl) return String(pub.siteUrl).replace(/\/+$/, '')
  if (pub.domain) return `https://${pub.domain}`
  return 'https://launchlog.ai'
}
