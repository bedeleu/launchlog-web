<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { listingAbsenceStatus } from '#shared/utils/listing-http-status'
import type { ListingCard } from '~/composables/useListings'
import { listingProofDestinations } from '~/utils/customer-receipt'
import { serializeJsonLd } from '~/utils/json-ld'
import { buildListingSchema } from '~/utils/listing-schema'
import { releaseEdition } from '~/utils/release-edition'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))
const config = useRuntimeConfig()
const domain = config.public.domain as string
const siteUrl = `https://${domain}`

const { getListing, listListings } = useListings()

const { data: listing, error } = await useAsyncData(
  () => `listing-${slug.value}`,
  () => getListing(slug.value),
)

const absenceStatus = listingAbsenceStatus(error.value, listing.value)

if (absenceStatus) {
  const event = useRequestEvent()
  if (event) {
    setResponseStatus(event, absenceStatus)
    useResponseHeader('X-Robots-Tag').value = 'noindex, nofollow'
  }
}
else if (error.value) {
  throw error.value
}

// Related listings — non-blocking, fetched only when a category is present.
// Keyed by slug so it refetches on navigation between listings.
const { data: relatedRaw } = await useAsyncData<ListingCard[]>(
  () => `listing-related-${slug.value}`,
  async () => {
    const categorySlug = listing.value?.category?.slug
    if (!categorySlug) return []
    return listListings({ category: categorySlug })
  },
  { lazy: true, default: () => [], watch: [listing] },
)

const related = computed<ListingCard[]>(() =>
  (relatedRaw.value ?? [])
    .filter(l => l.slug !== listing.value?.slug)
    .slice(0, 6),
)

const hostname = (url?: string | null): string => {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  }
  catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  }
}

const isSecure = computed(() => (listing.value?.url ?? '').startsWith('https'))
const logoFailed = ref(false)

const socialLabel = (url: string): string => {
  const host = hostname(url)
  if (host === 'x.com' || host === 'twitter.com') return 'X'
  if (host === 'facebook.com') return 'Facebook'
  if (host === 'instagram.com') return 'Instagram'
  if (host === 'linkedin.com') return 'LinkedIn'
  if (host === 'tiktok.com') return 'TikTok'
  if (host === 'youtube.com' || host === 'youtu.be') return 'YouTube'
  if (host === 'github.com') return 'GitHub'
  return host
}

// Gracefully fall back to the blank cover when a screenshot_url 404s (file not
// on the CDN yet / stale snapshot) instead of rendering a broken-image glyph.
const heroShotFailed = ref(false)

const descriptionParagraphs = computed<string[]>(() =>
  (listing.value?.description ?? '')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean),
)

/** The placement word, exactly as the directory register prints it. */
const placementLabel = computed(() => listing.value?.tier === 'featured' ? 'Featured' : 'Standard')

/** The edition marker: the date LaunchLog listed the release, nothing inferred. */
const edition = computed(() => releaseEdition(listing.value?.published_at))

/**
 * The record's own facts, printed as a hairline register. Every value comes from
 * the API payload or from the listing URL — nothing here is a score, a rank or a
 * derived quality signal.
 */
const recordFacts = computed(() => {
  const l = listing.value
  if (!l) return []

  return [
    { label: 'Listed', value: edition.value || 'Unlisted' },
    { label: 'Placement', value: placementLabel.value },
    { label: 'Category', value: l.category?.name ?? 'Uncategorised' },
    { label: 'Connection', value: isSecure.value ? 'HTTPS' : 'HTTP' },
  ]
})

/**
 * The proof ledger. Four artifacts, four separately resolvable URLs — replacing
 * the four hardcoded check marks that named surfaces the page never linked and
 * could not verify from here.
 */
const proofDestinations = computed(() =>
  listing.value ? listingProofDestinations(siteUrl, listing.value.slug) : [])

// --- SEO + schema.org @graph (D-009) ---
const seoTitle = computed(() => {
  const l = listing.value
  if (!l) return 'Listing not found | LaunchLog'
  return `${l.name} — ${l.tagline} | LaunchLog`
})
const seoDescription = computed(() => {
  const l = listing.value
  if (!l) return undefined
  return l.description?.slice(0, 200) ?? l.tagline
})
const screenshotAlt = computed(() => {
  const l = listing.value
  return l?.screenshot_url ? `${l.name} website screenshot` : undefined
})

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  robots: () => absenceStatus ? 'noindex, nofollow' : undefined,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  ogImage: () => listing.value?.screenshot_url ?? undefined,
  ogImageAlt: () => screenshotAlt.value,
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value,
  twitterImage: () => listing.value?.screenshot_url ?? undefined,
  twitterImageAlt: () => screenshotAlt.value,
})

const jsonLd = computed(() => {
  const l = listing.value
  if (!l) return null
  return buildListingSchema(l, siteUrl)
})

useHead({
  script: computed(() =>
    jsonLd.value
      // serializeJsonLd escapes every `<`, so a listing name containing markup
      // cannot close the script tag early. The rest of the repo already emits
      // JSON-LD through this helper.
      ? [{ type: 'application/ld+json', innerHTML: serializeJsonLd(jsonLd.value) }]
      : [],
  ),
})
</script>

<template>
  <section class="mx-auto w-full max-w-[96rem] border-x border-release-seam bg-release-ink px-4 py-8 text-[#f6f1e7] sm:px-8 lg:px-12 lg:py-12">
    <!-- Absence. The two terminal states read differently on purpose: a
         withdrawn release was really here and is gone, while a 404 address never
         held one. Telling a 410 visitor their link is wrong is a false answer. -->
    <div v-if="absenceStatus === 410" class="mx-auto max-w-xl py-20 text-center">
      <p class="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-release-warning">
        Record 410 · withdrawn
      </p>
      <h1 class="mt-4 text-3xl font-semibold tracking-[-0.03em]">
        Release withdrawn
      </h1>
      <p class="mt-3 text-release-paper-muted">
        This release record was withdrawn and is no longer part of the public catalog.
      </p>
      <Button as-child class="mt-7" size="lg">
        <NuxtLink to="/browse-all">
          Browse the catalog
        </NuxtLink>
      </Button>
    </div>

    <div v-else-if="absenceStatus || error || !listing" class="mx-auto max-w-xl py-20 text-center">
      <p class="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-release-paper-muted">
        Record 404 · not found
      </p>
      <h1 class="mt-4 text-3xl font-semibold tracking-[-0.03em]">
        Release not found
      </h1>
      <p class="mt-3 text-release-paper-muted">
        No release is cataloged at this address. It may never have been published, or the link is incorrect.
      </p>
      <Button as-child class="mt-7" size="lg">
        <NuxtLink to="/browse-all">
          Browse the catalog
        </NuxtLink>
      </Button>
    </div>

    <template v-else>
      <nav class="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-release-paper-muted">
        <NuxtLink to="/" class="transition-colors hover:text-release-paper">
          Home
        </NuxtLink>
        <span aria-hidden="true">/</span>
        <NuxtLink to="/browse-all" class="transition-colors hover:text-release-paper">
          Browse
        </NuxtLink>
        <span aria-hidden="true">/</span>
        <span class="text-release-paper">{{ listing.name }}</span>
      </nav>

      <header class="max-w-4xl border-b border-release-seam pb-7">
        <p class="mb-3 flex flex-wrap items-center gap-x-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-release-blaze">
          <span>Release record</span>
          <span aria-hidden="true">·</span>
          <span>{{ placementLabel }}</span>
          <template v-if="listing.source === 'founding'">
            <span aria-hidden="true">·</span>
            <span>Founding</span>
          </template>
        </p>

        <div class="flex items-center gap-4">
          <img
            v-if="listing.logo_url && !logoFailed"
            :src="listing.logo_url"
            :alt="`${listing.name} logo`"
            class="size-14 shrink-0 border border-release-seam bg-release-rail object-contain p-1.5 sm:size-16"
            width="64"
            height="64"
            @error="logoFailed = true"
          >
          <h1 class="min-w-0 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl lg:text-5xl">
            {{ listing.name }}
          </h1>
        </div>
        <p class="mt-4 max-w-2xl text-base leading-7 text-release-paper-muted">
          {{ listing.tagline }}
        </p>

        <div class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button as-child size="lg">
            <a
              :href="listing.url"
              target="_blank"
              rel="noopener sponsored"
            >
              Visit website
              <ExternalLink class="size-4" aria-hidden="true" />
            </a>
          </Button>
          <span class="font-mono text-xs text-release-paper-muted">
            {{ hostname(listing.url) }}
          </span>
        </div>

        <nav v-if="listing.social_links?.length" aria-label="Social profiles" class="mt-5 flex flex-wrap gap-2">
          <a
            v-for="socialUrl in listing.social_links"
            :key="socialUrl"
            :href="socialUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 border border-release-seam px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-release-paper-muted transition-colors hover:border-release-paper-muted hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-2 focus-visible:ring-offset-release-ink"
          >
            {{ socialLabel(socialUrl) }}
            <ExternalLink class="size-3" aria-hidden="true" />
          </a>
        </nav>
      </header>

      <!-- The cover: the captured website in a rail-coloured mat, with the
           address printed on the caption ledger. No browser skeuomorphism. -->
      <figure class="mt-8 border border-release-seam bg-release-rail p-3 sm:p-4">
        <div class="relative aspect-[16/10] w-full overflow-hidden border border-release-seam bg-release-ink">
          <img
            v-if="listing.screenshot_url && !heroShotFailed"
            :src="listing.screenshot_url"
            :alt="`${listing.name} screenshot`"
            class="size-full object-cover object-top"
            width="1280"
            height="800"
            @error="heroShotFailed = true"
          >
          <div v-else class="relative grid size-full place-items-center px-8 text-center">
            <span aria-hidden="true" class="absolute inset-y-0 left-1/3 border-l border-dashed border-release-seam" />
            <span aria-hidden="true" class="absolute inset-y-0 right-1/3 border-r border-dashed border-release-seam" />
            <p class="max-w-sm font-mono text-xs uppercase tracking-[0.16em] text-release-paper-muted">
              Website capture unavailable
            </p>
          </div>
        </div>
        <figcaption class="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-release-paper-muted">
          <span>{{ hostname(listing.url) }}</span>
          <span v-if="edition">Captured for edition {{ edition }}</span>
        </figcaption>
      </figure>

      <!-- The record register: hairline cells whose separators are the seam. -->
      <dl class="mt-8 grid gap-px border border-release-seam bg-release-seam sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="fact in recordFacts" :key="fact.label" class="bg-release-ink px-4 py-3.5">
          <dt class="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-release-paper-muted">
            {{ fact.label }}
          </dt>
          <dd class="mt-1.5 font-mono text-sm text-release-paper">
            <NuxtLink
              v-if="fact.label === 'Category' && listing.category"
              :to="`/browse-all?category=${listing.category.slug}`"
              class="text-release-paper underline-offset-4 transition-colors hover:text-release-blaze hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-2 focus-visible:ring-offset-release-ink"
            >
              {{ fact.value }}
            </NuxtLink>
            <template v-else>
              {{ fact.value }}
            </template>
          </dd>
        </div>
      </dl>

      <div class="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        <div class="min-w-0 space-y-12">
          <section v-if="descriptionParagraphs.length">
            <h2 class="border-b border-release-seam pb-2.5 font-mono text-xs font-medium uppercase tracking-[0.22em] text-release-paper">
              About
            </h2>
            <div class="mt-5 space-y-4 text-base leading-7 text-release-paper-muted">
              <p v-for="(para, i) in descriptionParagraphs" :key="i">
                {{ para }}
              </p>
            </div>
          </section>

          <section v-if="listing.tech_stack.length">
            <h2 class="border-b border-release-seam pb-2.5 font-mono text-xs font-medium uppercase tracking-[0.22em] text-release-paper">
              Built with
            </h2>
            <ul class="mt-5 flex flex-wrap gap-2">
              <li
                v-for="tech in listing.tech_stack"
                :key="tech"
                class="border border-release-seam bg-release-rail px-2.5 py-1 font-mono text-xs text-release-paper"
              >
                {{ tech }}
              </li>
            </ul>
          </section>

          <section v-if="listing.tags.length">
            <h2 class="border-b border-release-seam pb-2.5 font-mono text-xs font-medium uppercase tracking-[0.22em] text-release-paper">
              Tags
            </h2>
            <ul class="mt-5 flex flex-wrap gap-2">
              <li v-for="t in listing.tags" :key="t.slug">
                <NuxtLink
                  :to="`/browse-all?tag=${t.slug}`"
                  class="inline-flex border border-release-seam px-3 py-1 font-mono text-xs text-release-paper-muted transition-colors hover:border-release-paper-muted hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-2 focus-visible:ring-offset-release-ink"
                >
                  {{ t.name }}
                </NuxtLink>
              </li>
            </ul>
          </section>

          <!-- The proof ledger (D-009). Each artifact is named for what it is and
               prints the address that serves it. -->
          <section>
            <h2 class="border-b border-release-seam pb-2.5 font-mono text-xs font-medium uppercase tracking-[0.22em] text-release-paper">
              Published record
            </h2>
            <p class="mt-4 max-w-prose text-sm leading-6 text-release-paper-muted">
              The facts on this page are served at four separate addresses, one per representation.
            </p>
            <div class="mt-4 divide-y divide-release-seam border-y border-release-seam">
              <ListingReceiptArtifact
                v-for="destination in proofDestinations"
                :key="destination.key"
                :destination="destination"
              />
            </div>
          </section>
        </div>

        <aside class="min-w-0 lg:sticky lg:top-24">
          <div class="border border-release-seam bg-release-rail">
            <div class="border-b border-release-seam px-5 py-4">
              <p class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-release-warning">
                Edition {{ edition || 'unlisted' }}
              </p>
              <h2 class="mt-2 text-lg font-semibold tracking-[-0.02em]">
                Visit {{ listing.name }}
              </h2>
              <p class="mt-2 text-sm leading-6 text-release-paper-muted">
                LaunchLog records the release; the product itself lives on its own site.
              </p>
            </div>
            <div class="space-y-4 p-5">
              <p class="break-all font-mono text-xs text-release-paper-muted">
                {{ hostname(listing.url) }}
              </p>
              <Button as-child class="w-full" size="lg">
                <a
                  :href="listing.url"
                  target="_blank"
                  rel="noopener sponsored"
                >
                  Visit site
                  <ExternalLink class="size-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <section v-if="related.length" class="mt-16">
        <h2 class="border-b border-release-seam pb-2.5 font-mono text-xs font-medium uppercase tracking-[0.22em] text-release-paper">
          Related releases
        </h2>
        <ListingGrid class="mt-7" :listings="related" mode="uniform" />
      </section>
    </template>
  </section>
</template>
