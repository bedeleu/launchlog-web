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
  <ContentReadingShell
    :label="`Journal${meta.current_page > 1 ? ` · Page ${meta.current_page}` : ''}`"
    title="Notes on shipping, discovery, and the public web."
    intro="Practical dispatches on product launches, directories, structured data, search visibility, and machine-readable publishing."
    wide
  >
    <template #meta>
      <ContentReadingMeta
        :items="[
          { label: 'Archive', value: `${meta.total} articles` },
          { label: 'Page', value: `${meta.current_page} of ${meta.last_page}` },
        ]"
      />
    </template>

    <template v-if="blogPosts.length">
      <section
        class="grid gap-x-6 gap-y-10 md:grid-cols-2"
        aria-label="LaunchLog blog posts"
      >
        <ContentBlogDispatchCard
          v-for="(post, index) in blogPosts"
          :key="post.id"
          :post="post"
          :sequence="itemOffset + index + 1"
        />
      </section>

      <!--
        Real anchors, rendered server-side: this is the only internal link path to older posts.
        `aria-current-value="false"` is required because Vue Router decides "exact active" from the
        path alone; every /blog?page=N link therefore matches /blog and RouterLink would otherwise
        stamp aria-current="page" on all of them. The current page is a span, not a link.
      -->
      <nav
        v-if="meta.last_page > 1"
        class="mt-14 flex flex-wrap items-center justify-center gap-2 border-t border-release-seam pt-8"
        aria-label="Blog archive pagination"
      >
        <NuxtLink
          v-if="meta.current_page > 1"
          :to="pagePath(meta.current_page - 1)"
          rel="prev"
          aria-current-value="false"
          class="inline-flex h-11 items-center justify-center border border-release-seam px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-release-paper-muted hover:border-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-release-focus"
        >
          Previous
        </NuxtLink>
        <span
          v-else
          aria-disabled="true"
          class="inline-flex h-11 cursor-not-allowed items-center justify-center border border-release-seam px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted opacity-40"
        >
          Previous
        </span>

        <template v-for="(page, index) in pageNumbers" :key="page">
          <span
            v-if="index > 0 && pageNumbers[index - 1] !== page - 1"
            class="px-1 text-sm text-release-paper-muted"
            aria-hidden="true"
          >
            …
          </span>
          <span
            v-if="page === meta.current_page"
            aria-current="page"
            class="inline-flex size-11 items-center justify-center border border-release-blaze bg-release-blaze font-mono text-xs font-semibold text-release-ink"
          >
            {{ page }}
          </span>
          <NuxtLink
            v-else
            :to="pagePath(page)"
            :aria-label="`Go to page ${page}`"
            aria-current-value="false"
            class="inline-flex size-11 items-center justify-center border border-release-seam font-mono text-xs text-release-paper-muted hover:border-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-release-focus"
          >
            {{ page }}
          </NuxtLink>
        </template>

        <NuxtLink
          v-if="meta.current_page < meta.last_page"
          :to="pagePath(meta.current_page + 1)"
          rel="next"
          aria-current-value="false"
          class="inline-flex h-11 items-center justify-center border border-release-seam px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-release-paper-muted hover:border-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-release-focus"
        >
          Next
        </NuxtLink>
        <span
          v-else
          aria-disabled="true"
          class="inline-flex h-11 cursor-not-allowed items-center justify-center border border-release-seam px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted opacity-40"
        >
          Next
        </span>
      </nav>
    </template>

    <!-- Only a resolved-but-empty archive is "nothing published"; a failure is handled above. -->
    <p v-else-if="!error" class="border-l-2 border-release-blaze bg-release-rail px-5 py-4 text-release-paper-muted">
      No articles published yet.
    </p>
  </ContentReadingShell>
</template>
