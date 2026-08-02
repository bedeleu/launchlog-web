<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const blogUrl = `${siteUrl}/blog`
const blogDescription = 'LaunchLog blog covers SaaS launches, indie maker discovery, AI search visibility, schema.org and practical product distribution.'

const { data: posts } = await useAsyncData('blog-posts', () => $fetch('/api/blog/posts', {
  query: { limit: 24 },
}))

const blogPosts = computed(() => posts.value ?? [])

useSeoMeta({
  title: 'LaunchLog Blog — SaaS launch visibility and AI search',
  description: blogDescription,
  ogTitle: 'LaunchLog Blog — SaaS launch visibility and AI search',
  ogDescription: blogDescription,
  ogUrl: blogUrl,
  ogType: 'website',
  twitterTitle: 'LaunchLog Blog — SaaS launch visibility and AI search',
  twitterDescription: blogDescription,
})

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Blog', path: '/blog' },
])

useHead({
  script: [
    {
      key: 'launchlog-blog-schema',
      type: 'application/ld+json',
      innerHTML: computed(() => JSON.stringify({
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
            '@id': `${blogUrl}#itemlist`,
            itemListElement: blogPosts.value.map((post, index) => ({
              '@type': 'ListItem',
              position: index + 1,
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

    <section
      v-if="blogPosts.length"
      class="mt-12 grid gap-5 md:grid-cols-2"
      aria-label="Latest LaunchLog blog posts"
    >
      <article
        v-for="post in blogPosts"
        :key="post.id"
        class="overflow-hidden rounded-lg border border-brand-border bg-white/[0.03]"
      >
        <NuxtLink :to="`/blog/${post.slug}`" class="block focus:outline-none focus:ring-2 focus:ring-brand-accent">
          <img
            v-if="post.featuredImage"
            :src="post.featuredImage"
            :alt="post.featuredImageAlt || post.title"
            class="aspect-[16/9] w-full object-cover"
            loading="lazy"
          >
          <div class="p-6">
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

    <p v-else class="text-brand-muted mt-12">
      No articles published yet.
    </p>
  </main>
</template>
