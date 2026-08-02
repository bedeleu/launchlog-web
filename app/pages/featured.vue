<script setup lang="ts">
import { Sparkles } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { ListingPage } from '~/composables/useListings'

const route = useRoute()
const { listListingPage } = useListings()
const activePage = computed(() => {
  const page = Number(route.query.page || 1)
  return Number.isInteger(page) && page > 0 ? page : 1
})

const { data: pageData, error: pageError, refresh } = await useAsyncData<ListingPage>(
  () => `featured-listings-${activePage.value}`,
  () => listListingPage({ tier: 'featured', sort: 'priority', per_page: 24, page: activePage.value }),
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

const pageHref = (page: number) => page > 1 ? `/featured?page=${page}` : '/featured'

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const ogImageUrl = `${siteUrl}/og-image.jpg`
const pageUrl = computed(() => `${siteUrl}${pageHref(activePage.value)}`)

useSeoMeta({
  title: 'Featured products — LaunchLog',
  description: 'Featured products on LaunchLog — premium placement for standout launches.',
  ogTitle: 'Featured products — LaunchLog',
  ogDescription: 'Featured products on LaunchLog — premium placement for standout launches.',
  ogUrl: pageUrl,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: 'Featured products — LaunchLog',
  twitterDescription: 'Featured products on LaunchLog — premium placement for standout launches.',
  twitterImage: ogImageUrl,
})

useHead(() => ({
  link: [
    { rel: 'canonical', href: pageUrl.value },
    ...(activePage.value > 1
      ? [{ rel: 'prev', href: `${siteUrl}${pageHref(activePage.value - 1)}` }]
      : []),
    ...(activePage.value < meta.value.last_page
      ? [{ rel: 'next', href: `${siteUrl}${pageHref(activePage.value + 1)}` }]
      : []),
  ],
}))

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Featured', path: '/featured' },
])
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-12 lg:py-16">
    <header class="max-w-2xl">
      <span class="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/50 bg-brand-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-accent shadow-[0_0_24px_rgba(99,102,241,0.25)]">
        <Sparkles class="size-3.5" />
        Featured
      </span>
      <h1 class="mt-4 text-4xl font-bold tracking-tight text-brand-fg lg:text-5xl">
        Featured products
      </h1>
      <p class="mt-3 text-lg text-brand-muted">
        Premium placement for standout launches across LaunchLog browse and category surfaces.
      </p>
    </header>

    <div v-if="pageError" class="mt-16 rounded-2xl border border-red-400/20 bg-red-400/[0.05] py-16 text-center">
      <p class="text-lg font-medium text-brand-fg">Featured products are temporarily unavailable</p>
      <p class="mx-auto mt-2 max-w-sm text-brand-muted">The directory could not be loaded. Please try again.</p>
      <Button class="mt-6" variant="outline" @click="() => refresh()">Try again</Button>
    </div>

    <template v-else-if="listings.length">
      <div class="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-muted">
        <span>Showing {{ meta.from }}–{{ meta.to }} of {{ meta.total }} featured products</span>
        <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
      </div>
      <div class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <ListingTile v-for="listing in listings" :key="listing.slug" :listing="listing" />
      </div>
      <nav v-if="meta.last_page > 1" class="mt-10 flex justify-center gap-2" aria-label="Featured products pagination">
        <Button v-if="meta.current_page <= 1" variant="outline" disabled>
          Previous
        </Button>
        <Button v-else as-child variant="outline">
          <NuxtLink :to="pageHref(meta.current_page - 1)" rel="prev">Previous</NuxtLink>
        </Button>
        <Button v-if="meta.current_page >= meta.last_page" variant="outline" disabled>
          Next
        </Button>
        <Button v-else as-child variant="outline">
          <NuxtLink :to="pageHref(meta.current_page + 1)" rel="next">Next</NuxtLink>
        </Button>
      </nav>
    </template>

    <div v-else class="mt-16 rounded-2xl border border-brand-border bg-white/[0.02] py-20 text-center">
      <p class="text-lg font-medium text-brand-fg">
        No featured products yet
      </p>
      <p class="mx-auto mt-2 max-w-sm text-brand-muted">
        Be the first to claim a featured spot.
      </p>
      <NuxtLink
        to="/pricing"
        class="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        View pricing
      </NuxtLink>
    </div>
  </main>
</template>
