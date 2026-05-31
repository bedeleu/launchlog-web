<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/api-docs`
const apiBase = 'https://api.launchlog.ai/api/v1'
const description
  = 'The public LaunchLog API. Read the directory programmatically over HTTPS — list and filter published listings and fetch a single listing by slug. No key required for public reads.'

// Code samples live as constants so curly braces never collide with Vue’s
// {{ }} interpolation in the template.
const curlList = `curl "${apiBase}/listings?tier=featured&category=ai"`

const jsonList = `{
  "data": [
    {
      "slug": "seoauto-io",
      "name": "SEOAuto",
      "tagline": "Automated programmatic SEO for SaaS",
      "url": "https://seoauto.io",
      "screenshot_url": "https://cdn.launchlog.ai/snapshots/seoauto-io/thumb.webp",
      "tier": "featured",
      "source": "founding",
      "category": { "slug": "ai", "name": "AI & Automation" },
      "tags": [{ "slug": "seo", "name": "SEO" }],
      "tech_stack": ["Laravel", "Vue"],
      "has_llms_txt": true,
      "has_schema_org": true,
      "has_markdown_negotiation": true,
      "country": "RO",
      "published_at": "2026-05-30T10:00:00Z"
    }
  ],
  "links": { "first": "...", "last": "...", "prev": null, "next": "..." },
  "meta": { "current_page": 1, "per_page": 24, "total": 203 }
}`

const curlShow = `curl "${apiBase}/listings/seoauto-io"`

const jsonShow = `{
  "data": {
    "slug": "seoauto-io",
    "name": "SEOAuto",
    "tagline": "Automated programmatic SEO for SaaS",
    "url": "https://seoauto.io",
    "link_text": "Visit SEOAuto",
    "description": "SEOAuto generates and publishes...",
    "screenshot_url": "https://cdn.launchlog.ai/snapshots/seoauto-io/featured.webp",
    "tier": "featured",
    "source": "founding",
    "category": { "slug": "ai", "name": "AI & Automation" },
    "tags": [{ "slug": "seo", "name": "SEO" }],
    "tech_stack": ["Laravel", "Vue"],
    "has_llms_txt": true,
    "has_schema_org": true,
    "has_markdown_negotiation": true,
    "country": "RO",
    "enriched_at": "2026-05-30T09:55:00Z",
    "published_at": "2026-05-30T10:00:00Z"
  }
}`

const curlMarkdown = `curl -H "Accept: text/markdown" "${siteUrl}/listing/seoauto-io"`

const listParams = [
  { name: 'category', type: 'string', desc: 'Filter by category slug.' },
  { name: 'tier', type: 'enum', desc: 'One of basic, premium, featured.' },
  { name: 'tech', type: 'string', desc: 'Filter by a tech-stack entry (e.g. Laravel).' },
  { name: 'tag', type: 'string', desc: 'Filter by tag slug.' },
  { name: 'q', type: 'string', desc: 'Full-text search over name, tagline and description.' },
]

const endpoints = [
  {
    method: 'GET',
    path: '/health',
    desc: 'Service health check. Returns a simple ok status — handy for uptime monitors.',
  },
  {
    method: 'GET',
    path: '/listings',
    desc: 'List published listings, 24 per page, ordered by tier then recency. Supports the query parameters below and standard pagination.',
  },
  {
    method: 'GET',
    path: '/listings/{slug}',
    desc: 'Fetch a single published listing by its slug, including the full description and enrichment fields.',
  },
]

useSeoMeta({
  title: 'API Documentation — LaunchLog',
  description,
  ogTitle: 'API Documentation — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'API Documentation — LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-apidocs-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'API Documentation — LaunchLog',
        description,
        inLanguage: 'en-US',
        isPartOf: { '@id': `${siteUrl}/#website` },
      }),
    },
  ],
})
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-14 md:py-20">
    <!-- Hero -->
    <header class="max-w-3xl">
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
        Developers
      </p>
      <h1 class="mt-5 text-4xl font-bold tracking-normal text-white md:text-6xl">
        API Documentation
      </h1>
      <p class="mt-6 text-lg leading-8 text-brand-muted">
        Read the LaunchLog directory programmatically. The public endpoints are
        REST over HTTPS, return JSON, and need no API key for reads.
      </p>
    </header>

    <!-- Base + conventions -->
    <section class="mt-12 grid gap-4 md:grid-cols-3">
      <div class="rounded-lg border border-brand-border bg-white/[0.03] p-6">
        <p class="text-xs font-semibold uppercase tracking-wider text-brand-muted/80">
          Base URL
        </p>
        <p class="mt-3 break-all font-mono text-sm text-brand-accent">
          {{ apiBase }}
        </p>
      </div>
      <div class="rounded-lg border border-brand-border bg-white/[0.03] p-6">
        <p class="text-xs font-semibold uppercase tracking-wider text-brand-muted/80">
          Auth
        </p>
        <p class="mt-3 text-sm leading-6 text-brand-muted">
          Public reads require no key. Write and admin endpoints use a Firebase
          ID token via <span class="font-mono text-xs text-brand-fg">Authorization: Bearer</span>.
        </p>
      </div>
      <div class="rounded-lg border border-brand-border bg-white/[0.03] p-6">
        <p class="text-xs font-semibold uppercase tracking-wider text-brand-muted/80">
          Format
        </p>
        <p class="mt-3 text-sm leading-6 text-brand-muted">
          JSON responses, 24 items per page, with <span class="font-mono text-xs text-brand-fg">links</span> and
          <span class="font-mono text-xs text-brand-fg">meta</span> pagination blocks.
        </p>
      </div>
    </section>

    <!-- Endpoints overview -->
    <section class="mt-14">
      <h2 class="text-2xl font-semibold text-white">
        Endpoints
      </h2>
      <div class="mt-6 divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border">
        <div
          v-for="ep in endpoints"
          :key="ep.path"
          class="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5"
        >
          <span class="inline-flex w-fit items-center rounded border border-brand-success/30 bg-brand-success/10 px-2 py-0.5 font-mono text-xs font-semibold text-brand-success">
            {{ ep.method }}
          </span>
          <code class="w-fit font-mono text-sm text-white">{{ ep.path }}</code>
          <p class="text-sm leading-6 text-brand-muted sm:flex-1">
            {{ ep.desc }}
          </p>
        </div>
      </div>
    </section>

    <!-- List listings -->
    <section class="mt-14 scroll-mt-24">
      <div class="flex items-center gap-3">
        <span class="inline-flex items-center rounded border border-brand-success/30 bg-brand-success/10 px-2 py-0.5 font-mono text-xs font-semibold text-brand-success">GET</span>
        <code class="font-mono text-base text-white">/listings</code>
      </div>
      <p class="mt-4 max-w-2xl leading-7 text-brand-muted">
        Returns published listings ordered Featured → Premium → Basic, then by
        publish date. Combine any of the query parameters below.
      </p>

      <div class="mt-6 overflow-hidden rounded-lg border border-brand-border">
        <div
          v-for="param in listParams"
          :key="param.name"
          class="flex flex-col gap-1 border-b border-brand-border p-4 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4"
        >
          <code class="w-40 shrink-0 font-mono text-sm text-brand-accent">{{ param.name }}</code>
          <span class="w-16 shrink-0 font-mono text-xs text-brand-muted">{{ param.type }}</span>
          <span class="text-sm leading-6 text-brand-muted">{{ param.desc }}</span>
        </div>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-muted/80">Request</p>
          <pre class="overflow-x-auto rounded-lg border border-brand-border bg-black/40 p-4 font-mono text-xs leading-6 text-brand-fg/90"><code>{{ curlList }}</code></pre>
        </div>
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-muted/80">Response</p>
          <pre class="overflow-x-auto rounded-lg border border-brand-border bg-black/40 p-4 font-mono text-xs leading-6 text-brand-fg/90"><code>{{ jsonList }}</code></pre>
        </div>
      </div>
    </section>

    <!-- Show listing -->
    <section class="mt-14 scroll-mt-24">
      <div class="flex items-center gap-3">
        <span class="inline-flex items-center rounded border border-brand-success/30 bg-brand-success/10 px-2 py-0.5 font-mono text-xs font-semibold text-brand-success">GET</span>
        <code class="font-mono text-base text-white">/listings/{slug}</code>
      </div>
      <p class="mt-4 max-w-2xl leading-7 text-brand-muted">
        Returns a single published listing, including the full description,
        link text and enrichment timestamp.
      </p>

      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-muted/80">Request</p>
          <pre class="overflow-x-auto rounded-lg border border-brand-border bg-black/40 p-4 font-mono text-xs leading-6 text-brand-fg/90"><code>{{ curlShow }}</code></pre>
        </div>
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-muted/80">Response</p>
          <pre class="overflow-x-auto rounded-lg border border-brand-border bg-black/40 p-4 font-mono text-xs leading-6 text-brand-fg/90"><code>{{ jsonShow }}</code></pre>
        </div>
      </div>
    </section>

    <!-- Markdown negotiation -->
    <section class="mt-14 rounded-lg border border-brand-accent/30 bg-brand-accent/[0.05] p-6 md:p-8">
      <h2 class="text-2xl font-semibold text-white">
        Bonus: markdown for machines
      </h2>
      <p class="mt-3 max-w-2xl leading-7 text-brand-muted">
        Every public listing page supports content negotiation. Ask for markdown
        and you get a clean, LLM-friendly version of the page from the same
        canonical URL — no separate endpoint.
      </p>
      <pre class="mt-5 overflow-x-auto rounded-lg border border-brand-border bg-black/40 p-4 font-mono text-xs leading-6 text-brand-fg/90"><code>{{ curlMarkdown }}</code></pre>
    </section>

    <!-- Notes -->
    <section class="mt-14 border-t border-brand-border pt-10">
      <h2 class="text-xl font-semibold text-white">
        Good to know
      </h2>
      <ul class="mt-5 space-y-3">
        <li class="flex gap-3 leading-7 text-brand-muted">
          <span class="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-accent/60" aria-hidden="true" />
          <span>The public API exposes only published listings. Private fields (owner, billing, internal status) are never returned.</span>
        </li>
        <li class="flex gap-3 leading-7 text-brand-muted">
          <span class="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-accent/60" aria-hidden="true" />
          <span>Be reasonable with request volume. Heavy or abusive traffic may be rate-limited.</span>
        </li>
        <li class="flex gap-3 leading-7 text-brand-muted">
          <span class="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-accent/60" aria-hidden="true" />
          <span>Building something with the API? Tell us at <a href="mailto:hello@launchlog.ai" class="font-medium text-brand-accent hover:underline">hello@launchlog.ai</a> — we’d love to see it.</span>
        </li>
      </ul>
    </section>
  </main>
</template>
