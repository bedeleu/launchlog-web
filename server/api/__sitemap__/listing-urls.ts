import { toListingSitemapEntries, type DiscoveryListing } from '../../utils/discovery'

export default defineSitemapEventHandler(async () => {
  const config = useRuntimeConfig()
  const site = getSiteUrl()

  try {
    const response = await $fetch<{ data: DiscoveryListing[] }>(`${config.public.apiUrl}/api/v1/discovery/listings`, {
      timeout: 5000,
    })

    return toListingSitemapEntries(response.data ?? [], site)
  } catch {
    return []
  }
})
