<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const statusCode = computed(() => props.error?.statusCode ?? 500)
const isNotFound = computed(() => statusCode.value === 404)
const heading = computed(() => (isNotFound.value ? 'Page not found' : 'Something went wrong'))

// Only a permanently excluded status gets a deindex directive. Exact-case routing now turns every
// mis-cased URL into a 404, and that is what a crawler would otherwise be offered in its place.
// A temporary failure — 408, 425, 429, any 5xx — must NOT get one: that would ask search engines
// to drop URLs that are still live.
const deindex = computed(() => shouldDeindexErrorStatus(statusCode.value))

if (deindex.value) {
  if (useRequestEvent()) {
    useResponseHeader('X-Robots-Tag').value = 'noindex, nofollow'
  }

  useSeoMeta({ robots: 'noindex, nofollow' })
}

useSeoMeta({
  title: `${statusCode.value} — ${heading.value} | LaunchLog`,
})
</script>

<template>
  <!--
    Nuxt renders error.vue in place of app.vue, so the document shell is not inherited: without
    this the page shipped a bare <html> and the white headline landed on the default light
    background. Mirrors app.vue exactly.
  -->
  <Html lang="en" class="dark">
    <Body>
      <main class="mx-auto flex min-h-screen max-w-6xl flex-col items-start justify-center px-6 py-20">
        <p class="text-brand-muted text-sm font-semibold uppercase tracking-[0.18em]">
          Error {{ statusCode }}
        </p>
        <h1 class="mt-5 text-4xl font-bold tracking-normal text-white md:text-5xl">
          {{ heading }}
        </h1>
        <p class="text-brand-muted mt-5 max-w-xl text-lg leading-8">
          <template v-if="isNotFound">
            That URL does not exist. LaunchLog addresses are lower-case, so check the casing, or
            start from the directory.
          </template>
          <template v-else>
            The page could not be rendered. Please try again in a moment.
          </template>
        </p>
        <NuxtLink
          to="/"
          class="mt-10 inline-flex h-11 items-center justify-center rounded-md border border-brand-border px-5 text-sm font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
        >
          Go to LaunchLog
        </NuxtLink>
      </main>
    </Body>
  </Html>
</template>
