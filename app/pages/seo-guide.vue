<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/seo-guide`
const updated = 'May 31, 2026'
const description
  = 'A practical 2026 guide to getting your product discovered across Google and AI answer engines, with SEO fundamentals and a machine-readable launch checklist.'

const pillars = [
  {
    n: '01',
    title: 'Schema.org @graph',
    body: 'Every listing ships a connected JSON-LD @graph — Organization, WebSite, WebPage and Product nodes — so crawlers and LLMs understand what your product is, not just that a page exists.',
  },
  {
    n: '02',
    title: 'Dynamic llms.txt',
    body: 'LaunchLog generates llms.txt and llms-full.txt automatically, giving AI systems a clean, machine-readable map of the directory and your listing within it.',
  },
  {
    n: '03',
    title: 'Content-negotiated markdown',
    body: 'Request a listing with Accept: text/markdown and you get a clean markdown version of the page — the format LLMs read best, served straight from the canonical URL.',
  },
]

const technicalChecklist = [
  'Fast, mobile-first pages that pass Core Web Vitals',
  'HTTPS everywhere with a valid certificate',
  'Clean, canonical URLs (no duplicate-content traps)',
  'An XML sitemap that search engines can crawl',
  'Structured data (schema.org) on key pages',
  'Fixed crawl errors in Search Console / Bing',
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
  { title: 'Curated directories', body: 'A listing in a legitimate, human-reviewed directory is a credibility signal to both users and search engines — and now a citable source for AI answers.' },
  { title: 'Content & community', body: 'Write, ship in public, and show up where your audience already is. Earned mentions compound over time.' },
  { title: 'Technical hygiene', body: 'Speed, structure and crawlability are the boring fundamentals that make everything else you do actually count.' },
]

const comparison = {
  generic: {
    label: 'A row in a generic directory',
    points: [
      'A link and a name in a long table',
      'No structured data — invisible to machines',
      'Rotational placement that disappears',
      'Nothing an AI can confidently cite',
    ],
  },
  launchlog: {
    label: 'A LaunchLog listing',
    points: [
      'A dedicated, permanent product page',
      'schema.org @graph + llms.txt + markdown',
      'Permanent placement while your plan is active',
      'A clean, citable source for ChatGPT, Perplexity, Claude & Gemini',
    ],
  },
}

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
        headline: 'The 2026 SEO & AI Discovery Guide',
        description,
        url: pageUrl,
        inLanguage: 'en-US',
        dateModified: '2026-05-31',
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
        Get discovered — by search engines <span class="text-brand-accent">and AI.</span>
      </h1>
      <p class="mt-6 text-lg leading-8 text-brand-muted">
        Search isn’t just ten blue links anymore. People ask ChatGPT, Perplexity,
        Claude and Gemini — and those systems cite sources they can read and trust.
        This guide covers the fundamentals that still matter, plus what LaunchLog
        builds into every listing to make your product citable.
      </p>
    </section>

    <!-- The shift -->
    <section class="mt-16 grid gap-10 md:grid-cols-[0.7fr_1fr]">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
          The shift
        </p>
        <h2 class="mt-4 text-3xl font-bold tracking-normal text-white md:text-4xl">
          Two audiences read every page now.
        </h2>
      </div>
      <div class="space-y-6 leading-8 text-brand-muted">
        <p>
          Around 90% of web journeys still start with search, but a growing share
          of answers are now generated, not listed. An AI answer engine doesn’t
          rank a page — it reads it, decides whether it’s trustworthy, and quotes
          it. If your page is thin or unstructured, it gets skipped.
        </p>
        <p>
          That means a modern launch page has to satisfy two readers at once: a
          human who wants to understand your product in seconds, and a machine
          that needs structure to cite you with confidence. LaunchLog is designed
          around exactly that.
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
          Three things we build into every listing.
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
