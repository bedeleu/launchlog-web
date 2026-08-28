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
  <ContentReadingShell
    label="Operations record · Status"
    title="Service updates"
    intro="This page does not infer live health from the website response. Use the configured channel below for operational and incident information."
  >
    <section v-if="statusPageUrl" class="release-panel p-6 md:p-8">
      <p class="release-kicker">Configured status page</p>
      <p class="mt-4 max-w-xl leading-7 text-release-paper-muted">Incident history and current service information are published on the dedicated status service.</p>
      <a
        :href="statusPageUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="release-action mt-6"
      >
        Open service status <span aria-hidden="true">↗</span>
      </a>
    </section>

    <section v-else-if="supportEmail" class="release-panel p-6 md:p-8">
      <p class="release-kicker">Fallback route</p>
      <h2 class="mt-4 text-2xl font-semibold tracking-tight text-[#f6f1e7]">Support channel</h2>
      <p class="mt-3 leading-7 text-release-paper-muted">
        To report or ask about a service issue, contact
        <a :href="`mailto:${supportEmail}`" class="font-medium text-release-blaze underline-offset-4 hover:underline">{{ supportEmail }}</a>.
      </p>
    </section>

    <section v-else class="release-panel p-6 md:p-8">
      <p class="release-kicker">Unavailable</p>
      <h2 class="mt-4 text-2xl font-semibold tracking-tight text-[#f6f1e7]">No public status channel is configured</h2>
      <p class="mt-3 leading-7 text-release-paper-muted">
        LaunchLog has not configured a public status-page URL or support mailbox.
      </p>
    </section>
  </ContentReadingShell>
</template>
