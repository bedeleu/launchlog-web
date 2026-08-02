<script setup lang="ts">
import {
  Check,
  Code2,
  ExternalLink,
  FileJson2,
  FileText,
  Globe,
  ImageOff,
  Layers,
  ListTree,
  Lock,
  Sparkles,
  Tag,
} from '@lucide/vue'
import { listingAbsenceStatus } from '#shared/utils/listing-http-status'
import type { ListingCard, ListingTier } from '~/composables/useListings'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))
const config = useRuntimeConfig()
const domain = config.public.domain as string

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

const formatDate = (iso?: string | null): string => {
  if (!iso) return 'Unknown'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const isSecure = computed(() => (listing.value?.url ?? '').startsWith('https'))

// Gracefully fall back to the placeholder when a screenshot_url 404s (file not
// on the CDN yet / stale snapshot) instead of rendering a broken-image glyph.
const heroShotFailed = ref(false)
const failedShots = ref(new Set<string>())

const descriptionParagraphs = computed<string[]>(() =>
  (listing.value?.description ?? '')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean),
)

const tierMeta: Record<ListingTier, { label: string, classes: string }> = {
  featured: {
    label: 'Featured',
    classes: 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent shadow-[0_0_24px_rgba(99,102,241,0.25)]',
  },
  premium: {
    label: 'Premium',
    classes: 'border-brand-border bg-white/[0.04] text-brand-fg',
  },
  basic: {
    label: 'Basic',
    classes: 'border-brand-border bg-transparent text-brand-muted',
  },
}
const tier = computed(() => tierMeta[(listing.value?.tier ?? 'basic') as ListingTier] ?? tierMeta.basic)

// AI Discovery — D-009 invisible tech edge. Reflects the real per-listing booleans
// alongside always-on platform surfaces.
const aiDiscovery = computed(() => {
  const l = listing.value
  return [
    {
      label: 'schema.org @graph',
      detail: 'Structured data emitted on this page',
      enabled: l?.has_schema_org ?? true,
    },
    {
      label: 'Markdown endpoint',
      detail: 'GET /listing/{slug} with Accept: text/markdown',
      enabled: l?.has_markdown_negotiation ?? true,
    },
    {
      label: 'Included in llms.txt surfaces',
      detail: 'Discoverable by ChatGPT, Perplexity, Claude, Gemini',
      enabled: l?.has_llms_txt ?? true,
    },
    {
      label: 'Sitemap + IndexNow submission',
      detail: 'Submitted to search engines on publish',
      enabled: true,
    },
  ]
})

// --- SEO + schema.org @graph (D-009) ---
const pageUrl = computed(() => `https://${domain}/listing/${slug.value}`)
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

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  robots: () => absenceStatus ? 'noindex, nofollow' : undefined,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  ogImage: () => listing.value?.screenshot_url ?? undefined,
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

const jsonLd = computed(() => {
  const l = listing.value
  if (!l) return null

  const orgNode = {
    '@type': 'Organization',
    '@id': `https://${domain}/#organization`,
    'name': 'LaunchLog',
    'url': `https://${domain}`,
  }

  const websiteNode = {
    '@type': 'WebSite',
    '@id': `https://${domain}/#website`,
    'name': 'LaunchLog',
    'url': `https://${domain}`,
    'publisher': { '@id': `https://${domain}/#organization` },
  }

  const productNode: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': `${pageUrl.value}#product`,
    'name': l.name,
    'url': l.url,
    'applicationCategory': l.category?.name ?? 'WebApplication',
    'description': l.description ?? l.tagline,
    'isPartOf': { '@id': `https://${domain}/#website` },
  }
  if (l.screenshot_url) productNode.image = l.screenshot_url
  if (l.tech_stack?.length) productNode.featureList = l.tech_stack
  if (l.pricing) {
    productNode.offers = {
      '@type': 'Offer',
      'price': l.pricing.low,
      'priceCurrency': l.pricing.currency,
      'url': l.url,
    }
  }

  const breadcrumbNode = {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl.value}#breadcrumb`,
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `https://${domain}` },
      { '@type': 'ListItem', 'position': 2, 'name': 'Browse', 'item': `https://${domain}/browse-all` },
      { '@type': 'ListItem', 'position': 3, 'name': l.name, 'item': pageUrl.value },
    ],
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [orgNode, websiteNode, productNode, breadcrumbNode],
  }
})

useHead({
  script: computed(() =>
    jsonLd.value
      ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd.value) }]
      : [],
  ),
})

const tierBadgeClass = (t?: ListingTier): string =>
  (tierMeta[(t ?? 'basic') as ListingTier] ?? tierMeta.basic).classes
const tierLabel = (t?: ListingTier): string =>
  (tierMeta[(t ?? 'basic') as ListingTier] ?? tierMeta.basic).label
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-12 lg:py-16">
    <!-- Not found -->
    <div v-if="error || !listing" class="py-20 text-center">
      <h1 class="text-3xl font-bold text-brand-fg">
        Listing not found
      </h1>
      <p class="mx-auto mt-3 max-w-md text-brand-muted">
        This listing may have been removed, or the link is incorrect.
      </p>
      <NuxtLink
        to="/browse-all"
        class="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        Browse all listings
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Breadcrumb -->
      <nav class="mb-8 flex flex-wrap items-center gap-1.5 text-sm text-brand-muted">
        <NuxtLink to="/" class="transition-colors hover:text-brand-fg">
          Home
        </NuxtLink>
        <span aria-hidden="true">/</span>
        <NuxtLink to="/browse-all" class="transition-colors hover:text-brand-fg">
          Browse
        </NuxtLink>
        <span aria-hidden="true">/</span>
        <span class="text-brand-fg">{{ listing.name }}</span>
      </nav>

      <!-- HERO -->
      <header class="max-w-3xl">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            :class="tier.classes"
          >
            <Sparkles v-if="listing.tier === 'featured'" class="size-3.5" />
            {{ tier.label }}
          </span>
          <!-- Founding listing marker (D-060) — origin, independent of billing tier -->
          <span
            v-if="listing.source === 'founding'"
            class="inline-flex items-center rounded-full border border-brand-border bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-fg/85"
          >
            Founding
          </span>
        </div>

        <h1 class="mt-4 text-4xl font-bold tracking-tight text-brand-fg lg:text-5xl">
          {{ listing.name }}
        </h1>
        <p class="mt-3 text-lg text-brand-muted">
          {{ listing.tagline }}
        </p>

        <div class="mt-5 flex flex-wrap items-center gap-3">
          <a
            :href="listing.url"
            target="_blank"
            rel="noopener nofollow"
            class="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Visit Website
            <ExternalLink class="size-4" />
          </a>
          <span class="inline-flex items-center gap-1.5 text-sm text-brand-muted">
            <Globe class="size-4" />
            {{ hostname(listing.url) }}
          </span>
        </div>
      </header>

      <!-- Screenshot — framed as a real browser viewport (reads as authentic product,
           not a floating AI image). Featured gets an accent ring + glow. -->
      <figure
        class="mt-8 overflow-hidden rounded-2xl border bg-[#0c1120] shadow-2xl shadow-black/40"
        :class="listing.tier === 'featured'
          ? 'border-brand-accent/40 ring-1 ring-brand-accent/20 shadow-[0_28px_70px_-16px_rgba(99,102,241,0.3)]'
          : 'border-brand-border'"
      >
        <div class="flex items-center gap-2 border-b border-brand-border bg-white/[0.03] px-4 py-2.5">
          <span class="size-2.5 rounded-full bg-white/15" />
          <span class="size-2.5 rounded-full bg-white/15" />
          <span class="size-2.5 rounded-full bg-white/15" />
          <div class="mx-auto flex max-w-full items-center gap-1.5 truncate rounded-md bg-black/30 px-3 py-1 text-xs text-brand-muted">
            <Globe class="size-3 shrink-0" />
            <span class="truncate">{{ hostname(listing.url) }}</span>
          </div>
        </div>
        <div class="aspect-[16/10] w-full bg-white/[0.02]">
          <img
            v-if="listing.screenshot_url && !heroShotFailed"
            :src="listing.screenshot_url"
            :alt="`${listing.name} screenshot`"
            class="size-full object-cover object-top"
            width="1280"
            height="800"
            @error="heroShotFailed = true"
          >
          <div
            v-else
            class="flex size-full flex-col items-center justify-center gap-2 text-brand-muted"
          >
            <ImageOff class="size-8" />
            <span class="text-sm">No screenshot available</span>
          </div>
        </div>
      </figure>

      <!-- Facts row -->
      <div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-brand-muted">
        <span>
          Listed since <span class="text-brand-fg">{{ formatDate(listing.published_at) }}</span>
        </span>
        <NuxtLink
          v-if="listing.category"
          :to="`/browse-all?category=${listing.category.slug}`"
          class="inline-flex items-center gap-1.5 transition-colors hover:text-brand-fg"
        >
          <Layers class="size-4" />
          {{ listing.category.name }}
        </NuxtLink>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-2 rounded-full bg-brand-success" />
          <span class="text-brand-success">Active</span>
        </span>
      </div>

      <!-- BODY: main + sidebar -->
      <div class="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <!-- MAIN COLUMN -->
        <div class="min-w-0 space-y-12">
          <!-- About (omit entirely if no description) -->
          <section v-if="descriptionParagraphs.length">
            <h2 class="text-xl font-semibold text-brand-fg">
              About {{ listing.name }}
            </h2>
            <div class="mt-4 space-y-4 text-brand-muted leading-relaxed">
              <p v-for="(para, i) in descriptionParagraphs" :key="i">
                {{ para }}
              </p>
            </div>
          </section>

          <!-- Built with -->
          <section v-if="listing.tech_stack.length">
            <h2 class="flex items-center gap-2 text-xl font-semibold text-brand-fg">
              <Code2 class="size-5 text-brand-muted" />
              Built with
            </h2>
            <ul class="mt-4 flex flex-wrap gap-2">
              <li
                v-for="tech in listing.tech_stack"
                :key="tech"
                class="rounded-md border border-brand-border bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-brand-fg"
              >
                {{ tech }}
              </li>
            </ul>
          </section>

          <!-- Tags -->
          <section v-if="listing.tags.length">
            <h2 class="flex items-center gap-2 text-xl font-semibold text-brand-fg">
              <Tag class="size-5 text-brand-muted" />
              Tags
            </h2>
            <ul class="mt-4 flex flex-wrap gap-2">
              <li v-for="t in listing.tags" :key="t.slug">
                <NuxtLink
                  :to="`/browse-all?tag=${t.slug}`"
                  class="inline-flex rounded-full border border-brand-border px-3 py-1 text-sm text-brand-muted transition-colors hover:border-brand-accent/50 hover:text-brand-fg"
                >
                  {{ t.name }}
                </NuxtLink>
              </li>
            </ul>
          </section>

          <!--
            Key Features / Use Cases intentionally omitted: the data model has no
            structured fields for these yet. Rendered only if present (they aren't),
            never fabricated.
            TODO: features/use_cases come from Phase 2 AI enrichment.
          -->

          <!-- AI Discovery (D-009 differentiator) -->
          <section>
            <h2 class="flex items-center gap-2 text-xl font-semibold text-brand-fg">
              <Sparkles class="size-5 text-brand-accent" />
              AI Discovery
            </h2>
            <p class="mt-2 text-sm text-brand-muted">
              Engineered to be read, indexed, and cited by search engines and AI assistants.
            </p>
            <ul class="mt-5 grid gap-3 sm:grid-cols-2">
              <li
                v-for="item in aiDiscovery"
                :key="item.label"
                class="flex items-start gap-3 rounded-xl border border-brand-border bg-white/[0.02] p-4"
                :class="item.enabled ? '' : 'opacity-50'"
              >
                <span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-accent/10">
                  <Check class="size-3.5 text-brand-accent" />
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-brand-fg">{{ item.label }}</span>
                  <span class="mt-0.5 block text-xs text-brand-muted">{{ item.detail }}</span>
                </span>
              </li>
            </ul>
          </section>
        </div>

        <!-- SIDEBAR -->
        <aside class="lg:sticky lg:top-8">
          <div class="rounded-2xl border border-brand-border bg-white/[0.02] p-6">
            <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
              Site info
            </h2>
            <dl class="mt-5 space-y-4 text-sm">
              <div class="flex items-center justify-between gap-3">
                <dt class="inline-flex items-center gap-2 text-brand-muted">
                  <Globe class="size-4" /> Domain
                </dt>
                <dd class="truncate text-right text-brand-fg">
                  {{ hostname(listing.url) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="inline-flex items-center gap-2 text-brand-muted">
                  <Lock class="size-4" /> SSL
                </dt>
                <dd class="text-right" :class="isSecure ? 'text-brand-success' : 'text-brand-warning'">
                  {{ isSecure ? 'Secure' : 'Not secure' }}
                </dd>
              </div>
              <div v-if="listing.category" class="flex items-center justify-between gap-3">
                <dt class="inline-flex items-center gap-2 text-brand-muted">
                  <Layers class="size-4" /> Category
                </dt>
                <dd class="text-right">
                  <NuxtLink
                    :to="`/browse-all?category=${listing.category.slug}`"
                    class="text-brand-fg transition-colors hover:text-brand-accent"
                  >
                    {{ listing.category.name }}
                  </NuxtLink>
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="inline-flex items-center gap-2 text-brand-muted">
                  <Layers class="size-4" /> Tier
                </dt>
                <dd class="text-right">
                  <span
                    class="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider"
                    :class="tier.classes"
                  >
                    {{ tier.label }}
                  </span>
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="inline-flex items-center gap-2 text-brand-muted">
                  <ListTree class="size-4" /> Listed since
                </dt>
                <dd class="text-right text-brand-fg">
                  {{ formatDate(listing.published_at) }}
                </dd>
              </div>
            </dl>

            <a
              :href="listing.url"
              target="_blank"
              rel="noopener nofollow"
              class="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Visit Site
              <ExternalLink class="size-4" />
            </a>
          </div>

          <!-- Tech edge mini-card -->
          <div class="mt-4 rounded-2xl border border-brand-accent/20 bg-brand-accent/[0.04] p-5">
            <p class="flex items-center gap-2 text-sm font-medium text-brand-fg">
              <FileJson2 class="size-4 text-brand-accent" />
              schema.org
              <span class="text-brand-muted">·</span>
              <FileText class="size-4 text-brand-accent" />
              markdown
            </p>
            <p class="mt-2 text-xs text-brand-muted">
              This listing ships structured data and a markdown endpoint so AI assistants can cite it accurately.
            </p>
          </div>
        </aside>
      </div>

      <!-- RELATED -->
      <section v-if="related.length" class="mt-20">
        <h2 class="text-xl font-semibold text-brand-fg">
          Related listings
        </h2>
        <div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="item in related"
            :key="item.slug"
            :to="`/listing/${item.slug}`"
            class="group flex flex-col overflow-hidden rounded-xl border border-brand-border bg-white/[0.02] transition-colors hover:border-brand-accent/40"
          >
            <div class="aspect-[16/10] w-full overflow-hidden bg-white/[0.03]">
              <img
                v-if="item.screenshot_url && !failedShots.has(item.slug)"
                :src="item.screenshot_url"
                :alt="`${item.name} screenshot`"
                loading="lazy"
                class="size-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                width="640"
                height="400"
                @error="failedShots.add(item.slug)"
              >
              <div v-else class="flex size-full items-center justify-center text-brand-muted">
                <ImageOff class="size-6" />
              </div>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
              <div class="flex items-center justify-between gap-2">
                <span class="truncate font-medium text-brand-fg">{{ item.name }}</span>
                <span
                  class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  :class="tierBadgeClass(item.tier)"
                >
                  {{ tierLabel(item.tier) }}
                </span>
              </div>
              <p class="line-clamp-2 text-sm text-brand-muted">
                {{ item.tagline }}
              </p>
            </div>
          </NuxtLink>
        </div>
      </section>
    </template>
  </main>
</template>
