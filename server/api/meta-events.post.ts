import {
  buildMetaConversionPayload,
  postMetaConversion,
  resolveMetaConversionsCapability,
  sanitizeMetaConversionInput,
} from '../utils/meta-conversions'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')

  const config = useRuntimeConfig()
  const capability = resolveMetaConversionsCapability({
    enabled: config.metaConversionsEnabled,
    domain: config.public.domain,
    pixelId: config.metaPixelId,
    accessToken: config.metaConversionsAccessToken,
    apiVersion: config.metaGraphApiVersion,
    testEventCode: config.metaTestEventCode,
  })
  if (capability === null) {
    throw createError({ statusCode: 503, statusMessage: 'Advertising measurement unavailable' })
  }

  if (getRequestHeader(event, 'origin') !== capability.origin) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid request origin' })
  }

  const contentLength = Number.parseInt(getRequestHeader(event, 'content-length') ?? '0', 10)
  if (!Number.isFinite(contentLength) || contentLength > 2048) {
    throw createError({ statusCode: 413, statusMessage: 'Request too large' })
  }

  const input = sanitizeMetaConversionInput(await readBody(event))
  const clientIpAddress = getRequestIP(event, { xForwardedFor: true })
  const clientUserAgent = getRequestHeader(event, 'user-agent') ?? ''
  if (input === null || !clientIpAddress || !clientUserAgent) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid conversion event' })
  }

  let payload
  try {
    payload = buildMetaConversionPayload(input, capability, {
      clientIpAddress,
      clientUserAgent,
      eventTime: Math.floor(Date.now() / 1000),
    })
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid conversion context' })
  }

  const accepted = await postMetaConversion(payload, capability, fetch)
  if (!accepted) {
    throw createError({ statusCode: 502, statusMessage: 'Conversion provider rejected the event' })
  }

  setResponseStatus(event, 202)
  return { accepted: true }
})
