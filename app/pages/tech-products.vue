<script setup lang="ts">
import { Code2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { ListingPage } from '~/composables/useListings'
import { parseCanonicalPageParam } from '~/utils/pagination'

const route = useRoute()
const { listListingPage } = useListings()
const parsedPage = computed(() => parseCanonicalPageParam(route.query.page))
const activePage = computed(() => parsedPage.value ?? 1)

const { data: pageData, error: pageError, refresh } = await useAsyncData<ListingPage>(
  () => `tech-products-${activePage.value}`,
  // view=directory: the API plans this page's 30 visual slots and returns the
  // real records that fill them, so no per_page is sent.
  () => listListingPage({
    view: 'directory',
    kind: 'tech',
    sort: 'priority',
    page: activePage.value,
  }),
  {
    default: () => ({
      data: [],
      meta: { current_page: 1, from: null, last_page: 1, per_page: 24, to: null, total: 0 },
    }),
    watch: [activePage],
  },
)

const listings = computed(() => pageData.value?.data ?? [])
const meta = computed(() => pageData.value?.meta ?? {
  current_page: 1,
  from: null,
  last_page: 1,
  per_page: 24,
  to: null,
  total: 0,
})

const pageHref = (page: number) => page > 1 ? `/tech-products?page=${page}` : '/tech-products'

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const ogImageUrl = `${siteUrl}/og-image.jpg`
const pageUrl = computed(() => `${siteUrl}${pageHref(activePage.value)}`)
const pageOutOfRange = computed(() => !pageError.value && activePage.value > meta.value.last_page)
const pageTitle = computed(() => activePage.value > 1
  ? `Tech products — Page ${activePage.value} | LaunchLog`
  : 'Tech products | LaunchLog')
const pageDescription = computed(() => activePage.value > 1
  ? `Developer tools, DevOps, AI/ML, APIs, no-code and open-source launches. Page ${activePage.value} of ${meta.value.last_page}.`
  : 'Developer tools, DevOps, AI/ML, APIs, no-code, and open-source launches on LaunchLog.')

if (import.meta.server && pageOutOfRange.value) {
  const event = useRequestEvent()
  if (event) {
    setResponseStatus(event, 404)
    useResponseHeader('X-Robots-Tag').value = 'noindex, nofollow'
  }
}

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  robots: () => pageOutOfRange.value
    ? 'noindex, nofollow'
    : parsedPage.value === null
      ? 'noindex, follow'
      : undefined,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogUrl: pageUrl,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: ogImageUrl,
})

useHead(() => ({
  link: [
    { rel: 'canonical' as const, href: pageUrl.value },
    ...(parsedPage.value !== null && !pageOutOfRange.value && activePage.value > 1
      ? [{ rel: 'prev' as const, href: `${siteUrl}${pageHref(activePage.value - 1)}` }]
      : []),
    ...(parsedPage.value !== null && !pageOutOfRange.value && activePage.value < meta.value.last_page
      ? [{ rel: 'next' as const, href: `${siteUrl}${pageHref(activePage.value + 1)}` }]
      : []),
  ],
}))

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Tech products', path: '/tech-products' },
])
</script>

<template>
  <ReleaseShell
    eyebrow="Catalog · tech releases"
    title="Tech products"
    description="Developer tools, DevOps, AI/ML, APIs, no-code, and open-source — the launches builders care about."
  >
    <template #title>
      <span class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Code2 class="size-7 shrink-0 text-release-paper-muted" aria-hidden="true" />
        Tech products
      </span>
    </template>

    <div
      v-if="pageError"
      class="border border-release-destructive/40 bg-release-destructive/10 px-6 py-14 text-center"
    >
      <p class="text-lg font-medium text-[#f6f1e7]">
        Tech products are temporarily unavailable
      </p>
      <p class="mx-auto mt-2 max-w-sm text-release-paper-muted">
        The directory could not be loaded. Please try again.
      </p>
      <Button class="mt-6" variant="outline" @click="() => refresh()">
        Try again
      </Button>
    </div>

    <template v-else-if="listings.length">
      <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-release-seam pb-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-release-paper-muted">
        <span>Showing {{ meta.from }}–{{ meta.to }} of {{ meta.total }} tech products</span>
        <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
      </div>

      <!-- Mixed on every numeric page; a Basic-only page renders as the ordinary
           three-column grid on its own. -->
      <ListingGrid
        class="mt-7"
        :listings="listings"
        mode="mixed"
        heading-level="h2"
      />

      <ListingPagination
        :current-page="meta.current_page"
        :last-page="meta.last_page"
        :to="pageHref"
        label="Tech products pagination"
      />
    </template>

    <div v-else class="border border-release-seam bg-release-rail px-6 py-16 text-center">
      <p class="text-lg font-medium text-[#f6f1e7]">
        No tech products yet
      </p>
      <p class="mx-auto mt-2 max-w-sm text-release-paper-muted">
        Check back soon, or browse everything that just shipped.
      </p>
      <Button as-child class="mt-6" size="lg">
        <NuxtLink to="/browse-all">
          Browse all
        </NuxtLink>
      </Button>
    </div>
  </ReleaseShell>
</template>
