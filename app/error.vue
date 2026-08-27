<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const statusCode = computed(() => props.error?.statusCode ?? 500)
const isNotFound = computed(() => statusCode.value === 404)
const isGone = computed(() => statusCode.value === 410)
const heading = computed(() => (isNotFound.value || isGone.value ? 'Record unavailable' : 'Temporary interruption'))
const description = computed(() => {
  if (isNotFound.value) return 'That address does not exist. Check the casing or return to the public catalog.'
  if (isGone.value) return 'This release record was withdrawn and is no longer part of the public catalog.'
  return 'LaunchLog could not render this surface. The failure is temporary; retry from the catalog in a moment.'
})

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
      <main class="mx-auto flex min-h-screen max-w-6xl items-center px-5 py-16 sm:px-8">
        <section class="w-full border-x border-release-seam bg-release-ink px-5 py-8 text-[#f6f1e7] sm:px-8 lg:px-12 lg:py-12">
          <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div class="min-w-0">
              <p class="font-mono text-[0.68rem] font-semibold tracking-[0.2em] text-release-blaze uppercase">
                Terminal record · {{ statusCode }}
              </p>
              <h1 class="mt-4 max-w-[18ch] text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
                {{ heading }}
              </h1>
              <p class="mt-5 max-w-xl text-base leading-7 text-release-paper-muted sm:text-lg sm:leading-8">
                {{ description }}
              </p>
              <NuxtLink
                to="/"
                class="mt-8 inline-flex h-11 items-center justify-center border border-release-paper bg-release-paper px-5 font-mono text-xs font-semibold tracking-[0.08em] text-release-ink uppercase transition-colors hover:border-release-warning hover:bg-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning focus-visible:ring-offset-2 focus-visible:ring-offset-release-ink"
              >
                Return to catalog
              </NuxtLink>
            </div>
            <aside class="border-t border-release-seam pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              <p class="font-mono text-[0.62rem] font-semibold tracking-[0.16em] text-release-warning uppercase">Indexing contract</p>
              <p class="mt-3 text-sm leading-6 text-release-paper-muted">
                {{ deindex
                  ? 'This permanent terminal state is excluded from search indexing.'
                  : 'This temporary failure remains eligible for recovery and is not deindexed.' }}
              </p>
            </aside>
          </div>
        </section>
      </main>
    </Body>
  </Html>
</template>
