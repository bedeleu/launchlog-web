// Nitro/Nuxt SSR page routes don't handle bare HEAD requests and fall through
// to a 404, even though the same URL returns 200 on GET. Many link/backlink
// validators (e.g. directory badge checkers like DeepLaunch.io) issue a HEAD
// preflight and treat the 404 as "site unreachable" / "unexpected error".
//
// Normalizing HEAD -> GET makes the SSR renderer produce the page and reply
// 200 with the correct headers; the HTTP client discards the body for HEAD.
export default defineEventHandler((event) => {
  if (event.node.req.method === 'HEAD') {
    event.node.req.method = 'GET'
  }
})
