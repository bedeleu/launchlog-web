import {
  getRequestHeader,
  getRequestURL,
  getResponseHeader,
  getResponseStatus,
  removeResponseHeader,
  send,
  setResponseHeader,
  setResponseHeaders,
  setResponseStatus,
} from 'h3'
import { STATUS_CODES } from 'node:http'
import { defineNitroPlugin } from 'nitropack/runtime/plugin'
import { shouldDeindexErrorStatus } from '../../app/utils/error-indexing'
import { acceptsExplicitMarkdown } from '../utils/markdown'
import { resolveMarkdownRoute } from '../utils/markdown-route'

const DISCOVERY_PATH = /^(?:\/shipped(?:\/.*)?|\/category\/.*|\/launch-channels\/?|\/listing\/[^/]+(?:\/(?:markdown|schema))?\/?|\/llms(?:-full)?\.txt)$/

export function normalizeDiscoveryError(error: unknown): { statusCode: 404 | 410 | 503 } {
  const status = extractStatus(error)
  return { statusCode: status === 404 ? 404 : status === 410 ? 410 : 503 }
}

export function requiresPrivateErrorCache(pathname: string, status: number): boolean {
  return status >= 400 && DISCOVERY_PATH.test(pathname)
}

export default defineNitroPlugin((nitroApp) => {
  const originalOnError = nitroApp.h3App.options.onError
  nitroApp.h3App.options.onError = async (error, event) => {
    const { statusCode } = normalizeDiscoveryError(error)
    const pathname = getRequestURL(event).pathname

    if (requiresPrivateErrorCache(pathname, statusCode)) {
      nitroApp.captureError(error, { event, tags: ['request'] })
      await sendPrivateDiscoveryError(event, pathname, statusCode)
      return
    }

    return originalOnError?.(error, event)
  }

  nitroApp.hooks.hook('beforeResponse', (event) => {
    setPrivateDiscoveryErrorCache(event, getResponseStatus(event))
  })
})

async function sendPrivateDiscoveryError(
  event: Parameters<typeof getRequestURL>[0],
  pathname: string,
  status: number,
): Promise<void> {
  const acceptsMarkdown = acceptsExplicitMarkdown(getRequestHeader(event, 'accept') ?? '')
  const shouldDeindex = shouldDeindexErrorStatus(status) || isAlwaysNoindexArtifact(pathname)
  const artifact = renderDiscoveryError(pathname, status, acceptsMarkdown, shouldDeindex)

  if (/^\/listing\/[^/]+\/?$/.test(pathname)
    || (acceptsMarkdown && isEditionPath(pathname))) appendVaryAccept(event)
  removeResponseHeader(event, 'Content-Signal')
  removeResponseHeader(event, 'Content-Length')
  removeResponseHeader(event, 'X-Robots-Tag')
  setResponseStatus(event, status, STATUS_CODES[status] ?? 'Error')
  setResponseHeaders(event, {
    'Cache-Control': 'private, no-store',
    'Content-Type': artifact.contentType,
    ...(shouldDeindex ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "script-src 'none'; frame-ancestors 'none';",
  })
  await send(event, artifact.body)
}

function renderDiscoveryError(
  pathname: string,
  status: number,
  acceptsMarkdown: boolean,
  shouldDeindex: boolean,
): { contentType: string, body: string } {
  const error = status === 404
    ? 'Discovery resource not found'
    : status === 410
      ? 'Discovery resource withdrawn'
      : 'Discovery temporarily unavailable'

  const isEditionMarkdown = acceptsMarkdown && isEditionPath(pathname)
  const isMarkdown = /^\/listing\/[^/]+\/markdown\/?$/.test(pathname)
    || (acceptsMarkdown && /^\/listing\/[^/]+\/?$/.test(pathname))
    || isEditionMarkdown
  if (isMarkdown) {
    const body = isEditionMarkdown
      ? status === 404
        ? '# Not found\n'
        : status === 410
          ? '# Withdrawn\n'
          : '# Temporarily unavailable\n'
      : status === 404
        ? '# Listing not found\n\n> This listing does not exist.\n'
        : status === 410
          ? '# Listing withdrawn\n\n> This listing has been withdrawn and is no longer available.\n'
          : '# Listing temporarily unavailable\n\n> This listing cannot be loaded right now. Please try again later.\n'
    return { contentType: 'text/markdown; charset=utf-8', body }
  }

  if (/^\/llms(?:-full)?\.txt$/.test(pathname)) {
    const title = status === 404
      ? 'LaunchLog resource not found'
      : status === 410
        ? 'LaunchLog resource withdrawn'
        : 'LaunchLog temporarily unavailable'
    return {
      contentType: 'text/plain; charset=utf-8',
      body: `# ${title}\n\nThis machine-readable resource cannot be loaded.\n`,
    }
  }

  if (/^\/listing\/[^/]+\/schema\/?$/.test(pathname)) {
    return {
      contentType: 'application/ld+json; charset=utf-8',
      body: JSON.stringify({ status, error }),
    }
  }

  const title = status === 404
    ? 'LaunchLog page not found'
    : status === 410
      ? 'LaunchLog page withdrawn'
      : 'LaunchLog temporarily unavailable'
  return {
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
${shouldDeindex ? '  <meta name="robots" content="noindex,nofollow">\n' : ''}  <title>${title}</title>
  <style>
    :root{color-scheme:dark}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080907;color:#e8e0cf;font-family:Geist,Inter,ui-sans-serif,system-ui,sans-serif}
    main{width:min(42rem,calc(100% - 2rem));border:1px solid rgba(232,224,207,.18);border-left:2px solid #e44c3f;background:#11130f;padding:2rem}
    h1{margin:0;font-size:clamp(1.5rem,4vw,2.25rem);line-height:1.15}
    p{margin:1rem 0 0;color:#c9c0ae;line-height:1.6}
  </style>
</head>
<body><main><h1>${title}</h1><p>This page cannot be loaded.</p></main></body>
</html>`,
  }
}

function isAlwaysNoindexArtifact(pathname: string): boolean {
  return /^\/listing\/[^/]+\/(?:markdown|schema)\/?$/.test(pathname)
}

function isEditionPath(pathname: string): boolean {
  const route = resolveMarkdownRoute(pathname)
  return route?.kind === 'edition_archive' || route?.kind === 'edition_detail'
}

function appendVaryAccept(event: Parameters<typeof getRequestURL>[0]): void {
  const current = getResponseHeader(event, 'Vary')
  const values = String(current ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)

  if (values.some(value => value === '*' || value.toLowerCase() === 'accept')) return
  setResponseHeader(event, 'Vary', [...values, 'Accept'].join(', '))
}

function setPrivateDiscoveryErrorCache(
  event: Parameters<typeof getRequestURL>[0],
  status: number,
): void {
  const pathname = getRequestURL(event).pathname
  if (requiresPrivateErrorCache(pathname, status)) {
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
  }
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  const source = error as Record<string, unknown>
  const directStatus = source.statusCode ?? source.status
  if (typeof directStatus === 'number') return directStatus

  for (const key of ['response', 'data', 'cause', 'error']) {
    const nestedStatus = extractStatus(source[key])
    if (nestedStatus !== undefined) return nestedStatus
  }

  return undefined
}
