import { createEditionClient } from '../../../app/composables/useEditions'
import { collectEditionSitemapUrls } from '../../utils/edition-discovery'

export default defineSitemapEventHandler(async () => {
  const apiUrl = useRuntimeConfig().public.apiUrl as string
  const client = createEditionClient(
    $fetch as unknown as (url: string, options?: Record<string, unknown>) => Promise<unknown>,
    apiUrl,
  )

  return collectEditionSitemapUrls(page => client.fetchArchive(page))
})
