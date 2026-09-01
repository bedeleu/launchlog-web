<script setup lang="ts">
import { extractHttpStatus } from '#shared/utils/listing-http-status'
import type { EditionPage } from '#shared/types/editions'
import { normalizeEditionPage } from '~/composables/useEditions'

const route = useRoute()
const config = useRuntimeConfig()
const client = useEditions()
const newsletterClient = useNewsletter()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`

const newsletterCapabilityRequest = useAsyncData(
  'newsletter-capability:shipped-archive',
  () => newsletterClient.capability(),
)

const requestedPage = computed(() => {
  try {
    return normalizeEditionPage(route.query.page)
  }
  catch {
    return null
  }
})

const { data: archive, error, status, refresh } = await useAsyncData<EditionPage>(
  () => `edition-archive:${String(requestedPage.value)}`,
  async () => {
    if (requestedPage.value === null) {
      throw createError({ statusCode: 404, statusMessage: 'Edition page not found' })
    }

    return client.fetchArchive(requestedPage.value)
  },
  { watch: [requestedPage] },
)
const { data: newsletterEnabled } = await newsletterCapabilityRequest

const responseStatus = computed(() => extractHttpStatus(error.value))

if (responseStatus.value === 404) {
  if (import.meta.server && useRequestEvent()) {
    useResponseHeader('X-Robots-Tag').value = 'noindex, nofollow'
  }
  throw createError({ statusCode: 404, statusMessage: 'Edition page not found' })
}

if (import.meta.server && error.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, 503)
}

watch(error, (cause) => {
  if (cause && extractHttpStatus(cause) === 404) {
    showError(createError({ statusCode: 404, statusMessage: 'Edition page not found' }))
  }
})

const meta = computed(() => archive.value?.meta ?? {
  current_page: requestedPage.value ?? 1,
  last_page: 1,
  per_page: 24 as const,
  total: 0,
})
const pagePath = (page: number) => page <= 1 ? '/shipped' : `/shipped?page=${page}`
const canonicalUrl = computed(() => `${siteUrl}${pagePath(meta.value.current_page)}`)
const pageTitle = computed(() => meta.value.current_page > 1
  ? `What just shipped — Page ${meta.value.current_page} | LaunchLog`
  : 'What just shipped | LaunchLog')
const pageDescription = computed(() => meta.value.current_page > 1
  ? `The LaunchLog weekly release archive, page ${meta.value.current_page} of ${meta.value.last_page}.`
  : 'Truthful weekly editions curated from published releases on LaunchLog.')

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogUrl: canonicalUrl,
})

useHead(() => ({
  link: [
    { rel: 'canonical' as const, href: canonicalUrl.value },
    ...(meta.value.current_page > 1
      ? [{ rel: 'prev' as const, href: `${siteUrl}${pagePath(meta.value.current_page - 1)}` }]
      : []),
    ...(meta.value.current_page < meta.value.last_page
      ? [{ rel: 'next' as const, href: `${siteUrl}${pagePath(meta.value.current_page + 1)}` }]
      : []),
  ],
}))

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Shipped', path: '/shipped' },
])
</script>

<template>
  <ReleaseShell
    :eyebrow="`Weekly release archive${meta.current_page > 1 ? ` · Page ${meta.current_page}` : ''}`"
    title="What just shipped"
    description="A permanent week-by-week record of products published on LaunchLog. No ranking theatre; just the releases and their evidence."
  >
    <DiscoveryRetryCard
      v-if="error"
      title="The weekly log is temporarily unavailable"
      message="We could not load the complete record. Retry in a moment."
      :pending="status === 'pending'"
      @retry="refresh"
    />

    <template v-else-if="archive">
      <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-release-seam pb-4 font-mono text-[0.68rem] font-semibold tracking-[0.14em] text-release-paper-muted uppercase">
        <span>{{ meta.total }} published {{ meta.total === 1 ? 'edition' : 'editions' }}</span>
        <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
      </div>

      <section v-if="archive.data.length" class="border-t border-release-seam" aria-label="Published weekly editions">
        <EditionSummary
          v-for="summary in archive.data"
          :key="summary.slug"
          :summary="summary"
        />
      </section>

      <div v-else class="border border-release-seam bg-release-rail px-6 py-16 text-center">
        <p class="text-lg font-medium text-[#f6f1e7]">The first weekly edition is being prepared</p>
        <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-release-paper-muted">
          Published releases stay available in the directory while the weekly archive begins.
        </p>
      </div>

      <nav v-if="meta.last_page > 1" class="mt-8 flex items-center justify-between border-t border-release-seam pt-6" aria-label="Edition pages">
        <NuxtLink
          v-if="meta.current_page > 1"
          :to="pagePath(meta.current_page - 1)"
          rel="prev"
          class="release-action-secondary"
        >
          Previous
        </NuxtLink>
        <span v-else aria-hidden="true" />

        <NuxtLink
          v-if="meta.current_page < meta.last_page"
          :to="pagePath(meta.current_page + 1)"
          rel="next"
          class="release-action-secondary"
        >
          Next
        </NuxtLink>
      </nav>
    </template>

    <NewsletterCapture
      v-if="newsletterEnabled === true"
      class="mt-10"
      source="shipped_archive"
    />
  </ReleaseShell>
</template>
