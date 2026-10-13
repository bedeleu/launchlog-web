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
  headingLevel?: 'h1' | 'h2'
  idPrefix?: string
}>(), {
  compact: false,
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
    <header class="grid items-end gap-7 pb-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-10" :class="compact ? '' : 'lg:pb-10'">
      <div class="min-w-0">
        <component :is="headingLevel" class="break-words leading-[1.03] font-semibold tracking-[-0.035em] text-[#f6f1e7] [text-wrap:balance]" :class="compact ? 'text-3xl sm:text-4xl' : 'text-[clamp(2.5rem,5.5vw,5rem)]'">
          {{ displayTitle }}
        </component>
        <p v-if="tagline" class="mt-5 max-w-[55ch] text-lg leading-relaxed text-release-paper-muted sm:text-xl">
          {{ tagline }}
        </p>
        <p v-else-if="generating" class="mt-5 text-lg text-release-paper-muted">
          Your product page is taking shape.
        </p>
        <a
          v-if="websiteUrl"
          :href="websiteUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-5 inline-flex max-w-full items-center gap-2 break-all text-sm text-release-paper-muted underline-offset-4 transition-colors hover:text-release-paper hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
        >
          {{ domain }}
          <ArrowUpRight class="size-4 shrink-0" aria-hidden="true" />
          <span class="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      <slot name="action" />
    </header>

    <figure class="overflow-hidden bg-release-rail">
      <div class="aspect-[16/10] w-full">
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
      <figcaption class="flex flex-wrap items-center justify-between gap-2 border-t border-release-seam px-4 py-3 text-xs text-release-paper-muted sm:px-5">
        <span class="break-all">{{ domain }}</span>
        <span>Private preview · not published</span>
      </figcaption>
    </figure>

    <section v-if="paragraphs.length" :aria-labelledby="`${idPrefix}-about-title`" class="grid gap-5 pt-10" :class="compact ? '' : 'sm:pt-14 lg:grid-cols-[minmax(12rem,1fr)_minmax(0,3fr)] lg:gap-10'">
      <component :is="headingLevel === 'h1' ? 'h2' : 'h3'" :id="`${idPrefix}-about-title`" class="break-words text-xl font-semibold tracking-[-0.025em] text-release-paper">
        About {{ displayTitle }}
      </component>
      <div class="max-w-[72ch] space-y-5 text-base leading-8 text-release-paper-muted sm:text-lg">
        <p v-for="(paragraph, index) in paragraphs" :key="index" class="whitespace-pre-line break-words">
          {{ paragraph }}
        </p>
      </div>
    </section>
  </article>
</template>
