<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()

const siteUrl = computed(() => `https://${config.public.domain || 'launchlog.ai'}`)
const siteName = 'LaunchLog'
const defaultTitle = 'LaunchLog — The log of what just shipped'
const defaultDescription = 'LaunchLog is a curated directory for indie makers, SaaS founders and tech launches, built for discoverability in Google, Bing and AI answer engines.'
const defaultKeywords = 'LaunchLog, SaaS directory, startup launch directory, indie maker directory, AI search visibility, llms.txt, schema.org, product launch'
const ogImageUrl = computed(() => `${siteUrl.value}/og-image.jpg`)
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
  title: defaultTitle,
  description: defaultDescription,
  keywords: defaultKeywords,
  applicationName: siteName,
  author: 'LaunchLog',
  creator: 'LaunchLog',
  publisher: 'LaunchLog',
  ogTitle: defaultTitle,
  ogDescription: defaultDescription,
  ogType: 'website',
  ogUrl: canonicalUrl,
  ogSiteName: siteName,
  ogLocale: 'en_US',
  ogImage: ogImageUrl,
  ogImageSecureUrl: ogImageUrl,
  ogImageType: 'image/jpeg',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'LaunchLog — The log of what just shipped',
  twitterCard: 'summary_large_image',
  twitterTitle: defaultTitle,
  twitterDescription: defaultDescription,
  twitterImage: ogImageUrl,
  twitterImageAlt: 'LaunchLog — The log of what just shipped',
  robots: computed(() =>
    shouldNoindex.value
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large',
  ),
})

useHead({
  htmlAttrs: {
    lang: 'en',
  },
  link: [
    {
      rel: 'canonical',
      href: canonicalUrl,
    },
    {
      rel: 'alternate',
      hreflang: 'en',
      href: canonicalUrl,
    },
    {
      rel: 'alternate',
      hreflang: 'x-default',
      href: canonicalUrl,
    },
    {
      rel: 'image_src',
      href: ogImageUrl,
    },
  ],
  meta: [
    { name: 'language', content: 'English' },
    { name: 'content-language', content: 'en' },
    { name: 'theme-color', content: '#0A0E1A' },
    { name: 'referrer', content: 'strict-origin-when-cross-origin' },
    { name: 'format-detection', content: 'telephone=no' },
    { name: 'apple-mobile-web-app-title', content: siteName },
    { name: 'msapplication-TileColor', content: '#0A0E1A' },
    { name: 'classification', content: 'SaaS directory and product launch directory' },
    { name: 'category', content: 'Technology' },
    { name: 'coverage', content: 'Worldwide' },
    { name: 'distribution', content: 'Global' },
    { name: 'rating', content: 'General' },
  ],
})
</script>

<template>
  <Html lang="en" class="dark">
    <Body>
      <NuxtRouteAnnouncer />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </Body>
  </Html>
</template>
