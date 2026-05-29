<script setup lang="ts">
const { user } = useAuth()
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const homeUrl = `${siteUrl}/`
const ogImageUrl = `${siteUrl}/og-image.jpg`
const homeDescription = 'LaunchLog is a curated directory for indie makers, SaaS founders and tech launches, built for discoverability in Google, Bing and AI answer engines.'

useSeoMeta({
  title: 'LaunchLog — The log of what just shipped',
  description: homeDescription,
  ogTitle: 'LaunchLog — The log of what just shipped',
  ogDescription: homeDescription,
  ogUrl: homeUrl,
  ogImage: ogImageUrl,
  ogImageSecureUrl: ogImageUrl,
  ogImageAlt: 'LaunchLog — The log of what just shipped',
  twitterTitle: 'LaunchLog — The log of what just shipped',
  twitterDescription: homeDescription,
  twitterImage: ogImageUrl,
  twitterImageAlt: 'LaunchLog — The log of what just shipped',
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
            url: homeUrl,
            description:
              'LaunchLog is a curated paid directory for indie makers, SaaS founders and tech launches.',
            slogan: 'The log of what just shipped.',
            foundingDate: '2026',
            areaServed: 'Worldwide',
            knowsAbout: [
              'SaaS launches',
              'indie maker products',
              'AI search visibility',
              'schema.org',
              'llms.txt',
              'product directories',
            ],
            logo: {
              '@type': 'ImageObject',
              url: ogImageUrl,
              width: 1200,
              height: 630,
            },
            image: ogImageUrl,
            sameAs: [],
          },
          {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            name: 'LaunchLog',
            url: homeUrl,
            publisher: {
              '@id': `${siteUrl}/#organization`,
            },
            description: homeDescription,
            inLanguage: 'en-US',
            availableLanguage: ['English'],
            potentialAction: {
              '@type': 'SearchAction',
              target: `${siteUrl}/browse-all?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
          {
            '@type': 'WebPage',
            '@id': `${siteUrl}/#webpage`,
            url: homeUrl,
            name: 'LaunchLog — The log of what just shipped',
            description: homeDescription,
            inLanguage: 'en-US',
            primaryImageOfPage: {
              '@type': 'ImageObject',
              url: ogImageUrl,
              width: 1200,
              height: 630,
            },
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
