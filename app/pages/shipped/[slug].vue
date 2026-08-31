<script setup lang="ts">
import { extractHttpStatus } from '#shared/utils/listing-http-status'
import type { EditionDetail } from '#shared/types/editions'
import { buildEditionSchema } from '~/utils/edition-schema'
import { serializeJsonLd } from '~/utils/json-ld'

const route = useRoute()
const config = useRuntimeConfig()
const client = useEditions()
const slug = computed(() => String(route.params.slug ?? ''))
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`

const { data: edition, error, status, refresh } = await useAsyncData<EditionDetail>(
  () => `edition-detail:${slug.value}`,
  () => client.fetchDetail(slug.value),
  { watch: [slug] },
)

const responseStatus = computed(() => extractHttpStatus(error.value))

if (responseStatus.value === 404) {
  if (import.meta.server && useRequestEvent()) {
    useResponseHeader('X-Robots-Tag').value = 'noindex, nofollow'
  }
  throw createError({ statusCode: 404, statusMessage: 'Edition not found' })
}

if (import.meta.server && error.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, 503)
}

watch(error, (cause) => {
  if (cause && extractHttpStatus(cause) === 404) {
    showError(createError({ statusCode: 404, statusMessage: 'Edition not found' }))
  }
})

const canonicalUrl = computed(() => `${siteUrl}/shipped/${slug.value}`)
const pageTitle = computed(() => edition.value
  ? `${edition.value.slug} — What shipped | LaunchLog`
  : 'Weekly edition | LaunchLog')
const pageDescription = computed(() => edition.value?.introduction
  ?? `The frozen weekly LaunchLog record for ${slug.value}.`)
const schema = computed(() => edition.value
  ? buildEditionSchema(edition.value, siteUrl)
  : null)
const publishedLabel = computed(() => {
  if (!edition.value) return ''

  const publishedAt = new Date(edition.value.published_at)
  if (Number.isNaN(publishedAt.getTime())) return edition.value.published_at

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(publishedAt)
})

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogUrl: canonicalUrl,
})

useHead(() => ({
  link: [{ rel: 'canonical' as const, href: canonicalUrl.value }],
  script: schema.value
    ? [{
        key: 'launchlog-edition-schema',
        type: 'application/ld+json',
        innerHTML: serializeJsonLd(schema.value),
      }]
    : [],
}))
</script>

<template>
  <ReleaseShell
    :eyebrow="`Weekly release · ${slug}`"
    title="What shipped this week"
    :description="edition?.introduction ?? 'A frozen weekly record of published releases and their evidence.'"
  >
    <DiscoveryRetryCard
      v-if="error"
      title="This edition is temporarily unavailable"
      message="We could not load the complete weekly record. Retry in a moment."
      :pending="status === 'pending'"
      @retry="refresh"
    />

    <template v-else-if="edition">
      <div class="grid border-y border-release-seam sm:grid-cols-3">
        <div class="border-b border-release-seam px-4 py-4 sm:border-r sm:border-b-0">
          <p class="font-mono text-[0.62rem] font-semibold tracking-[0.14em] text-release-paper-muted uppercase">Week starts</p>
          <p class="mt-2 text-sm font-medium text-release-paper">{{ edition.week_starts_at }}</p>
        </div>
        <div class="border-b border-release-seam px-4 py-4 sm:border-r sm:border-b-0">
          <p class="font-mono text-[0.62rem] font-semibold tracking-[0.14em] text-release-paper-muted uppercase">Week ends</p>
          <p class="mt-2 text-sm font-medium text-release-paper">{{ edition.week_ends_at }}</p>
        </div>
        <div class="px-4 py-4">
          <p class="font-mono text-[0.62rem] font-semibold tracking-[0.14em] text-release-paper-muted uppercase">Published</p>
          <p class="mt-2 text-sm font-medium text-release-paper">{{ publishedLabel }}</p>
        </div>
      </div>

      <section class="mt-8 border-t border-release-seam" aria-label="Edition items">
        <EditionItem
          v-for="item in edition.items"
          :key="`${item.kind}:${item.position}`"
          :item="item"
        />
      </section>

      <div class="mt-10 grid items-center gap-5 border-y border-release-seam py-7 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h2 class="text-xl font-semibold tracking-[-0.025em] text-[#f6f1e7]">Ship in the next record</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-release-paper-muted">
            Preview your product first. Nothing publishes until you approve the captured record.
          </p>
        </div>
        <NuxtLink
          :to="`/submit?source=edition&edition_slug=${encodeURIComponent(edition.slug)}`"
          class="release-action focus-visible:ring-release-focus"
        >
          Add your launch
        </NuxtLink>
      </div>
    </template>
  </ReleaseShell>
</template>
