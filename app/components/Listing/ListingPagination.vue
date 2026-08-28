<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { Button } from '@/components/ui/button'

/**
 * The archive's page register.
 *
 * The three archives deliberately expose different navigation: Browse All
 * publishes numbered pages so a crawler reaches any page of the catalog in one
 * hop, while the category archives publish previous/next only. This component
 * renders both shapes in one material rather than unifying the two contracts —
 * changing which links an archive emits would change its crawl surface.
 */
withDefaults(defineProps<{
  currentPage: number
  lastPage: number
  /** Accessible name. Each archive keeps its own so the landmark stays unambiguous. */
  label: string
  /** Resolves a page number to a route. Owned by the page, which knows its filters. */
  to: (page: number) => RouteLocationRaw
  /** Numbered pages, already gap-collapsed by the page. Empty renders prev/next only. */
  pages?: number[]
}>(), {
  pages: () => [],
})
</script>

<template>
  <nav
    v-if="lastPage > 1"
    class="mt-10 flex flex-wrap items-center justify-center gap-2 border-t border-release-seam pt-6"
    :aria-label="label"
  >
    <Button v-if="currentPage <= 1" variant="outline" disabled>
      Previous
    </Button>
    <Button v-else as-child variant="outline">
      <NuxtLink :to="to(currentPage - 1)" rel="prev">
        Previous
      </NuxtLink>
    </Button>

    <template v-for="(page, index) in pages" :key="page">
      <span
        v-if="index > 0 && pages[index - 1] !== page - 1"
        class="px-1 font-mono text-sm text-release-paper-muted"
        aria-hidden="true"
      >
        …
      </span>
      <!-- The current page inverts to paper: the reader's position in the
           catalog is stated by material, not by an accent colour. -->
      <span
        v-if="page === currentPage"
        class="flex size-10 items-center justify-center border border-release-paper bg-release-paper font-mono text-sm font-semibold text-release-ink"
        aria-current="page"
      >
        {{ page }}
      </span>
      <NuxtLink
        v-else
        :to="to(page)"
        class="flex size-10 items-center justify-center border border-release-seam font-mono text-sm font-medium text-release-paper-muted transition-colors hover:border-release-paper-muted hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-2 focus-visible:ring-offset-release-ink"
      >
        {{ page }}
      </NuxtLink>
    </template>

    <Button v-if="currentPage >= lastPage" variant="outline" disabled>
      Next
    </Button>
    <Button v-else as-child variant="outline">
      <NuxtLink :to="to(currentPage + 1)" rel="next">
        Next
      </NuxtLink>
    </Button>
  </nav>
</template>
