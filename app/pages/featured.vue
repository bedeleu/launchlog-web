<script setup lang="ts">
import { Sparkles } from '@lucide/vue'
import type { ListingCard } from '~/composables/useListings'

const { listListings } = useListings()

const { data: listings } = await useAsyncData<ListingCard[]>(
  'featured-listings',
  () => listListings({ tier: 'featured' }),
  { default: () => [] },
)

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const ogImageUrl = `${siteUrl}/og-image.jpg`

useSeoMeta({
  title: 'Featured products — LaunchLog',
  description: 'Featured products on LaunchLog — premium placement for standout launches.',
  ogUrl: `${siteUrl}/featured`,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterImage: ogImageUrl,
})

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
        Premium placement for standout launches — top of every browse, surfaced first to humans and AI assistants alike.
      </p>
    </header>

    <!-- Grid -->
    <div
      v-if="listings && listings.length"
      class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <ListingTile
        v-for="listing in listings"
        :key="listing.slug"
        :listing="listing"
      />
    </div>

    <!-- Empty state -->
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
