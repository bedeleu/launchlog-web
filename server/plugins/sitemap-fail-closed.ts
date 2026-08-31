import { createError, getRequestURL, getResponseStatus, setResponseHeader } from 'h3'
import type { SitemapRenderCtx, SitemapSourceInput, SitemapUrlInput } from '@nuxtjs/sitemap'
import { $fetch } from 'ofetch'
import { defineNitroPlugin } from 'nitropack/runtime/plugin'

type SitemapFetcher = (source: string, options?: { timeout?: number }) => Promise<unknown>

const OWNED_SOURCE_PREFIX = '/api/__sitemap__/'
const OWNED_SOURCE_TIMEOUT_MS = 5000
const SITEMAP_CACHE_CONTROL = 'public, max-age=0, s-maxage=600, stale-while-revalidate=600'

export const OWNED_SITEMAP_SOURCES = [
  '/api/__sitemap__/blog-urls',
  '/api/__sitemap__/listing-urls',
  '/api/__sitemap__/directory-pages',
] as const

export async function resolveOwnedSitemapSourcesOrThrow(
  sources: SitemapSourceInput[],
  fetcher: SitemapFetcher = source => $fetch(source, { timeout: OWNED_SOURCE_TIMEOUT_MS }),
): Promise<SitemapSourceInput[]> {
  try {
    return await Promise.all(sources.map(async (source) => {
      const ownedPath = ownedSourcePath(source)
      if (!ownedPath) return source

      const urls = parseSitemapUrlsOrThrow(await fetchOwnedSourceWithDeadline(fetcher, ownedPath))
      return {
        ...sourceMetadata(source),
        context: {
          ...sourceContext(source),
          source: ownedPath,
        },
        urls,
      } as unknown as SitemapSourceInput
    }))
  }
  catch {
    throw createError({ statusCode: 503, statusMessage: 'Sitemap temporarily unavailable' })
  }
}

export default defineNitroPlugin((nitroApp) => {
  const sitemapHooks = nitroApp.hooks as unknown as {
    hook: (name: 'sitemap:resolved', handler: (context: SitemapRenderCtx) => Promise<void>) => void
  }

  sitemapHooks.hook('sitemap:resolved', async (context) => {
    if (context.sitemapName !== 'sitemap.xml') return

    const eventFetcher = (context.event as unknown as { $fetch: SitemapFetcher }).$fetch
    const sources = await resolveOwnedSitemapSourcesOrThrow(
      [...OWNED_SITEMAP_SOURCES],
      (source, options) => eventFetcher(source, options),
    )
    context.urls.push(...embeddedSitemapUrls(sources) as unknown as typeof context.urls)
  })

  nitroApp.hooks.hook('beforeResponse', (event) => {
    if (getRequestURL(event).pathname !== '/sitemap.xml') return

    const status = getResponseStatus(event)
    if (status >= 200 && status < 300) {
      setResponseHeader(event, 'Cache-Control', SITEMAP_CACHE_CONTROL)
    }
  })
})

function ownedSourcePath(source: SitemapSourceInput): string | undefined {
  if (typeof source === 'string') {
    return isOwnedSourcePath(source) ? source : undefined
  }

  if (!isRecord(source) || 'urls' in source || source.sourceType !== 'user') return undefined
  return typeof source.fetch === 'string' && isOwnedSourcePath(source.fetch) ? source.fetch : undefined
}

function isOwnedSourcePath(source: string): boolean {
  return source.startsWith(OWNED_SOURCE_PREFIX)
}

function fetchOwnedSourceWithDeadline(fetcher: SitemapFetcher, source: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback: (value: unknown) => void, value: unknown) => {
      if (settled) return

      settled = true
      clearTimeout(timeout)
      callback(value)
    }
    const timeout = setTimeout(
      () => finish(reject, new TypeError('Sitemap source request timed out')),
      OWNED_SOURCE_TIMEOUT_MS,
    )

    try {
      Promise.resolve(fetcher(source, { timeout: OWNED_SOURCE_TIMEOUT_MS }))
        .then(value => finish(resolve, value), error => finish(reject, error))
    }
    catch (error) {
      finish(reject, error)
    }
  })
}

function parseSitemapUrlsOrThrow(payload: unknown): SitemapUrlInput[] {
  if (!Array.isArray(payload) || !payload.every(isSitemapUrlInput)) {
    throw new TypeError('Invalid sitemap source data')
  }

  return payload
}

function isSitemapUrlInput(value: unknown): value is SitemapUrlInput {
  if (typeof value === 'string') return value.trim().length > 0
  return isRecord(value) && typeof value.loc === 'string' && value.loc.trim().length > 0
}

function sourceMetadata(source: SitemapSourceInput): Record<string, unknown> {
  return isRecord(source) ? source : {}
}

function sourceContext(source: SitemapSourceInput): Record<string, unknown> {
  return isRecord(source) && isRecord(source.context) ? source.context : {}
}

function embeddedSitemapUrls(sources: SitemapSourceInput[]): SitemapUrlInput[] {
  return sources.flatMap(source =>
    typeof source === 'object' && source !== null && !Array.isArray(source) ? source.urls ?? [] : [],
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
