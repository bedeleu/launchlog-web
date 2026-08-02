<script setup lang="ts">
import { safeExternalHttpUrl } from '~/utils/safe-public-url'

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/status`
const statusPageUrl = safeExternalHttpUrl(config.public.statusPageUrl)
const supportEmail = config.public.supportEmail.trim()
const description
  = 'Where to find configured LaunchLog service-status and incident updates.'

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
    <header class="max-w-2xl">
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
        Status
      </p>
      <h1 class="mt-5 text-4xl font-bold tracking-normal text-white md:text-5xl">
        Service updates
      </h1>
      <p class="mt-5 text-lg leading-8 text-brand-muted">
        This page does not infer live health from the website response. Use the configured
        channel below for operational and incident information.
      </p>
    </header>

    <section v-if="statusPageUrl" class="mt-10 rounded-lg border border-brand-border bg-white/[0.03] p-6 md:p-8">
      <p class="text-xs font-semibold uppercase tracking-wider text-brand-muted/80">
        Configured status page
      </p>
      <a
        :href="statusPageUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-4 inline-flex items-center rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
      >
        Open service status
        <span class="ml-2" aria-hidden="true">↗</span>
      </a>
    </section>

    <section v-else-if="supportEmail" class="mt-10 rounded-lg border border-brand-border bg-white/[0.03] p-6 md:p-8">
      <h2 class="text-xl font-semibold text-white">
        Support channel
      </h2>
      <p class="mt-3 leading-7 text-brand-muted">
        To report or ask about a service issue, contact
        <a :href="`mailto:${supportEmail}`" class="font-medium text-brand-accent hover:underline">{{ supportEmail }}</a>.
      </p>
    </section>

    <section v-else class="mt-10 rounded-lg border border-brand-border bg-white/[0.03] p-6 md:p-8">
      <h2 class="text-xl font-semibold text-white">
        No public status channel is configured
      </h2>
      <p class="mt-3 leading-7 text-brand-muted">
        LaunchLog has not configured a public status-page URL or support mailbox.
      </p>
    </section>
  </main>
</template>
