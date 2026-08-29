import { isIP } from 'node:net'
import type { FunnelEvent } from '../../app/utils/plausible-privacy'
import { FUNNEL_EVENTS } from '../../app/utils/plausible-privacy'
import { isMetaEventId, mapFunnelEventToMeta, normalizeMetaPixelId } from '../../app/utils/meta-pixel'

const API_VERSION_PATTERN = /^v\d{2}\.0$/
const TEST_EVENT_CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const META_COOKIE_PATTERN = /^fb\.1\.\d{10,16}\.[A-Za-z0-9._-]{1,450}$/

export interface MetaConversionsCapability {
  origin: 'https://launchlog.ai'
  pixelId: string
  accessToken: string
  apiVersion: string
  endpoint: string
  testEventCode: string | null
}

export interface MetaConversionInput {
  event: FunnelEvent
  eventId: string
  fbp?: string
  fbc?: string
}

interface MetaConversionContext {
  clientIpAddress: string
  clientUserAgent: string
  eventTime: number
}

export interface MetaConversionPayload {
  data: Array<{
    event_name: string
    event_time: number
    event_id: string
    event_source_url: string
    action_source: 'website'
    user_data: {
      client_ip_address: string
      client_user_agent: string
      fbp?: string
      fbc?: string
    }
  }>
  test_event_code?: string
}

export type MetaConversionsFetch = (
  input: string,
  init: RequestInit,
) => Promise<{ ok: boolean }>

const hasControlCharacters = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })

export const resolveMetaConversionsCapability = (input: {
  enabled: unknown
  domain: unknown
  pixelId: unknown
  accessToken: unknown
  apiVersion: unknown
  testEventCode?: unknown
}): MetaConversionsCapability | null => {
  const pixelId = normalizeMetaPixelId(input.pixelId)
  if (
    input.enabled !== true
    || input.domain !== 'launchlog.ai'
    || pixelId === null
    || typeof input.accessToken !== 'string'
    || input.accessToken.length < 20
    || input.accessToken.length > 500
    || /\s/.test(input.accessToken)
    || typeof input.apiVersion !== 'string'
    || !API_VERSION_PATTERN.test(input.apiVersion)
  ) return null

  const rawTestEventCode = input.testEventCode ?? ''
  if (
    typeof rawTestEventCode !== 'string'
    || (rawTestEventCode !== '' && !TEST_EVENT_CODE_PATTERN.test(rawTestEventCode))
  ) return null

  return {
    origin: 'https://launchlog.ai',
    pixelId,
    accessToken: input.accessToken,
    apiVersion: input.apiVersion,
    endpoint: `https://graph.facebook.com/${input.apiVersion}/${pixelId}/events`,
    testEventCode: rawTestEventCode || null,
  }
}

export const sanitizeMetaConversionInput = (input: unknown): MetaConversionInput | null => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null

  const record = input as Record<string, unknown>
  if (
    record.advertisingConsent !== true
    || typeof record.event !== 'string'
    || !(FUNNEL_EVENTS as readonly string[]).includes(record.event)
    || !isMetaEventId(record.eventId)
  ) return null

  if (record.fbp !== undefined && (typeof record.fbp !== 'string' || !META_COOKIE_PATTERN.test(record.fbp))) {
    return null
  }
  if (record.fbc !== undefined && (typeof record.fbc !== 'string' || !META_COOKIE_PATTERN.test(record.fbc))) {
    return null
  }

  return {
    event: record.event as FunnelEvent,
    eventId: record.eventId,
    ...(typeof record.fbp === 'string' ? { fbp: record.fbp } : {}),
    ...(typeof record.fbc === 'string' ? { fbc: record.fbc } : {}),
  }
}

export const buildMetaConversionPayload = (
  input: MetaConversionInput,
  capability: MetaConversionsCapability,
  context: MetaConversionContext,
): MetaConversionPayload => {
  if (
    isIP(context.clientIpAddress) === 0
    || context.clientUserAgent.length === 0
    || context.clientUserAgent.length > 512
    || hasControlCharacters(context.clientUserAgent)
    || !Number.isInteger(context.eventTime)
    || context.eventTime <= 0
  ) throw new Error('Invalid Meta conversion request context')

  const metaEvent = mapFunnelEventToMeta(input.event)
  const payload: MetaConversionPayload = {
    data: [{
      event_name: metaEvent.name,
      event_time: context.eventTime,
      event_id: input.eventId,
      event_source_url: `${capability.origin}/submit`,
      action_source: 'website',
      user_data: {
        client_ip_address: context.clientIpAddress,
        client_user_agent: context.clientUserAgent,
        ...(input.fbp ? { fbp: input.fbp } : {}),
        ...(input.fbc ? { fbc: input.fbc } : {}),
      },
    }],
  }

  if (capability.testEventCode) payload.test_event_code = capability.testEventCode
  return payload
}

export const postMetaConversion = async (
  payload: MetaConversionPayload,
  capability: MetaConversionsCapability,
  fetcher: MetaConversionsFetch,
): Promise<boolean> => {
  try {
    const response = await fetcher(capability.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${capability.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    })

    return response.ok
  }
  catch {
    return false
  }
}
