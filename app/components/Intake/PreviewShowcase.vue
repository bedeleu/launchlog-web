<script setup lang="ts">
import { ArrowUpRight, ImageOff } from '@lucide/vue'
import { previewScreenshotCandidates } from '~/utils/preview-screenshot'

const props = withDefaults(defineProps<{
  title: string
  tagline: string
  description: string
  domain: string
  url: string
  screenshotUrl: string | null
  generating: boolean
  compact?: boolean
  showIdentity?: boolean
  headingLevel?: 'h1' | 'h2'
  idPrefix?: string
}>(), {
  compact: false,
  showIdentity: true,
  headingLevel: 'h1',
  idPrefix: 'preview',
})

const displayTitle = computed(() => props.title || props.domain || 'Your product')
const paragraphs = computed(() => props.description.split(/\n{2,}/).map(value => value.trim()).filter(Boolean))
const screenshotCandidates = computed(() => previewScreenshotCandidates(props.screenshotUrl))
const screenshotIndex = ref(0)
const screenshotSource = computed(() => screenshotCandidates.value[screenshotIndex.value])

watch(() => props.screenshotUrl, () => { screenshotIndex.value = 0 })

const websiteUrl = computed(() => {
  try {
    const url = new URL(props.url)
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null
  }
  catch {
    return null
  }
})
</script>

<template>
  <article data-preview-showcase>
    <header v-if="showIdentity" class="grid items-end gap-4 pb-5 md:grid-cols-[minmax(0,1fr)_auto]">
      <div class="min-w-0">
        <component :is="headingLevel" class="break-words leading-[1.03] font-semibold tracking-[-0.035em] text-[#f6f1e7] [text-wrap:balance]" :class="compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'">
          {{ displayTitle }}
        </component>
        <p v-if="tagline" class="mt-2 max-w-[65ch] text-sm leading-6 text-release-paper-muted">
          {{ tagline }}
        </p>
        <p v-else-if="generating" class="mt-2 text-sm text-release-paper-muted">
          Your product page is taking shape.
        </p>
        <a
          v-if="websiteUrl"
          :href="websiteUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-2 inline-flex max-w-full items-center gap-2 break-all text-sm text-release-paper-muted underline-offset-4 transition-colors hover:text-release-paper hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
        >
          {{ domain }}
          <ArrowUpRight class="size-4 shrink-0" aria-hidden="true" />
          <span class="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      <slot name="action" />
    </header>

    <figure class="overflow-hidden bg-release-rail">
      <div class="preview-showcase-media w-full">
        <img
          v-if="screenshotSource"
          :key="screenshotSource"
          data-preview-screenshot
          :src="screenshotSource"
          :alt="`${displayTitle} website screenshot`"
          width="1600"
          height="1000"
          fetchpriority="high"
          class="size-full object-contain"
          @error="screenshotIndex++"
        >
        <div v-else class="flex size-full flex-col items-center justify-center gap-4 px-6 text-center" role="status">
          <AppSpinner v-if="generating" class="size-7" label="Capturing your website" />
          <ImageOff v-else class="size-8 text-release-paper-muted" aria-hidden="true" />
          <p class="text-base font-medium text-release-paper">
            {{ generating ? 'Preparing your website screenshot' : 'Website screenshot unavailable' }}
          </p>
          <p class="max-w-sm text-sm leading-6 text-release-paper-muted">
            {{ generating ? 'The capture will appear here when it is ready.' : 'Your listing details are still here. You can request a fresh capture below.' }}
          </p>
        </div>
      </div>
      <figcaption class="flex flex-wrap items-center justify-between gap-2 border-t border-release-seam px-3 py-2 text-xs text-release-paper-muted">
        <a
          v-if="websiteUrl"
          :href="websiteUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-6 items-center gap-1.5 break-all underline-offset-4 hover:text-release-paper hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
        >
          {{ domain }}
          <ArrowUpRight class="size-3 shrink-0" aria-hidden="true" />
          <span class="sr-only">(opens in a new tab)</span>
        </a>
        <span v-else class="break-all">{{ domain }}</span>
        <span>Private preview · not published</span>
      </figcaption>
    </figure>

    <section v-if="paragraphs.length" :aria-labelledby="`${idPrefix}-about-title`" class="grid gap-2 pt-5">
      <component :is="!showIdentity || headingLevel === 'h1' ? 'h2' : 'h3'" :id="`${idPrefix}-about-title`" class="break-words text-base font-semibold tracking-[-0.025em] text-release-paper">
        About {{ displayTitle }}
      </component>
      <div class="max-w-[72ch] space-y-3 text-sm leading-6 text-release-paper-muted">
        <p v-for="(paragraph, index) in paragraphs" :key="index" class="whitespace-pre-line break-words">
          {{ paragraph }}
        </p>
      </div>
    </section>
  </article>
</template>

<style scoped>
.preview-showcase-media {
  aspect-ratio: 16 / 10;
}
</style>
