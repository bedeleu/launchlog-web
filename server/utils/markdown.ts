// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const MARKDOWN = /([\\`*_[\]{}()#+!|>~-])/g
const ORDERED_LIST = /^(\s*\d+)\./gm
const SETEXT = /^( {0,3})=+/gm
const QUALITY_VALUE = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/
// eslint-disable-next-line no-control-regex
const UNSAFE_HTTPS_URL_CHARACTER = /[\s\u0000-\u001F\u007F-\u009F"'<>]/u

function clean(value: string): string {
  return value.normalize('NFC').replace(CONTROL, '').replace(/\r\n?/g, '\n')
}

function escapeHtml(value: string): string {
  return clean(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function escapeMarkdownText(value: string): string {
  return clean(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(MARKDOWN, '\\$1')
    .replace(ORDERED_LIST, '$1\\.')
    .replace(SETEXT, value => value.replaceAll('=', '\\='))
}

export function acceptsExplicitMarkdown(accept: string): boolean {
  const mediaRanges = splitHeaderValue(accept, ',')
  if (!mediaRanges) return false

  return mediaRanges.some((rawRange) => {
    const parts = splitHeaderValue(rawRange, ';')
    if (!parts) return false
    const [rawMediaType = '', ...parameters] = parts
    if (rawMediaType.trim().toLowerCase() !== 'text/markdown') return false

    let quality = 1
    let hasQuality = false

    for (const rawParameter of parameters) {
      const parameter = rawParameter.trim()
      const separator = parameter.indexOf('=')
      const name = (separator === -1 ? parameter : parameter.slice(0, separator)).trim().toLowerCase()
      if (name !== 'q') continue
      if (hasQuality || separator === -1) return false

      const value = parameter.slice(separator + 1).trim()
      if (!QUALITY_VALUE.test(value)) return false
      quality = Number(value)
      hasQuality = true
    }

    return quality > 0
  })
}

function splitHeaderValue(value: string, delimiter: ',' | ';'): string[] | null {
  const parts: string[] = []
  let start = 0
  let quoted = false
  let escaped = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (quoted && character === '\\') {
      escaped = true
      continue
    }
    if (character === '"') {
      quoted = !quoted
      continue
    }
    if (!quoted && character === delimiter) {
      parts.push(value.slice(start, index))
      start = index + 1
    }
  }

  if (quoted || escaped) return null
  parts.push(value.slice(start))
  return parts
}

export function parseSafeHttpsUrl(rawUrl: unknown): URL | null {
  if (typeof rawUrl !== 'string' || UNSAFE_HTTPS_URL_CHARACTER.test(rawUrl)) return null

  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return null
    return url
  }
  catch {
    return null
  }
}

export function renderSafeHttpsLink(
  label: string,
  rawUrl: string,
  provenance: 'paid' | 'editorial',
): string {
  const url = parseSafeHttpsUrl(rawUrl)
  if (!url) throw new TypeError('Unsafe HTTPS URL')

  const serializedUrl = url.toString()
  const href = escapeHtml(
    rawUrl === serializedUrl.slice(0, -1) && serializedUrl.endsWith('/')
      ? rawUrl
      : serializedUrl,
  )
  const relation = provenance === 'paid' ? 'noopener sponsored' : 'noopener'
  return `<a href="${href}" rel="${relation}">${escapeHtml(label)}</a>`
}
