<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/contact`
const description
  = 'Get in touch with LaunchLog — support for your listing, billing questions, press and partnerships, legal and copyright. Real humans, fast replies.'

const channels = [
  {
    label: 'General',
    email: 'hello@launchlog.ai',
    body: 'Questions about LaunchLog, how listings work, or anything not covered elsewhere.',
    icon: 'M3 8l9 6 9-6M3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8l9-5 9 5',
  },
  {
    label: 'Support',
    email: 'support@launchlog.ai',
    body: 'Help with an existing listing, your account, billing, refunds or technical issues.',
    icon: 'M18.364 5.636A9 9 0 105.636 18.364 9 9 0 0018.364 5.636zM12 8v4m0 4h.01',
  },
  {
    label: 'Press & partnerships',
    email: 'press@launchlog.ai',
    body: 'Media enquiries, collaborations, bulk listings and partnership proposals.',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  },
  {
    label: 'Legal & copyright',
    email: 'legal@launchlog.ai',
    body: 'Privacy requests, terms questions and DMCA takedowns (dmca@launchlog.ai).',
    icon: 'M12 3l8 4v5c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7l8-4z',
  },
]

const quickLinks = [
  { label: 'Browse the Help Center', to: '/help' },
  { label: 'Check system status', to: '/status' },
  { label: 'Preview a listing for free', to: '/submit' },
  { label: 'See pricing', to: '/pricing' },
]

useSeoMeta({
  title: 'Contact LaunchLog',
  description,
  ogTitle: 'Contact LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'Contact LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-contact-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Contact LaunchLog',
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
    <section class="grid gap-10 md:grid-cols-[1fr_0.7fr] md:items-end">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
          Contact
        </p>
        <h1 class="mt-5 max-w-2xl text-4xl font-bold tracking-normal text-white md:text-6xl">
          Talk to a human.
        </h1>
        <p class="mt-6 max-w-xl text-lg leading-8 text-brand-muted">
          LaunchLog is run by a small team, not a ticket factory. Pick the right
          inbox below and you’ll hear back — usually within one business day.
        </p>
      </div>
      <aside class="rounded-lg border border-brand-border bg-white/[0.03] p-6">
        <div class="flex items-center gap-2.5">
          <span class="size-2 rounded-full bg-brand-success" aria-hidden="true" />
          <p class="text-sm font-semibold text-white">Typical response time</p>
        </div>
        <p class="mt-3 leading-7 text-brand-muted">
          Within one business day for support and billing. For urgent listing
          issues, mention “urgent” in your subject line.
        </p>
      </aside>
    </section>

    <section class="mt-14 grid gap-4 sm:grid-cols-2" aria-label="Contact channels">
      <a
        v-for="channel in channels"
        :key="channel.email"
        :href="`mailto:${channel.email}`"
        class="group rounded-lg border border-brand-border bg-white/[0.03] p-6 transition-colors hover:border-brand-accent/50 hover:bg-white/[0.05]"
      >
        <div class="flex items-start justify-between gap-4">
          <span class="inline-flex size-10 items-center justify-center rounded-md border border-brand-border bg-brand-accent/10 text-brand-accent">
            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" :d="channel.icon" />
            </svg>
          </span>
          <svg class="size-4 text-brand-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
        <h2 class="mt-5 text-lg font-semibold text-white">
          {{ channel.label }}
        </h2>
        <p class="mt-2 leading-7 text-brand-muted">
          {{ channel.body }}
        </p>
        <p class="mt-4 font-mono text-sm text-brand-accent">
          {{ channel.email }}
        </p>
      </a>
    </section>

    <section class="mt-16 rounded-lg border border-brand-border p-6 md:p-8">
      <div class="grid gap-8 md:grid-cols-[0.6fr_1fr] md:items-center">
        <div>
          <h2 class="text-2xl font-semibold text-white">
            Before you email
          </h2>
          <p class="mt-3 leading-7 text-brand-muted">
            A lot of questions have a faster answer. These usually get you there
            quicker than the inbox.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <NuxtLink
            v-for="link in quickLinks"
            :key="link.to"
            :to="link.to"
            class="flex items-center justify-between gap-3 rounded-md border border-brand-border px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.04]"
          >
            {{ link.label }}
            <svg class="size-4 shrink-0 text-brand-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>
