<script setup lang="ts">
import { extractHttpStatus } from '#shared/utils/listing-http-status'
import type { BlogArchivePage } from '~~/server/utils/wordpress-blog'

const route = useRoute()
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const blogUrl = `${siteUrl}/blog`
const blogDescription = 'LaunchLog blog covers SaaS launches, indie maker discovery, AI search visibility, schema.org and practical product distribution.'

// Forwarded verbatim so the API owns the single definition of a valid page number. A repeated
// `?page=1&page=2` stringifies to "1,2" and is rejected there rather than silently picking one.
const pageQuery = computed(() => {
  const raw = route.query.page

  return raw === undefined ? undefined : String(raw)
})

const { data, error } = await useAsyncData(
  () => `blog-archive-${pageQuery.value ?? '1'}`,
  // Explicit response type: Nuxt's typed-route inference blows its recursion budget on this
  // route once the handler returns an envelope instead of a bare array (TS2321).
  () => $fetch<BlogArchivePage>('/api/blog/posts', { query: { page: pageQuery.value } }),
  { watch: [pageQuery] },
)

/**
 * Absence and unavailability must not share a branch. A page past the end really does not exist, so
 * it is deindexed; anything else is the WordPress upstream failing and stays a retryable 503 that
 * keeps the archive's URLs in the index.
 */
const archiveError = (cause: unknown) => (extractHttpStatus(cause) === 404
  ? createError({ statusCode: 404, statusMessage: 'Blog page not found' })
  : createError({ statusCode: 503, statusMessage: 'Blog temporarily unavailable' }))

if (error.value) {
  if (extractHttpStatus(error.value) === 404 && useRequestEvent()) {
    useResponseHeader('X-Robots-Tag').value = 'noindex, nofollow'
  }

  throw archiveError(error.value)
}

// `useAsyncData` re-runs on every client-side page change, but this setup body runs once. Without
// the watcher a failure after a pagination click would leave the previous page's posts on screen
// under the new URL, or fall through to the empty state, instead of the 404/503 the same request
// produces on a fresh load.
watch(error, (cause) => {
  if (cause) {
    showError(archiveError(cause))
  }
})

const blogPosts = computed(() => data.value?.posts ?? [])
const meta = computed(() => data.value?.meta ?? { current_page: 1, last_page: 1, per_page: 24, total: 0 })

/** Page 1 lives at /blog, never at /blog?page=1, so the archive has exactly one first-page URL. */
const pagePath = (page: number) => (page <= 1 ? '/blog' : `/blog?page=${page}`)
const pageUrl = (page: number) => `${siteUrl}${pagePath(page)}`

const canonicalUrl = computed(() => pageUrl(meta.value.current_page))
const isFirstPage = computed(() => meta.value.current_page <= 1)

const pageTitle = computed(() => (isFirstPage.value
  ? 'LaunchLog Blog — SaaS launch visibility and AI search'
  : `LaunchLog Blog — Page ${meta.value.current_page} of ${meta.value.last_page}`))

const pageDescription = computed(() => (isFirstPage.value
  ? blogDescription
  : `${blogDescription} Page ${meta.value.current_page} of ${meta.value.last_page}.`))

// Positions continue across pages so the ItemList describes a slice of one archive rather than
// restarting at 1 on every page.
const itemOffset = computed(() => (meta.value.current_page - 1) * meta.value.per_page)

const pageNumbers = computed(() => {
  const last = meta.value.last_page
  const current = meta.value.current_page
  const pages = new Set<number>([1, last])

  for (let page = Math.max(1, current - 2); page <= Math.min(last, current + 2); page++) {
    pages.add(page)
  }

  return [...pages].sort((a, b) => a - b)
})

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogUrl: canonicalUrl,
  ogType: 'website',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
})

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Blog', path: '/blog' },
])

useHead({
  // app.vue derives these from the path alone, which would pin every archive page to /blog and
  // tell search engines the deeper pages are duplicates of the first one.
  link: [
    { rel: 'canonical', href: canonicalUrl },
  ],
  script: [
    {
      key: 'launchlog-blog-schema',
      type: 'application/ld+json',
      innerHTML: computed(() => serializeJsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Blog',
            '@id': `${blogUrl}#blog`,
            url: blogUrl,
            name: 'LaunchLog Blog',
            description: blogDescription,
            inLanguage: 'en-US',
            publisher: {
              '@id': `${siteUrl}/#organization`,
            },
          },
          {
            '@type': 'ItemList',
            '@id': `${canonicalUrl.value}#itemlist`,
            itemListElement: blogPosts.value.map((post, index) => ({
              '@type': 'ListItem',
              position: itemOffset.value + index + 1,
              url: `${blogUrl}/${post.slug}`,
              name: post.title,
            })),
          },
        ],
      })),
    },
  ],
})
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-14 md:py-20">
    <header class="max-w-3xl">
      <p class="text-brand-muted text-sm font-semibold uppercase tracking-[0.18em]">
        LaunchLog Blog
      </p>
      <h1 class="mt-5 text-4xl font-bold tracking-normal text-white md:text-6xl">
        SaaS launch visibility, written for search and AI discovery.
      </h1>
      <p class="text-brand-muted mt-5 text-lg leading-8">
        Practical notes on indie launches, product directories, schema.org, llms.txt,
        Google, Bing and answer-engine visibility.
      </p>
    </header>

    <template v-if="blogPosts.length">
      <p
        v-if="meta.last_page > 1"
        class="text-brand-muted mt-10 text-sm"
      >
        Page {{ meta.current_page }} of {{ meta.last_page }} — {{ meta.total }} articles
      </p>

      <section
        class="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3"
        aria-label="LaunchLog blog posts"
      >
        <article
          v-for="post in blogPosts"
          :key="post.id"
          class="overflow-hidden rounded-lg border border-brand-border bg-white/[0.03]"
        >
          <NuxtLink
            :to="`/blog/${post.slug}`"
            class="flex h-full flex-col focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <img
              v-if="post.featuredImage"
              :src="post.featuredImage"
              :alt="post.featuredImageAlt || post.title"
              class="aspect-[16/9] w-full object-cover"
              loading="lazy"
            >
            <div class="flex flex-1 flex-col p-6">
              <time class="text-brand-muted text-sm" :datetime="post.date">
                {{ new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }}
              </time>
              <h2 class="mt-3 text-2xl font-semibold leading-tight text-white">
                {{ post.title }}
              </h2>
              <p class="text-brand-muted mt-4 line-clamp-3 leading-7">
                {{ post.excerpt }}
              </p>
              <span class="mt-6 inline-flex text-sm font-semibold text-brand-accent">
                Read article
              </span>
            </div>
          </NuxtLink>
        </article>
      </section>

      <!--
        Real anchors, rendered server-side: this is the only internal link path to older posts.
        `aria-current-value="false"` is required because Vue Router decides "exact active" from the
        path alone; every /blog?page=N link therefore matches /blog and RouterLink would otherwise
        stamp aria-current="page" on all of them. The current page is a span, not a link.
      -->
      <nav
        v-if="meta.last_page > 1"
        class="mt-12 flex flex-wrap items-center justify-center gap-2"
        aria-label="Blog archive pagination"
      >
        <NuxtLink
          v-if="meta.current_page > 1"
          :to="pagePath(meta.current_page - 1)"
          rel="prev"
          aria-current-value="false"
          class="inline-flex h-11 items-center justify-center rounded-md border border-brand-border px-4 text-sm font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
        >
          Previous
        </NuxtLink>
        <span
          v-else
          aria-disabled="true"
          class="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-md border border-brand-border px-4 text-sm font-medium text-brand-muted/40"
        >
          Previous
        </span>

        <template v-for="(page, index) in pageNumbers" :key="page">
          <span
            v-if="index > 0 && pageNumbers[index - 1] !== page - 1"
            class="text-brand-muted px-1 text-sm"
            aria-hidden="true"
          >
            …
          </span>
          <span
            v-if="page === meta.current_page"
            aria-current="page"
            class="inline-flex size-11 items-center justify-center rounded-md border border-brand-accent bg-brand-accent text-sm font-semibold text-white"
          >
            {{ page }}
          </span>
          <NuxtLink
            v-else
            :to="pagePath(page)"
            :aria-label="`Go to page ${page}`"
            aria-current-value="false"
            class="inline-flex size-11 items-center justify-center rounded-md border border-brand-border text-sm font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          >
            {{ page }}
          </NuxtLink>
        </template>

        <NuxtLink
          v-if="meta.current_page < meta.last_page"
          :to="pagePath(meta.current_page + 1)"
          rel="next"
          aria-current-value="false"
          class="inline-flex h-11 items-center justify-center rounded-md border border-brand-border px-4 text-sm font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
        >
          Next
        </NuxtLink>
        <span
          v-else
          aria-disabled="true"
          class="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-md border border-brand-border px-4 text-sm font-medium text-brand-muted/40"
        >
          Next
        </span>
      </nav>
    </template>

    <!-- Only a resolved-but-empty archive is "nothing published"; a failure is handled above. -->
    <p v-else-if="!error" class="text-brand-muted mt-12">
      No articles published yet.
    </p>
  </main>
</template>
