<script setup lang="ts">
const { user } = useAuth()
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`

useSeoMeta({
  title: 'LaunchLog — The log of what just shipped',
  description:
    'LaunchLog is a curated directory for indie makers, SaaS founders and tech launches, built for discoverability in Google, Bing and AI answer engines.',
  ogTitle: 'LaunchLog — The log of what just shipped',
  ogDescription:
    'Get your SaaS launch listed in a curated directory engineered for search and AI citations.',
  ogUrl: siteUrl,
})

useHead({
  script: [
    {
      key: 'launchlog-home-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${siteUrl}/#organization`,
            name: 'LaunchLog',
            url: siteUrl,
            description:
              'LaunchLog is a curated paid directory for indie makers, SaaS founders and tech launches.',
            sameAs: [],
          },
          {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            name: 'LaunchLog',
            url: siteUrl,
            publisher: {
              '@id': `${siteUrl}/#organization`,
            },
            description: 'The log of what just shipped.',
          },
          {
            '@type': 'WebPage',
            '@id': `${siteUrl}/#webpage`,
            url: siteUrl,
            name: 'LaunchLog — The log of what just shipped',
            isPartOf: {
              '@id': `${siteUrl}/#website`,
            },
            about: {
              '@id': `${siteUrl}/#organization`,
            },
          },
        ],
      }),
    },
  ],
})
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
    <p class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
      Curated directory for indie tech
    </p>
    <h1 class="mt-6 max-w-3xl text-5xl font-bold tracking-normal text-white md:text-7xl">
      Get Listed.
      <span class="block text-gray-600">Get Found.</span>
    </h1>
    <p class="mt-6 max-w-2xl text-lg text-gray-300">
      LaunchLog is the log of what just shipped, engineered to be cited by
      ChatGPT, Perplexity, Claude, and Gemini.
    </p>

    <div class="mt-10">
      <IntakePreviewForm />
    </div>

    <p class="text-brand-muted mt-8 text-sm">
      <template v-if="user">
        Signed in as <strong class="text-white">{{ user.email }}</strong> —
        <NuxtLink to="/dashboard" class="text-brand-accent underline">
          Dashboard
        </NuxtLink>
      </template>
      <template v-else>
        Already listed?
        <NuxtLink to="/login" class="text-brand-accent underline">
          Sign in
        </NuxtLink>
      </template>
    </p>
  </main>
</template>
