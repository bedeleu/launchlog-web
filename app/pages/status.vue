<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/status`
const description
  = 'Live operational status of LaunchLog — the website, API, database, screenshots and payments. Current state and recent incidents.'

const components = [
  { name: 'Website', detail: 'launchlog.ai — public pages and dashboard' },
  { name: 'API', detail: 'api.launchlog.ai — listings, previews and auth' },
  { name: 'Database', detail: 'PostgreSQL — listing and account data' },
  { name: 'Screenshots & CDN', detail: 'Microlink capture and cdn.launchlog.ai delivery' },
  { name: 'Payments', detail: 'Stripe checkout and billing' },
]

useSeoMeta({
  title: 'System Status — LaunchLog',
  description,
  ogTitle: 'System Status — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'System Status — LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-status-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'System Status — LaunchLog',
        description,
        inLanguage: 'en-US',
        isPartOf: { '@id': `${siteUrl}/#website` },
      }),
    },
  ],
})
</script>

<template>
  <main class="mx-auto max-w-4xl px-6 py-14 md:py-20">
    <header>
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
        Status
      </p>
      <h1 class="mt-5 text-4xl font-bold tracking-normal text-white md:text-5xl">
        System status
      </h1>
    </header>

    <!-- Overall banner -->
    <div class="mt-8 flex items-center gap-4 rounded-lg border border-brand-success/30 bg-brand-success/[0.08] p-5">
      <span class="relative flex size-3">
        <span class="absolute inline-flex size-full animate-ping rounded-full bg-brand-success opacity-60" />
        <span class="relative inline-flex size-3 rounded-full bg-brand-success" />
      </span>
      <div>
        <p class="text-lg font-semibold text-white">
          All systems operational
        </p>
        <p class="text-sm text-brand-muted">
          Everything is running normally.
        </p>
      </div>
    </div>

    <!-- Components -->
    <section class="mt-10">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-brand-muted/80">
        Components
      </h2>
      <div class="mt-4 divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border">
        <div
          v-for="component in components"
          :key="component.name"
          class="flex items-center justify-between gap-4 p-5"
        >
          <div class="min-w-0">
            <p class="font-medium text-white">
              {{ component.name }}
            </p>
            <p class="mt-0.5 truncate text-sm text-brand-muted">
              {{ component.detail }}
            </p>
          </div>
          <span class="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-brand-success">
            <span class="size-2 rounded-full bg-brand-success" aria-hidden="true" />
            Operational
          </span>
        </div>
      </div>
    </section>

    <!-- Incident history -->
    <section class="mt-10">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-brand-muted/80">
        Recent incidents
      </h2>
      <div class="mt-4 rounded-lg border border-brand-border bg-white/[0.02] p-8 text-center">
        <p class="text-sm font-medium text-white">
          No incidents reported.
        </p>
        <p class="mt-2 text-sm text-brand-muted">
          We’ll post any disruptions here, with updates until they’re resolved.
        </p>
      </div>
    </section>

    <!-- Footnote -->
    <p class="mt-8 text-sm leading-7 text-brand-muted">
      Seeing a problem we haven’t posted? Let us know at
      <a href="mailto:support@launchlog.ai" class="font-medium text-brand-accent hover:underline">support@launchlog.ai</a>
      and we’ll look into it right away.
    </p>
  </main>
</template>
