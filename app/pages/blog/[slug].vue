<script setup lang="ts">
import { listingAbsenceStatus } from '#shared/utils/listing-http-status'

const route = useRoute()
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const slug = computed(() => String(route.params.slug ?? ''))

const { data: post, error } = await useAsyncData(`blog-post-${slug.value}`, () =>
  $fetch(`/api/blog/posts/${slug.value}`),
)

// Absence and upstream failure must not share a branch. A WordPress outage makes the API
// answer 5xx for posts that really exist; answering 404 there would ask search engines to
// remove the whole mirrored corpus.
const absenceStatus = listingAbsenceStatus(error.value, post.value)

if (absenceStatus) {
  const event = useRequestEvent()
  if (event) {
    useResponseHeader('X-Robots-Tag').value = 'noindex, nofollow'
  }

  throw createError({ statusCode: absenceStatus, statusMessage: 'Blog post not found' })
}

if (error.value) {
  // Temporary, and explicitly not deindexable: crawlers retry a 503 and keep the URL.
  throw createError({ statusCode: 503, statusMessage: 'Blog temporarily unavailable' })
}

const canonicalUrl = computed(() => `${siteUrl}/blog/${post.value?.slug}`)
const description = computed(() =>
  truncateDescription(post.value?.excerpt || 'LaunchLog article about SaaS launch visibility and AI search.'),
)
const imageUrl = computed(() => post.value?.featuredImage || `${siteUrl}/og-image.jpg`)

useSeoMeta({
  title: computed(() => `${post.value?.title} | LaunchLog Blog`),
  description,
  ogTitle: computed(() => post.value?.title),
  ogDescription: description,
  ogType: 'article',
  ogUrl: canonicalUrl,
  ogImage: imageUrl,
  ogImageSecureUrl: imageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: computed(() => post.value?.title),
  twitterDescription: description,
  twitterImage: imageUrl,
  articlePublishedTime: computed(() => post.value?.date),
  articleModifiedTime: computed(() => post.value?.modified),
})

useHead({
  link: [
    {
      rel: 'canonical',
      href: canonicalUrl,
    },
  ],
  script: [
    {
      key: 'launchlog-blog-post-schema',
      type: 'application/ld+json',
      innerHTML: computed(() => serializeJsonLd({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        '@id': `${canonicalUrl.value}#article`,
        url: canonicalUrl.value,
        mainEntityOfPage: canonicalUrl.value,
        headline: post.value?.title,
        description: description.value,
        image: imageUrl.value,
        datePublished: post.value?.date,
        dateModified: post.value?.modified,
        inLanguage: 'en-US',
        author: {
          '@type': 'Organization',
          name: post.value?.authorName || 'LaunchLog',
        },
        publisher: {
          '@id': `${siteUrl}/#organization`,
        },
      })),
    },
  ],
})

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Blog', path: '/blog' },
  { name: post.value?.title ?? 'Article', path: `/blog/${post.value?.slug}` },
])

function truncateDescription(value: string): string {
  if (value.length <= 155) return value

  return `${value.slice(0, 152).replace(/\s+\S*$/, '')}...`
}
</script>

<template>
  <ContentReadingShell
    v-if="post"
    label="Journal dispatch"
    :title="post.title"
    :intro="post.excerpt"
  >
    <template #meta>
      <ContentReadingMeta
        :items="[
          {
            label: 'Published',
            value: new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            datetime: post.date,
          },
          { label: 'By', value: post.authorName || 'LaunchLog' },
          ...(post.categories.length ? [{ label: 'Filed under', value: post.categories.join(', ') }] : []),
        ]"
      />
    </template>

    <article>
      <NuxtLink
        to="/blog"
        class="inline-flex font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-blaze hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
      >
        ← Journal index
      </NuxtLink>

      <img
        v-if="post.featuredImage"
        :src="post.featuredImage"
        :alt="post.featuredImageAlt || post.title"
        class="mt-8 aspect-[16/9] w-full border border-release-seam object-cover"
      >

      <div class="blog-content reading-prose mt-10" v-html="post.content" />

      <aside class="mt-14 border-y border-release-seam py-7">
        <p class="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-release-blaze">
          Publish a release record
        </p>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-release-paper-muted">
          LaunchLog publishes curated product profiles with schema.org structured data, sitemap
          discovery and machine-readable output alongside the visible page.
        </p>
        <div class="mt-5 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em]">
          <NuxtLink to="/submit" class="text-release-blaze hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">
            Submit your product
          </NuxtLink>
          <NuxtLink to="/pricing" class="text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">
            See pricing
          </NuxtLink>
          <NuxtLink to="/browse-all" class="text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">
            Browse all listings
          </NuxtLink>
          <NuxtLink to="/featured" class="text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">
            Featured launches
          </NuxtLink>
        </div>
      </aside>
    </article>
  </ContentReadingShell>
</template>

<style scoped>
.blog-content :deep(*) {
  letter-spacing: 0;
}

.blog-content :deep(p + p),
.blog-content :deep(ul),
.blog-content :deep(ol),
.blog-content :deep(figure) {
  margin-top: 1.25rem;
}

.blog-content :deep(h2),
.blog-content :deep(h3),
.blog-content :deep(h4) {
  margin-top: 2rem;
}

.blog-content :deep(img) {
  border: 1px solid var(--release-seam);
  height: auto;
  margin-top: 1.5rem;
  max-width: 100%;
}
</style>
