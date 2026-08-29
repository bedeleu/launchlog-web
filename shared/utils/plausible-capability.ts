export interface PlausibleCapability {
  origin: string
  endpoint: string
}

const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/
const EVENTS_PATH = '/api/event'

export const resolvePlausibleCapability = (input: {
  enabled: unknown
  domain: unknown
  endpoint: unknown
}): PlausibleCapability | null => {
  if (input.enabled !== true || typeof input.domain !== 'string' || typeof input.endpoint !== 'string') {
    return null
  }

  const domain = input.domain.toLowerCase()
  if (domain !== input.domain || !DOMAIN_PATTERN.test(domain)) return null

  let endpoint: URL
  try {
    endpoint = new URL(input.endpoint)
  }
  catch {
    return null
  }

  if (
    endpoint.protocol !== 'https:'
    || endpoint.hostname !== `plausible.${domain}`
    || endpoint.port
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
    || endpoint.pathname !== EVENTS_PATH
  ) {
    return null
  }

  return {
    origin: `https://${domain}`,
    endpoint: endpoint.href,
  }
}
