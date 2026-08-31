import { parseDiscoveryListingsOrThrow, toListingSitemapEntries } from '../../utils/discovery'

export default defineSitemapEventHandler(async () => {
  const config = useRuntimeConfig()
  const site = getSiteUrl()

  const response = await $fetch<unknown>(`${config.public.apiUrl}/api/v1/discovery/listings`, {
    timeout: 5000,
  })

  if (!isRecord(response) || !Object.hasOwn(response, 'data')) {
    throw new TypeError('Invalid discovery listing response')
  }

  return toListingSitemapEntries(parseDiscoveryListingsOrThrow(response.data), site)
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
