<script setup lang="ts">
import { defineLink } from '@unhead/vue'
import geistMonoLatinUrl from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url'
import geistLatinUrl from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'

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

/**
 * Matched as prefixes and case-insensitively, on purpose. Exact-case routing already turns a
 * mis-cased request into a 404 and the server middleware redirects the private ones, but this is
 * the last line: if either of those is ever bypassed, the page must still declare itself noindex
 * rather than fall through to the indexable default. Prefix matching also covers the nested paths
 * an exact-match set silently missed, `/checkout/success` and `/admin/listings` among them.
 */
const noindexPrefixes = [
  '/admin',
  '/dashboard',
  '/login',
  '/checkout',
  '/preview',
  '/contact',
  '/cookies',
  '/dmca',
  '/help',
  '/api-docs',
  '/privacy',
  '/terms',
  '/status',
]

const shouldNoindex = computed(() => {
  const path = normalizedPath.value.toLowerCase()

  return noindexPrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
})

useSeoMeta({
  title: defaultTitle,
  description: defaultDescription,
  applicationName: siteName,
  author: 'LaunchLog',
  creator: 'LaunchLog',
  publisher: 'LaunchLog',
  ogTitle: defaultTitle,
  ogDescription: defaultDescription,
  ogType: 'website',
  ogUrl: computed(() => shouldNoindex.value ? undefined : canonicalUrl.value),
  ogSiteName: siteName,
  ogLocale: 'en_US',
  ogImage: ogImageUrl,
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

useHead(() => ({
  htmlAttrs: {
    lang: 'en',
  },
  link: [
    {
      rel: 'preload',
      href: geistLatinUrl,
      as: 'font',
      type: 'font/woff2',
      crossorigin: 'anonymous',
    },
    {
      rel: 'preload',
      href: geistMonoLatinUrl,
      as: 'font',
      type: 'font/woff2',
      crossorigin: 'anonymous',
    },
    ...(!shouldNoindex.value
      ? [{ rel: 'canonical' as const, href: canonicalUrl.value }]
      : []),
    // `image_src` is a legacy non-standard rel, so unhead 3's strict `rel` union rejects it.
    // defineLink is the documented escape hatch. It takes a plain string rather than a ref, which
    // is fine here: the URL is derived from runtime config and never changes after setup.
    defineLink({
      rel: 'image_src',
      href: ogImageUrl.value,
    }),
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
  ],
  meta: [
    // Moved off the useSeoMeta shorthand, which unhead 3 removed. Same rendered tag.
    { name: 'keywords', content: defaultKeywords },
    { name: 'language', content: 'English' },
    { name: 'content-language', content: 'en' },
    { name: 'theme-color', content: '#080907' },
    {
      name: 'referrer',
      content: shouldNoindex.value ? 'no-referrer' : 'strict-origin-when-cross-origin',
    },
    { name: 'format-detection', content: 'telephone=no' },
    { name: 'apple-mobile-web-app-title', content: siteName },
    { name: 'msapplication-TileColor', content: '#080907' },
    { name: 'classification', content: 'SaaS directory and product launch directory' },
    { name: 'category', content: 'Technology' },
    { name: 'coverage', content: 'Worldwide' },
    { name: 'distribution', content: 'Global' },
    { name: 'rating', content: 'General' },
  ],
}))
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
