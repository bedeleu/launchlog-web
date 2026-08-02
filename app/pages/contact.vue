<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/contact`
const description
  = 'LaunchLog contact channels for listing support, billing, legal requests and copyright notices.'
const legalName = config.public.legalName.trim()
const supportEmail = config.public.supportEmail.trim()
const legalEmail = config.public.legalEmail.trim()
const dmcaEmail = config.public.dmcaEmail.trim()

const channels = computed(() => [
  supportEmail ? {
    label: 'Support',
    email: supportEmail,
    body: 'Help with an existing listing, account access, billing or technical issues.',
    icon: 'M18.364 5.636A9 9 0 105.636 18.364 9 9 0 0018.364 5.636zM12 8v4m0 4h.01',
  } : null,
  legalEmail ? {
    label: 'Legal & privacy',
    email: legalEmail,
    body: 'Privacy requests, data-rights requests and questions about the legal terms.',
    icon: 'M12 3l8 4v5c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7l8-4z',
  } : null,
  dmcaEmail ? {
    label: 'Copyright notices',
    email: dmcaEmail,
    body: 'Copyright notices and counter-notices concerning content hosted by LaunchLog.',
    icon: 'M3 8l9 6 9-6M3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8l9-5 9 5',
  } : null,
].filter((channel): channel is NonNullable<typeof channel> => channel !== null))

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
          Use a configured channel below for support, legal requests or
          copyright notices.
        </p>
      </div>
      <aside v-if="legalName" class="rounded-lg border border-brand-border bg-white/[0.03] p-6">
        <p class="text-sm font-semibold text-white">Service operator</p>
        <p class="mt-3 leading-7 text-brand-muted">
          {{ legalName }}
        </p>
      </aside>
    </section>

    <section v-if="channels.length" class="mt-14 grid gap-4 sm:grid-cols-2" aria-label="Contact channels">
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

    <section v-else class="mt-14 rounded-lg border border-brand-border bg-white/[0.03] p-6 md:p-8">
      <h2 class="text-xl font-semibold text-white">
        Contact details are not configured
      </h2>
      <p class="mt-3 max-w-2xl leading-7 text-brand-muted">
        No public support, legal or copyright mailbox is currently published on this page.
        The resources below describe the available self-service paths.
      </p>
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
