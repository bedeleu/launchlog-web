<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const slug = computed(() => String(route.params.slug ?? ''))

const { data: post } = await useAsyncData(`blog-post-${slug.value}`, () =>
  $fetch(`/api/blog/posts/${slug.value}`),
)

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Blog post not found' })
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
      innerHTML: computed(() => JSON.stringify({
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

function truncateDescription(value: string): string {
  if (value.length <= 155) return value

  return `${value.slice(0, 152).replace(/\s+\S*$/, '')}...`
}
</script>

<template>
  <main class="mx-auto max-w-3xl px-6 py-12 md:py-16">
    <NuxtLink to="/blog" class="text-brand-muted text-sm hover:text-white">
      Back to blog
    </NuxtLink>

    <article v-if="post" class="mt-8">
      <header>
        <time class="text-brand-muted text-sm" :datetime="post.date">
          {{ new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }}
        </time>
        <h1 class="mt-4 text-4xl font-bold tracking-normal text-white md:text-6xl">
          {{ post.title }}
        </h1>
        <p class="text-brand-muted mt-5 text-lg leading-8">
          {{ post.excerpt }}
        </p>
      </header>

      <img
        v-if="post.featuredImage"
        :src="post.featuredImage"
        :alt="post.featuredImageAlt || post.title"
        class="mt-10 aspect-[16/9] w-full rounded-lg object-cover"
      >

      <div class="blog-content mt-10" v-html="post.content" />
    </article>
  </main>
</template>

<style scoped>
.blog-content :deep(*) {
  letter-spacing: 0;
}

.blog-content :deep(p),
.blog-content :deep(li) {
  color: rgb(209 213 219);
  font-size: 1.0625rem;
  line-height: 1.85;
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
  color: white;
  font-weight: 700;
  line-height: 1.25;
  margin-top: 2rem;
}

.blog-content :deep(h2) {
  font-size: 1.875rem;
}

.blog-content :deep(h3) {
  font-size: 1.5rem;
}

.blog-content :deep(a) {
  color: #818cf8;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.blog-content :deep(img) {
  border-radius: 0.5rem;
  margin-top: 1.5rem;
}

.blog-content :deep(ul),
.blog-content :deep(ol) {
  padding-left: 1.5rem;
}

.blog-content :deep(ul) {
  list-style: disc;
}

.blog-content :deep(ol) {
  list-style: decimal;
}
</style>
