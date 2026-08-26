<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/seo-guide`
const updated = 'August 26, 2026'
const description
  = 'A practical 2026 guide to making SaaS launch pages crawlable, indexable, useful and machine-readable without relying on unsupported AEO or GEO hacks.'

const pillars = [
  {
    n: '01',
    title: 'Visible facts + matching schema',
    body: 'Every listing presents the product facts in visible HTML and emits matching schema.org JSON-LD. Structured data describes the page; it does not guarantee ranking, indexing or an AI citation.',
  },
  {
    n: '02',
    title: 'Crawl and discovery signals',
    body: 'Published listings have canonical URLs, sitemap entries and IndexNow notifications. LaunchLog also maintains llms.txt for compatible non-Google consumers; Google states that it ignores this file.',
  },
  {
    n: '03',
    title: 'Consistent alternate output',
    body: 'A request with Accept: text/markdown returns the same listing facts in markdown from the canonical URL. It is an optional machine-readable representation, not a replacement for useful public HTML.',
  },
]

const technicalChecklist = [
  'Responsive pages with Core Web Vitals measured in field data',
  'HTTPS everywhere with a valid certificate',
  'Clean, canonical URLs (no duplicate-content traps)',
  'An XML sitemap that search engines can crawl',
  'Structured data (schema.org) on key pages',
  'Crawl and indexing issues monitored in Search Console and Bing Webmaster Tools',
]

const contentChecklist = [
  'A clear value proposition in the first sentence',
  'Specific use cases and the audience you serve',
  'Natural keywords — written for humans, not stuffed',
  'A descriptive title and meta description',
  'Descriptive alt text on screenshots and images',
  'Fresh, accurate information that you keep updated',
]

const discovery = [
  { title: 'Relevant directories', body: 'A dedicated listing can add durable product context and a discoverable link outside launch-day feeds. Relevance and factual quality matter more than submitting to every directory.' },
  { title: 'Content & community', body: 'Write, ship in public, and show up where your audience already is. Earned mentions compound over time.' },
  { title: 'Technical hygiene', body: 'Speed, structure and crawlability are the boring fundamentals that make everything else you do actually count.' },
]

const comparison = {
  generic: {
    label: 'A row in a generic directory',
    points: [
      'A link and a name in a long table',
      'Product facts spread across several destinations',
      'Little context after the launch-day feed moves on',
      'No alternate machine-readable representation',
    ],
  },
  launchlog: {
    label: 'A LaunchLog listing',
    points: [
      'A dedicated product page while the plan is active',
      'Visible facts + schema.org + markdown output',
      'Permanent placement while your plan is active',
      'Sitemap inclusion and IndexNow notification',
    ],
  },
}

const officialSources = [
  {
    label: 'Google: Optimizing for generative AI features',
    href: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide',
  },
  {
    label: 'Google: Pagination and incremental page loading',
    href: 'https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading',
  },
  {
    label: 'Google: Creating helpful, reliable, people-first content',
    href: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
  },
  {
    label: 'OpenAI: Overview of OpenAI crawlers',
    href: 'https://developers.openai.com/api/docs/bots',
  },
  {
    label: 'IndexNow: Protocol documentation',
    href: 'https://www.indexnow.org/documentation',
  },
  {
    label: 'web.dev: Build agent-friendly websites',
    href: 'https://web.dev/articles/ai-agent-site-ux',
  },
]

useSeoMeta({
  title: 'The 2026 SEO & AI Discovery Guide — LaunchLog',
  description,
  ogTitle: 'The 2026 SEO & AI Discovery Guide',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'article',
  ogImage: `${siteUrl}/og-image.jpg`,
  ogImageSecureUrl: `${siteUrl}/og-image.jpg`,
  twitterCard: 'summary_large_image',
  twitterTitle: 'The 2026 SEO & AI Discovery Guide',
  twitterDescription: description,
  twitterImage: `${siteUrl}/og-image.jpg`,
})

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'SEO Guide', path: '/seo-guide' },
])

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-seoguide-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: 'The 2026 SEO & AI Discovery Guide for SaaS Launches',
        description,
        url: pageUrl,
        inLanguage: 'en-US',
        datePublished: '2026-05-31',
        dateModified: '2026-08-26',
        author: {
          '@type': 'Person',
          name: 'Alexandru Bedeleu',
          url: `${siteUrl}/about`,
        },
        mainEntityOfPage: pageUrl,
        isPartOf: { '@id': `${siteUrl}/#website` },
        publisher: { '@id': `${siteUrl}/#organization` },
      }),
    },
  ],
})
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-14 md:py-20">
    <!-- Hero -->
    <section class="max-w-3xl">
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
        SEO Guide · {{ updated }}
      </p>
      <h1 class="mt-5 text-4xl font-bold leading-[1.1] tracking-normal text-white md:text-6xl">
        Make your launch useful, crawlable <span class="text-brand-accent">and machine-readable.</span>
      </h1>
      <p class="mt-6 text-lg leading-8 text-brand-muted">
        AI search starts with the same web fundamentals as search: useful public
        content, crawl access, correct indexing signals and a stable source of
        product facts. This guide separates those foundations from unsupported
        AEO and GEO shortcuts.
      </p>
    </section>

    <!-- The shift -->
    <section class="mt-16 grid gap-10 md:grid-cols-[0.7fr_1fr]">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
          The shift
        </p>
        <h2 class="mt-4 text-3xl font-bold tracking-normal text-white md:text-4xl">
          One public source, several kinds of readers.
        </h2>
      </div>
      <div class="space-y-6 leading-8 text-brand-muted">
        <p>
          A launch page may be read by a founder, a buyer, a search crawler or a
          user-triggered browser agent. Each system has its own discovery and
          selection rules, but all benefit from stable URLs and clear public facts.
        </p>
        <p>
          Keep the visible copy, canonical metadata, structured data and alternate
          representations consistent. That reduces ambiguity without pretending
          that markup can force a crawler to index or select the page.
        </p>
      </div>
    </section>

    <!-- The three pillars -->
    <section class="mt-16">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
          The tech edge
        </p>
        <h2 class="mt-4 text-3xl font-bold tracking-normal text-white md:text-4xl">
          Three things LaunchLog builds into every listing.
        </h2>
      </div>
      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <article
          v-for="pillar in pillars"
          :key="pillar.n"
          class="rounded-lg border border-brand-border bg-white/[0.03] p-6"
        >
          <p class="font-mono text-sm text-brand-accent">
            {{ pillar.n }}
          </p>
          <h3 class="mt-5 text-xl font-semibold text-white">
            {{ pillar.title }}
          </h3>
          <p class="mt-4 leading-7 text-brand-muted">
            {{ pillar.body }}
          </p>
        </article>
      </div>
    </section>

    <!-- Checklists -->
    <section class="mt-16">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
          Fundamentals
        </p>
        <h2 class="mt-4 text-3xl font-bold tracking-normal text-white md:text-4xl">
          The checklist that still wins.
        </h2>
        <p class="mt-4 leading-8 text-brand-muted">
          None of this is glamorous, and all of it compounds. Get these right
          before chasing anything clever.
        </p>
      </div>
      <div class="mt-8 grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-brand-border p-6">
          <h3 class="text-lg font-semibold text-white">
            Technical SEO
          </h3>
          <ul class="mt-5 space-y-3">
            <li
              v-for="item in technicalChecklist"
              :key="item"
              class="flex gap-3 leading-7 text-brand-muted"
            >
              <svg class="mt-1 size-4 shrink-0 text-brand-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>
        <div class="rounded-lg border border-brand-border p-6">
          <h3 class="text-lg font-semibold text-white">
            Content optimisation
          </h3>
          <ul class="mt-5 space-y-3">
            <li
              v-for="item in contentChecklist"
              :key="item"
              class="flex gap-3 leading-7 text-brand-muted"
            >
              <svg class="mt-1 size-4 shrink-0 text-brand-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Discovery methods -->
    <section class="mt-16">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
          Where listings fit
        </p>
        <h2 class="mt-4 text-3xl font-bold tracking-normal text-white md:text-4xl">
          Discovery is a portfolio, not a hack.
        </h2>
      </div>
      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <article
          v-for="method in discovery"
          :key="method.title"
          class="rounded-lg border border-brand-border bg-white/[0.03] p-6"
        >
          <h3 class="text-lg font-semibold text-white">
            {{ method.title }}
          </h3>
          <p class="mt-3 leading-7 text-brand-muted">
            {{ method.body }}
          </p>
        </article>
      </div>
    </section>

    <!-- Comparison -->
    <section class="mt-16">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
          The difference
        </p>
        <h2 class="mt-4 text-3xl font-bold tracking-normal text-white md:text-4xl">
          A page, not a row.
        </h2>
      </div>
      <div class="mt-8 grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-brand-border p-6">
          <p class="text-sm font-semibold text-brand-muted">
            {{ comparison.generic.label }}
          </p>
          <ul class="mt-5 space-y-3">
            <li
              v-for="point in comparison.generic.points"
              :key="point"
              class="flex gap-3 leading-7 text-brand-muted"
            >
              <svg class="mt-1 size-4 shrink-0 text-brand-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>{{ point }}</span>
            </li>
          </ul>
        </div>
        <div class="rounded-lg border border-brand-accent/40 bg-brand-accent/[0.06] p-6">
          <p class="text-sm font-semibold text-white">
            {{ comparison.launchlog.label }}
          </p>
          <ul class="mt-5 space-y-3">
            <li
              v-for="point in comparison.launchlog.points"
              :key="point"
              class="flex gap-3 leading-7 text-brand-fg/90"
            >
              <svg class="mt-1 size-4 shrink-0 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{{ point }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="mt-16 border-t border-brand-border pt-10">
      <div class="grid gap-8 md:grid-cols-[0.7fr_1fr]">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
            Primary references
          </p>
          <h2 class="mt-4 text-3xl font-bold tracking-normal text-white md:text-4xl">
            Check the source, not an AEO score.
          </h2>
        </div>
        <div>
          <p class="leading-8 text-brand-muted">
            This guide is maintained against first-party documentation. Search
            and crawler behavior changes, so these sources take precedence over
            any summary on this page.
          </p>
          <ul class="mt-6 space-y-3">
            <li v-for="source in officialSources" :key="source.href">
              <a
                :href="source.href"
                target="_blank"
                rel="noopener"
                class="font-medium text-brand-accent transition-colors hover:text-white hover:underline"
              >
                {{ source.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="mt-16 border-t border-brand-border pt-10">
      <div class="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 class="text-3xl font-bold tracking-normal text-white">
            See how your product would appear.
          </h2>
          <p class="mt-4 max-w-2xl leading-7 text-brand-muted">
            Paste your URL and get a free, private preview of a fully structured
            listing — schema, metadata and all. Pay only when you publish.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            to="/pricing"
            class="inline-flex rounded-md border border-brand-border px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.04]"
          >
            View pricing
          </NuxtLink>
          <NuxtLink
            to="/submit"
            class="inline-flex rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-accent/90"
          >
            Preview for free
          </NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>
