<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()

const siteUrl = computed(() => `https://${config.public.domain || 'launchlog.ai'}`)
const normalizedPath = computed(() => {
  if (route.path === '/') return '/'

  return route.path.replace(/\/+$/, '')
})
const canonicalUrl = computed(() => {
  const path = normalizedPath.value === '/' ? '/' : normalizedPath.value

  return `${siteUrl.value}${path}`
})

const noindexPaths = new Set([
  '/admin',
  '/dashboard',
  '/login',
  '/checkout',
  '/blog',
  '/about',
  '/contact',
  '/cookies',
  '/dmca',
  '/help',
  '/api-docs',
  '/privacy',
  '/terms',
  '/seo-guide',
  '/status',
])

const shouldNoindex = computed(() => {
  return noindexPaths.has(normalizedPath.value) || normalizedPath.value.startsWith('/preview/')
})

useSeoMeta({
  title: 'LaunchLog — The log of what just shipped',
  description:
    'A curated directory for indie makers, SaaS founders, and tech launches. Engineered for Google, Bing, Perplexity and AI answer engines.',
  ogTitle: 'LaunchLog — The log of what just shipped',
  ogDescription:
    'A curated directory for indie makers, SaaS founders, and tech launches.',
  ogType: 'website',
  ogUrl: canonicalUrl,
  twitterCard: 'summary_large_image',
  robots: computed(() =>
    shouldNoindex.value
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large',
  ),
})

useHead({
  link: [
    {
      rel: 'canonical',
      href: canonicalUrl,
    },
  ],
})
</script>

<template>
  <Html class="dark">
    <Body>
      <NuxtRouteAnnouncer />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </Body>
  </Html>
</template>
