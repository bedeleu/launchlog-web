import sanitizeHtml from 'sanitize-html'

// Editorial HTML arrives from the external WordPress blog (blog.launchlog.ai) and is
// rendered with v-html on /blog/[slug], so it is untrusted input. Everything outside
// this allowlist is dropped; the tag text is kept so no editorial copy is lost.
const ALLOWED_TAGS = [
  'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'blockquote',
  'pre', 'code', 'a', 'img', 'figure', 'figcaption', 'br', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'iframe',
]

// The only third-party frame the blog embeds. Exact hostname match, https only —
// deliberately not a domain suffix match, so www.youtube.com.evil.test is rejected.
const ALLOWED_IFRAME_HOSTNAMES = ['www.youtube.com']

// Resolves WordPress's relative URLs against the blog origin. Returns undefined for
// anything unparsable so the caller drops the attribute instead of emitting garbage.
function absolutize(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined

  try {
    return new URL(value, baseUrl).toString()
  }
  catch {
    return undefined
  }
}

export function sanitizeWordPressHtml(html: string, baseUrl: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      // rel/loading/decoding are not accepted from the source; they are set below.
      a: ['href', 'title', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
      code: ['class'],
      iframe: ['src', 'title', 'width', 'height', 'loading', 'allow', 'allowfullscreen', 'frameborder', 'referrerpolicy'],
    },
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
      img: ['http', 'https'],
      iframe: ['https'],
    },
    allowedIframeHostnames: ALLOWED_IFRAME_HOSTNAMES,
    // sanitize-html only deletes a rejected iframe src, leaving an empty <iframe>.
    // Dropping the src-less frame is what actually removes a non-YouTube embed.
    exclusiveFilter: frame => frame.tag === 'iframe' && !frame.attribs.src,
    transformTags: {
      // transformTags runs before scheme validation, so a resolved-but-unsafe URL
      // (javascript:, data:, ...) is still rejected by allowedSchemesByTag afterwards.
      a: (tagName, attribs) => {
        const href = absolutize(attribs.href, baseUrl)
        const next: Record<string, string> = { ...attribs, rel: 'noopener noreferrer' }

        if (href) next.href = href
        else delete next.href

        return { tagName, attribs: next }
      },
      img: (tagName, attribs) => {
        const src = absolutize(attribs.src, baseUrl)
        const next: Record<string, string> = { ...attribs, loading: 'lazy', decoding: 'async' }

        if (src) next.src = src
        else delete next.src

        return { tagName, attribs: next }
      },
    },
  })
}
