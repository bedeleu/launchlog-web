<script setup lang="ts">
import type { BlogPost } from '~~/server/utils/wordpress-blog'

defineProps<{
  post: BlogPost
  sequence: number
}>()

const publishedDate = (value: string) => new Date(value).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
</script>

<template>
  <article data-blog-dispatch class="group border-t border-release-seam">
    <NuxtLink
      :to="`/blog/${post.slug}`"
      class="grid h-full gap-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus sm:grid-cols-[10rem_minmax(0,1fr)]"
    >
      <div
        class="relative aspect-[16/9] overflow-hidden border-x border-release-seam bg-release-rail sm:aspect-auto sm:min-h-52 sm:border-r-0"
        :data-image-state="post.featuredImage ? 'available' : 'missing'"
      >
        <img
          v-if="post.featuredImage"
          :src="post.featuredImage"
          :alt="post.featuredImageAlt || post.title"
          class="size-full object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.02]"
          loading="lazy"
        >
        <div v-else class="flex size-full items-end p-4" aria-hidden="true">
          <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-release-paper-muted">Text dispatch</span>
        </div>
      </div>

      <div class="flex min-w-0 flex-col border-x border-b border-release-seam p-5 sm:border-l-0 sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-release-paper-muted">
          <span>Dispatch {{ String(sequence).padStart(3, '0') }}</span>
          <time :datetime="post.date">{{ publishedDate(post.date) }}</time>
        </div>
        <h2 class="mt-5 text-balance text-2xl font-semibold leading-[1.08] tracking-[-0.035em] text-[#f6f1e7] md:text-[1.7rem]">
          {{ post.title }}
        </h2>
        <p class="mt-4 line-clamp-3 text-sm leading-6 text-release-paper-muted">
          {{ post.excerpt }}
        </p>
        <span class="mt-7 inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-blaze">
          Read dispatch <span aria-hidden="true">→</span>
        </span>
      </div>
    </NuxtLink>
  </article>
</template>
