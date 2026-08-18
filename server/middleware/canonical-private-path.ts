// canonicalPrivatePath is auto-imported from server/utils/private-route-casing.ts (Nitro server utils).
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const canonical = canonicalPrivatePath(url.pathname)

  if (canonical === null) {
    return
  }

  // 301: the mis-cased URL is not a separate resource and must never accumulate its own signals.
  // Exact-case routing would otherwise answer 404 here; a redirect is kinder to the humans who
  // actually type these URLs, and is equally unambiguous for crawlers. The query string is
  // forwarded untouched so deep links keep working.
  return sendRedirect(event, `${canonical}${url.search}`, 301)
})
